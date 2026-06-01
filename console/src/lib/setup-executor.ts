/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { catalogsApi } from "@/api/management/catalogs"
import { principalsApi } from "@/api/management/principals"
import { principalRolesApi } from "@/api/management/principal-roles"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { privilegesApi } from "@/api/management/privileges"
import { namespacesApi } from "@/api/catalog/namespaces"
import type { StorageConfigInfo, CatalogPrivilege, NamespacePrivilege } from "@/types/api"
import type { SetupConfig, CatalogSetupConfig } from "@/types/setup-config"

export interface SetupStep {
  id: string
  label: string
  status: "pending" | "running" | "done" | "skipped" | "error"
  error?: string
}

export interface SetupResult {
  credentials: Array<{
    principalName: string
    clientId: string
    clientSecret: string
  }>
}

export type StepUpdateCallback = (steps: SetupStep[]) => void

export async function executeSetup(
  config: SetupConfig,
  onStepUpdate: StepUpdateCallback
): Promise<SetupResult> {
  const credentials: SetupResult["credentials"] = []
  const steps = buildSteps(config)
  onStepUpdate([...steps])

  const update = (id: string, status: SetupStep["status"], error?: string) => {
    const step = steps.find((s) => s.id === id)
    if (step) {
      step.status = status
      step.error = error
      onStepUpdate([...steps])
    }
  }

  const tryStep = async (id: string, fn: () => Promise<unknown>) => {
    update(id, "running")
    try {
      await fn()
      update(id, "done")
    } catch (e) {
      update(
        id,
        isConflict(e) ? "skipped" : "error",
        isConflict(e) ? undefined : extractErrorMessage(e)
      )
    }
  }

  // On a fatal error (e.g. 403 on initial list calls) mark every unfinished step so
  // the UI always reaches the "done" screen with a meaningful error state.
  const failRemaining = (message: string) => {
    for (const s of steps) {
      if (s.status === "pending" || s.status === "running") {
        s.status = "error"
        s.error = message
      }
    }
    onStepUpdate([...steps])
  }

  // Mark all still-pending sub-steps of a catalog as skipped (used when the catalog itself fails).
  const skipCatalogSubSteps = (catalogConfig: CatalogSetupConfig) => {
    const catalogName = catalogConfig.name
    for (const [roleName, roleConfig] of Object.entries(catalogConfig.roles ?? {})) {
      update(`cr-${catalogName}-${roleName}`, "skipped", "catalog creation failed")
      for (const p of roleConfig.privileges?.catalog ?? []) {
        update(
          `grant-catalog-${catalogName}-${roleName}-${p}`,
          "skipped",
          "catalog creation failed"
        )
      }
      for (const [ns, privs] of Object.entries(roleConfig.privileges?.namespace ?? {})) {
        for (const p of privs) {
          update(
            `grant-ns-${catalogName}-${roleName}-${ns}-${p}`,
            "skipped",
            "catalog creation failed"
          )
        }
      }
      for (const pr of roleConfig.assign_to ?? []) {
        update(
          `assign-cr-${catalogName}-${roleName}-to-${pr}`,
          "skipped",
          "catalog creation failed"
        )
      }
    }
    for (const ns of catalogConfig.namespaces ?? []) {
      const nsName = typeof ns === "string" ? ns : ns.name
      update(`ns-${catalogName}-${nsName}`, "skipped", "catalog creation failed")
    }
  }

  try {
    // 1. Create PrincipalRoles
    const existingPrincipalRoles = new Set((await principalRolesApi.list()).map((r) => r.name))
    for (const roleName of config.principal_roles ?? []) {
      const id = `pr-${roleName}`
      if (existingPrincipalRoles.has(roleName)) {
        update(id, "skipped")
        continue
      }
      await tryStep(id, () => principalRolesApi.create({ name: roleName }))
    }

    // 2. Create Principals
    const existingPrincipals = new Set((await principalsApi.list()).map((p) => p.name))
    for (const [principalName] of Object.entries(config.principals ?? {})) {
      const id = `principal-${principalName}`
      if (existingPrincipals.has(principalName)) {
        update(id, "skipped")
        continue
      }
      await tryStep(id, async () => {
        const result = await principalsApi.create({ principal: { name: principalName } })
        const clientId = result.credentials?.clientId ?? ""
        const clientSecret = result.credentials?.clientSecret ?? ""
        if (clientId && clientSecret) {
          credentials.push({ principalName, clientId, clientSecret })
        }
      })
    }

    // 3. Create Catalogs + per-catalog entities
    const existingCatalogs = new Set((await catalogsApi.list()).map((c) => c.name))
    for (const catalogConfig of config.catalogs ?? []) {
      const catalogName = catalogConfig.name

      // 3a. Catalog
      const catalogId = `catalog-${catalogName}`
      update(catalogId, "running")
      if (existingCatalogs.has(catalogName)) {
        update(catalogId, "skipped")
      } else {
        try {
          await catalogsApi.create({
            catalog: {
              name: catalogName,
              type: catalogConfig.type ?? "INTERNAL",
              properties: {
                "default-base-location": normalizeLocation(
                  catalogConfig.default_base_location,
                  catalogConfig.storage_type
                ),
                ...catalogConfig.properties,
              },
              storageConfigInfo: buildStorageConfig(catalogConfig),
            },
          })
          update(catalogId, "done")
        } catch (e) {
          update(
            catalogId,
            isConflict(e) ? "skipped" : "error",
            isConflict(e) ? undefined : extractErrorMessage(e)
          )
          if (!isConflict(e)) {
            // Catalog failed — mark all its sub-steps as skipped so they don't show as pending
            skipCatalogSubSteps(catalogConfig)
            continue
          }
        }
      }

      // 3b. Namespaces — must exist before namespace-scoped grants below
      // Handle dot-notation paths (e.g. "parent.child")
      for (const ns of catalogConfig.namespaces ?? []) {
        const nsName = typeof ns === "string" ? ns : ns.name
        const nsId = `ns-${catalogName}-${nsName}`
        await tryStep(nsId, async () => {
          const parts = nsName.split(".")
          for (let i = 1; i < parts.length; i++) {
            try {
              await namespacesApi.create(catalogName, { namespace: parts.slice(0, i) })
            } catch {
              /* ignore */
            }
          }
          await namespacesApi.create(catalogName, { namespace: parts })
        })
      }

      // 3c. CatalogRoles + grants + assignments
      const existingCatalogRoles = new Set(
        (await catalogRolesApi.list(catalogName)).map((r) => r.name)
      )
      for (const [roleName, roleConfig] of Object.entries(catalogConfig.roles ?? {})) {
        const roleId = `cr-${catalogName}-${roleName}`
        update(roleId, "running")
        if (!existingCatalogRoles.has(roleName)) {
          try {
            await catalogRolesApi.create(catalogName, { name: roleName })
            update(roleId, "done")
          } catch (e) {
            update(
              roleId,
              isConflict(e) ? "skipped" : "error",
              isConflict(e) ? undefined : extractErrorMessage(e)
            )
            if (!isConflict(e)) continue
          }
        } else {
          update(roleId, "skipped")
        }

        for (const privilege of roleConfig.privileges?.catalog ?? []) {
          const grantId = `grant-catalog-${catalogName}-${roleName}-${privilege}`
          await tryStep(grantId, () =>
            privilegesApi.grant(catalogName, roleName, {
              type: "catalog",
              privilege: privilege as CatalogPrivilege,
            })
          )
        }

        for (const [nsName, nsPrivileges] of Object.entries(
          roleConfig.privileges?.namespace ?? {}
        )) {
          const nsParts = nsName.split(".")
          for (const privilege of nsPrivileges) {
            const grantId = `grant-ns-${catalogName}-${roleName}-${nsName}-${privilege}`
            await tryStep(grantId, () =>
              privilegesApi.grant(catalogName, roleName, {
                type: "namespace",
                namespace: nsParts,
                privilege: privilege as NamespacePrivilege,
              })
            )
          }
        }

        for (const principalRoleName of roleConfig.assign_to ?? []) {
          const assignId = `assign-cr-${catalogName}-${roleName}-to-${principalRoleName}`
          await tryStep(assignId, () =>
            catalogRolesApi.grantToPrincipalRole(catalogName, roleName, principalRoleName)
          )
        }
      }
    }

    // 4. Assign Principals → PrincipalRoles
    for (const [principalName, principalConfig] of Object.entries(config.principals ?? {})) {
      for (const roleName of principalConfig.roles ?? []) {
        const id = `assign-p-${principalName}-to-${roleName}`
        await tryStep(id, () => principalsApi.grantPrincipalRole(principalName, roleName))
      }
    }
  } catch (e) {
    // Fatal error (e.g. 403 Forbidden on list calls) — surface it on all unfinished steps
    failRemaining(extractErrorMessage(e))
  }

  return { credentials }
}

export function buildSteps(config: SetupConfig): SetupStep[] {
  const steps: SetupStep[] = []
  const step = (id: string, label: string): SetupStep => ({ id, label, status: "pending" })

  for (const roleName of config.principal_roles ?? []) {
    steps.push(step(`pr-${roleName}`, `Create principal role: ${roleName}`))
  }
  for (const principalName of Object.keys(config.principals ?? {})) {
    steps.push(step(`principal-${principalName}`, `Create principal: ${principalName}`))
  }
  for (const catalogConfig of config.catalogs ?? []) {
    steps.push(step(`catalog-${catalogConfig.name}`, `Create catalog: ${catalogConfig.name}`))
    for (const ns of catalogConfig.namespaces ?? []) {
      const nsName = typeof ns === "string" ? ns : ns.name
      steps.push(step(`ns-${catalogConfig.name}-${nsName}`, `Create namespace: ${nsName}`))
    }
    for (const [roleName, roleConfig] of Object.entries(catalogConfig.roles ?? {})) {
      const cn = catalogConfig.name
      steps.push(step(`cr-${cn}-${roleName}`, `Create catalog role: ${roleName}`))
      for (const privilege of roleConfig.privileges?.catalog ?? []) {
        steps.push(
          step(`grant-catalog-${cn}-${roleName}-${privilege}`, `Grant ${privilege} to ${roleName}`)
        )
      }
      for (const [nsName, nsPrivileges] of Object.entries(roleConfig.privileges?.namespace ?? {})) {
        for (const privilege of nsPrivileges) {
          steps.push(
            step(
              `grant-ns-${cn}-${roleName}-${nsName}-${privilege}`,
              `Grant ${privilege} on ${nsName} to ${roleName}`
            )
          )
        }
      }
      for (const principalRoleName of roleConfig.assign_to ?? []) {
        steps.push(
          step(
            `assign-cr-${cn}-${roleName}-to-${principalRoleName}`,
            `Assign ${roleName} → ${principalRoleName}`
          )
        )
      }
    }
  }
  for (const [principalName, principalConfig] of Object.entries(config.principals ?? {})) {
    for (const roleName of principalConfig.roles ?? []) {
      steps.push(
        step(
          `assign-p-${principalName}-to-${roleName}`,
          `Assign principal role ${roleName} to ${principalName}`
        )
      )
    }
  }

  return steps
}

/**
 * For FILE storage, Polaris requires a file:// URI scheme in locations.
 * Auto-prefix absolute paths that are missing the scheme.
 */
function normalizeLocation(location: string, storageType: string): string {
  if (storageType.toLowerCase() === "file" && location.startsWith("/")) {
    return `file://${location}`
  }
  return location
}

function buildStorageConfig(catalog: CatalogSetupConfig): StorageConfigInfo {
  const storageTypeLower = catalog.storage_type.toLowerCase()
  const storageType = catalog.storage_type.toUpperCase() as StorageConfigInfo["storageType"]
  return {
    storageType,
    allowedLocations: (catalog.allowed_locations ?? [catalog.default_base_location]).map((l) =>
      normalizeLocation(l, storageTypeLower)
    ),
    ...(storageTypeLower === "s3" && {
      ...(catalog.role_arn && { roleArn: catalog.role_arn }),
      ...(catalog.external_id && { externalId: catalog.external_id }),
      ...(catalog.user_arn && { userArn: catalog.user_arn }),
      ...(catalog.region && { region: catalog.region }),
      ...(catalog.endpoint && { endpoint: catalog.endpoint }),
      ...(catalog.sts_unavailable !== undefined && { stsUnavailable: catalog.sts_unavailable }),
      ...(catalog.path_style_access !== undefined && {
        pathStyleAccess: catalog.path_style_access,
      }),
    }),
    ...(storageTypeLower === "azure" && {
      ...(catalog.tenant_id && { tenantId: catalog.tenant_id }),
      ...(catalog.multi_tenant_app_name && { multiTenantAppName: catalog.multi_tenant_app_name }),
      ...(catalog.consent_url && { consentUrl: catalog.consent_url }),
    }),
    ...(storageTypeLower === "gcs" && {
      ...(catalog.service_account && { gcsServiceAccount: catalog.service_account }),
    }),
  }
}

function extractErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const { data, status } = (e as { response: { data?: unknown; status?: number } }).response ?? {}
    if (
      data &&
      typeof data === "object" &&
      typeof (data as Record<string, unknown>).message === "string"
    )
      return (data as { message: string }).message
    if (status === 403) return "Permission denied (403 Forbidden)"
    if (status) return `Server error ${status}`
  }
  return String(e)
}

function isConflict(e: unknown): boolean {
  if (e && typeof e === "object" && "response" in e) {
    return (e as { response?: { status?: number } }).response?.status === 409
  }
  return false
}
