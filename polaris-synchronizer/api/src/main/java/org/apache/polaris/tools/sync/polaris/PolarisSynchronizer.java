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
package org.apache.polaris.tools.sync.polaris;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.iceberg.BaseTable;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.Principal;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.catalog.BaseTableWithETag;
import org.apache.polaris.tools.sync.polaris.catalog.ETagManager;
import org.apache.polaris.tools.sync.polaris.catalog.MetadataNotModifiedException;
import org.apache.polaris.tools.sync.polaris.planning.SynchronizationPlanner;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;
import org.apache.polaris.tools.sync.polaris.service.IcebergCatalogService;
import org.apache.polaris.tools.sync.polaris.service.PolarisService;
import org.apache.polaris.tools.sync.polaris.service.impl.PolarisIcebergCatalogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Encapsulates idempotent and failure-safe logic to perform Polaris entity syncs. Performs logging
 * with configurability and all actions related to the generated sync plans.
 */
public class PolarisSynchronizer {

  private final Logger clientLogger;

  private final SynchronizationPlanner syncPlanner;

  private final PolarisService source;

  private final PolarisService target;

  private final ETagManager etagManager;

  private final boolean haltOnFailure;

  private final boolean diffOnly;

  public PolarisSynchronizer(
      Logger clientLogger,
      boolean haltOnFailure,
      SynchronizationPlanner synchronizationPlanner,
      PolarisService source,
      PolarisService target,
      ETagManager etagManager,
      boolean diffOnly) {
    this.clientLogger =
        clientLogger == null ? LoggerFactory.getLogger(PolarisSynchronizer.class) : clientLogger;
    this.haltOnFailure = haltOnFailure;
    this.syncPlanner = synchronizationPlanner;
    this.source = source;
    this.target = target;
    this.etagManager = etagManager;
    this.diffOnly = diffOnly;
  }

  /**
   * Calculates the total number of sync tasks to complete.
   *
   * @param plan the plan to scan for changes
   * @return the number of syncs to perform
   */
  private int totalSyncsToComplete(SynchronizationPlan<?> plan) {
    return plan.entitiesToCreate().size()
        + plan.entitiesToOverwrite().size()
        + plan.entitiesToRemove().size();
  }

  /** Sync principals from source to target. */
  public void syncPrincipals() {
    List<Principal> principalsSource;

    try {
      principalsSource = source.listPrincipals();
      clientLogger.info("Listed {} principals from source.", principalsSource.size());
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.info("Failed to list principals from source.", e);
      return;
    }

    List<Principal> principalsTarget;

    try {
      principalsTarget = target.listPrincipals();
      clientLogger.info("Listed {} principals from target.", principalsTarget.size());
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.info("Failed to list principals from target.", e);
      return;
    }

    SynchronizationPlan<Principal> principalSyncPlan =
            syncPlanner.planPrincipalSync(principalsSource, principalsTarget);

    principalSyncPlan
            .entitiesToSkipAndSkipChildren()
            .forEach(
                    principal ->
                            clientLogger.info("Skipping principal {}.", principal.getName()));

    principalSyncPlan
            .entitiesNotModified()
            .forEach(
                    principal ->
                            clientLogger.info(
                                    "No change detected for principal {}, skipping.",
                                    principal.getName()));

    int syncsCompleted = 0;
    final int totalSyncsToComplete = totalSyncsToComplete(principalSyncPlan);

    for (Principal principal : principalSyncPlan.entitiesToCreate()) {
      try {
        PrincipalWithCredentials createdPrincipal = target.createPrincipal(principal);
        clientLogger.info("Created principal {} on target. Target credentials: {}:{} - {}/{}",
                principal.getName(),
                createdPrincipal.getCredentials().getClientId(),
                createdPrincipal.getCredentials().getClientSecret(),
                ++syncsCompleted,
                totalSyncsToComplete
        );
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error("Failed to create principal {} on target. - {}/{}",
                principal.getName(), ++syncsCompleted, totalSyncsToComplete, e);
      }
    }

    for (Principal principal : principalSyncPlan.entitiesToOverwrite()) {
      try {
        target.dropPrincipal(principal.getName());
        PrincipalWithCredentials overwrittenPrincipal = target.createPrincipal(principal);
        clientLogger.info("Overwrote principal {} on target. Target credentials: {}:{} - {}/{}",
                principal.getName(),
                overwrittenPrincipal.getCredentials().getClientId(),
                overwrittenPrincipal.getCredentials().getClientSecret(),
                ++syncsCompleted,
                totalSyncsToComplete
        );
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error("Failed to overwrite principal {} on target. - {}/{}",
                principal.getName(), ++syncsCompleted, totalSyncsToComplete, e);
      }
    }

    for (Principal principal : principalSyncPlan.entitiesToRemove()) {
      try {
        target.dropPrincipal(principal.getName());
        clientLogger.info("Removed principal {} on target. - {}/{}",
                principal.getName(), ++syncsCompleted, totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error("Failed to remove principal {} ont target. - {}/{}",
                principal.getName(), ++syncsCompleted, totalSyncsToComplete, e);
      }
    }

    for (Principal principal : principalSyncPlan.entitiesToSyncChildren()) {
      syncAssignedPrincipalRolesForPrincipal(principal.getName());
    }
  }

  /**
   * Synchronize assigned principal roles for a principal from source to target.
   * @param principalName the name of the principal to synchronize the principal roles for
   */
  public void syncAssignedPrincipalRolesForPrincipal(String principalName) {
    List<PrincipalRole> assignedPrincipalRolesSource;

    try {
      assignedPrincipalRolesSource = source.listPrincipalRolesAssigned(principalName);
      clientLogger.info("Listed {} assigned principal-roles for principal {} from source.",
              assignedPrincipalRolesSource.size(), principalName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error("Failed to list assigned principal-roles for principal {} from source.", principalName, e);
      return;
    }

    List<PrincipalRole> assignedPrincipalRolesTarget;

    try {
      assignedPrincipalRolesTarget = target.listPrincipalRolesAssigned(principalName);
      clientLogger.info("Listed {} assigned principal-roles for principal {} from target.",
              assignedPrincipalRolesTarget.size(), principalName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error("Failed to list assigned principal-roles for principal {} from target.", principalName, e);
      return;
    }

    SynchronizationPlan<PrincipalRole> assignedPrincipalRoleSyncPlan =
            syncPlanner.planAssignPrincipalsToPrincipalRolesSync(
                    principalName, assignedPrincipalRolesSource, assignedPrincipalRolesTarget);

    assignedPrincipalRoleSyncPlan
            .entitiesToSkip()
            .forEach(
                    principalRole ->
                            clientLogger.info("Skipping assignment of principal-role {} to principal {}.",
                                    principalName, principalRole.getName()));

    assignedPrincipalRoleSyncPlan
            .entitiesNotModified()
            .forEach(
                    principalRole ->
                            clientLogger.info(
                                    "Principal {} is already assigned to principal-role {}, skipping.",
                                    principalName, principalRole.getName()));

    int syncsCompleted = 0;
    final int totalSyncsToComplete = totalSyncsToComplete(assignedPrincipalRoleSyncPlan);

    for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToCreate()) {
      try {
        target.assignPrincipalRole(principalName, principalRole.getName());
        clientLogger.info("Assigned principal-role {} to principal {}. - {}/{}",
                principalRole.getName(), principalName, ++syncsCompleted, totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error("Failed to assign principal-role {} to principal {}. - {}/{}",
                principalRole.getName(), principalName, ++syncsCompleted, totalSyncsToComplete);
      }
    }

    for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToOverwrite()) {
      try {
        target.assignPrincipalRole(principalName, principalRole.getName());
        clientLogger.info("Assigned principal-role {} to principal {}. - {}/{}",
                principalRole.getName(), principalName, ++syncsCompleted, totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error("Failed to assign principal-role {} to principal {}. - {}/{}",
                principalRole.getName(), principalName, ++syncsCompleted, totalSyncsToComplete);
      }
    }

    for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToRemove()) {
      try {
        target.revokePrincipalRole(principalName, principalRole.getName());
        clientLogger.info("Revoked principal-role {} from principal {}. - {}/{}",
                principalRole.getName(), principalName, ++syncsCompleted, totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error("Failed to revoke principal-role {} to principal {}. - {}/{}",
                principalRole.getName(), principalName, ++syncsCompleted, totalSyncsToComplete);
      }
    }
  }

  /** Sync principal roles from source to target. */
  public void syncPrincipalRoles() {
    List<PrincipalRole> principalRolesSource;

    try {
      principalRolesSource = source.listPrincipalRoles();
      clientLogger.info("Listed {} principal-roles from source.", principalRolesSource.size());
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error("Failed to list principal-roles from source.", e);
      return;
    }

    List<PrincipalRole> principalRolesTarget;

    try {
      principalRolesTarget = target.listPrincipalRoles();
      clientLogger.info("Listed {} principal-roles from target.", principalRolesTarget.size());
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error("Failed to list principal-roles from target.", e);
      return;
    }

    SynchronizationPlan<PrincipalRole> principalRoleSyncPlan =
        syncPlanner.planPrincipalRoleSync(principalRolesSource, principalRolesTarget);

    principalRoleSyncPlan
        .entitiesToSkip()
        .forEach(
            principalRole ->
                clientLogger.info("Skipping principal-role {}.", principalRole.getName()));

    principalRoleSyncPlan
        .entitiesNotModified()
        .forEach(
            principalRole ->
                clientLogger.info(
                    "No change detected for principal-role {}, skipping.",
                    principalRole.getName()));

    int syncsCompleted = 0;
    final int totalSyncsToComplete = totalSyncsToComplete(principalRoleSyncPlan);

    for (PrincipalRole principalRole : principalRoleSyncPlan.entitiesToCreate()) {
      try {
        target.createPrincipalRole(principalRole);
        clientLogger.info(
            "Created principal-role {} on target. - {}/{}",
            principalRole.getName(),
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to create principal-role {} on target. - {}/{}",
            principalRole.getName(),
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (PrincipalRole principalRole : principalRoleSyncPlan.entitiesToOverwrite()) {
      try {
        target.dropPrincipalRole(principalRole.getName());
        target.createPrincipalRole(principalRole);
        clientLogger.info(
            "Overwrote principal-role {} on target. - {}/{}",
            principalRole.getName(),
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to overwrite principal-role {} on target. - {}/{}",
            principalRole.getName(),
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (PrincipalRole principalRole : principalRoleSyncPlan.entitiesToRemove()) {
      try {
        target.dropPrincipalRole(principalRole.getName());
        clientLogger.info(
            "Removed principal-role {} on target. - {}/{}",
            principalRole.getName(),
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to remove principal-role {} on target. - {}/{}",
            principalRole.getName(),
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }
  }

  /**
   * Sync assignments of principal roles to a catalog role.
   *
   * @param catalogName the catalog that the catalog role is in
   * @param catalogRoleName the name of the catalog role
   */
  public void syncAssigneePrincipalRolesForCatalogRole(String catalogName, String catalogRoleName) {
    List<PrincipalRole> principalRolesSource;

    try {
      principalRolesSource =
          source.listAssigneePrincipalRolesForCatalogRole(catalogName, catalogRoleName);
      clientLogger.info(
          "Listed {} assignee principal-roles for catalog-role {} in catalog {} from source.",
          principalRolesSource.size(),
          catalogRoleName,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list assignee principal-roles for catalog-role {} in catalog {} from source.",
          catalogRoleName,
          catalogName,
          e);
      return;
    }

    List<PrincipalRole> principalRolesTarget;

    try {
      principalRolesTarget =
          target.listAssigneePrincipalRolesForCatalogRole(catalogName, catalogRoleName);
      clientLogger.info(
          "Listed {} assignee principal-roles for catalog-role {} in catalog {} from target.",
          principalRolesTarget.size(),
          catalogRoleName,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list assignee principal-roles for catalog-role {} in catalog {} from target.",
          catalogRoleName,
          catalogName,
          e);
      return;
    }

    SynchronizationPlan<PrincipalRole> assignedPrincipalRoleSyncPlan =
        syncPlanner.planAssignPrincipalRolesToCatalogRolesSync(
            catalogName, catalogRoleName, principalRolesSource, principalRolesTarget);

    assignedPrincipalRoleSyncPlan
        .entitiesToSkip()
        .forEach(
            principalRole ->
                clientLogger.info(
                    "Skipping assignment of principal-role {} to catalog-role {} in catalog {}.",
                    principalRole.getName(),
                    catalogRoleName,
                    catalogName));

    assignedPrincipalRoleSyncPlan
        .entitiesNotModified()
        .forEach(
            principalRole ->
                clientLogger.info(
                    "Principal-role {} is already assigned to catalog-role {} in catalog {}. Skipping.",
                    principalRole.getName(),
                    catalogRoleName,
                    catalogName));

    int syncsCompleted = 0;
    int totalSyncsToComplete = totalSyncsToComplete(assignedPrincipalRoleSyncPlan);

    for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToCreate()) {
      try {
        target.assignCatalogRole(
            principalRole.getName(), catalogName, catalogRoleName);
        clientLogger.info(
            "Assigned principal-role {} to catalog-role {} in catalog {}. - {}/{}",
            principalRole.getName(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to assign principal-role {} to catalog-role {} in catalog {}. - {}/{}",
            principalRole.getName(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToOverwrite()) {
      try {
        target.assignCatalogRole(
            principalRole.getName(), catalogName, catalogRoleName);
        clientLogger.info(
            "Assigned principal-role {} to catalog-role {} in catalog {}. - {}/{}",
            principalRole.getName(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to assign principal-role {} to catalog-role {} in catalog {}. - {}/{}",
            principalRole.getName(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToRemove()) {
      try {
        target.revokeCatalogRole(
            principalRole.getName(), catalogName, catalogRoleName);
        clientLogger.info(
            "Revoked principal-role {} from catalog-role {} in catalog {}. - {}/{}",
            principalRole.getName(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to revoke principal-role {} from catalog-role {} in catalog {}. - {}/{}",
            principalRole.getName(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }
  }

  /** Sync catalogs across the source and target polaris instance. */
  public void syncCatalogs() {
    List<Catalog> catalogsSource;

    try {
      catalogsSource = source.listCatalogs();
      clientLogger.info("Listed {} catalogs from source.", catalogsSource.size());
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error("Failed to list catalogs from source.", e);
      return;
    }

    List<Catalog> catalogsTarget;

    try {
      catalogsTarget = target.listCatalogs();
      clientLogger.info("Listed {} catalogs from target.", catalogsTarget.size());
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error("Failed to list catalogs from target.", e);
      return;
    }

    SynchronizationPlan<Catalog> catalogSyncPlan =
        syncPlanner.planCatalogSync(catalogsSource, catalogsTarget);

    catalogSyncPlan
        .entitiesToSkip()
        .forEach(catalog -> clientLogger.info("Skipping catalog {}.", catalog.getName()));

    catalogSyncPlan
        .entitiesToSkipAndSkipChildren()
        .forEach(
            catalog ->
                clientLogger.info(
                    "Skipping catalog {} and all child entities.", catalog.getName()));

    catalogSyncPlan
        .entitiesNotModified()
        .forEach(
            catalog ->
                clientLogger.info(
                    "No change detected in catalog {}. Skipping.", catalog.getName()));

    int syncsCompleted = 0;
    int totalSyncsToComplete = totalSyncsToComplete(catalogSyncPlan);

    for (Catalog catalog : catalogSyncPlan.entitiesToCreate()) {
      try {
        target.createCatalog(catalog);
        clientLogger.info(
            "Created catalog {}. - {}/{}",
            catalog.getName(),
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to create catalog {}. - {}/{}",
            catalog.getName(),
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (Catalog catalog : catalogSyncPlan.entitiesToOverwrite()) {
      try {
        target.dropCatalogCascade(catalog.getName());
        target.createCatalog(catalog);
        clientLogger.info(
            "Overwrote catalog {}. - {}/{}",
            catalog.getName(),
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to overwrite catalog {}. - {}/{}",
            catalog.getName(),
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (Catalog catalog : catalogSyncPlan.entitiesToRemove()) {
      try {
        target.dropCatalogCascade(catalog.getName());
        clientLogger.info(
            "Removed catalog {}. - {}/{}",
            catalog.getName(),
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to remove catalog {}. - {}/{}",
            catalog.getName(),
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (Catalog catalog : catalogSyncPlan.entitiesToSyncChildren()) {

      try (IcebergCatalogService sourceIcebergCatalogService = source.initializeIcebergCatalogService(catalog.getName())) {
        clientLogger.info(
                "Initialized Iceberg REST catalog for Polaris catalog {} on source.",
                catalog.getName());

        try (IcebergCatalogService targetIcebergCatalogService = target.initializeIcebergCatalogService(catalog.getName())) {
          clientLogger.info(
                  "Initialized Iceberg REST catalog for Polaris catalog {} on target.",
                  catalog.getName());

          syncNamespaces(
                  catalog.getName(), Namespace.empty(), sourceIcebergCatalogService, targetIcebergCatalogService);
        }

      } catch (Exception e) {
        clientLogger.error(
                "Failed to synchronize Iceberg REST catalog for Polaris catalog {}.",
                catalog.getName(),
                e);
        if (haltOnFailure) throw new RuntimeException(e);
        continue;
      }

      // NOTE: Grants are synced on a per catalog role basis, so we need to ensure that catalog roles
      // are only synced AFTER Iceberg catalog entities, because they may depend on the Iceberg catalog
      // entities already existing
      syncCatalogRoles(catalog.getName());
    }
  }

  /**
   * Sync catalog roles across the source and polaris instance for a catalog.
   *
   * @param catalogName the catalog to sync roles for
   */
  public void syncCatalogRoles(String catalogName) {
    List<CatalogRole> catalogRolesSource;

    try {
      catalogRolesSource = source.listCatalogRoles(catalogName);
      clientLogger.info(
          "Listed {} catalog-roles for catalog {} from source.",
          catalogRolesSource.size(),
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list catalog-roles for catalog {} from source.", catalogName, e);
      return;
    }

    List<CatalogRole> catalogRolesTarget;

    try {
      catalogRolesTarget = target.listCatalogRoles(catalogName);
      clientLogger.info(
          "Listed {} catalog-roles for catalog {} from target.",
          catalogRolesTarget.size(),
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list catalog-roles for catalog {} from target.", catalogName, e);
      return;
    }

    SynchronizationPlan<CatalogRole> catalogRoleSyncPlan =
        syncPlanner.planCatalogRoleSync(catalogName, catalogRolesSource, catalogRolesTarget);

    catalogRoleSyncPlan
        .entitiesToSkip()
        .forEach(
            catalogRole ->
                clientLogger.info(
                    "Skipping catalog-role {} in catalog {}.", catalogRole.getName(), catalogName));

    catalogRoleSyncPlan
        .entitiesToSkipAndSkipChildren()
        .forEach(
            catalogRole ->
                clientLogger.info(
                    "Skipping catalog-role {} in catalog {} and all child entities.",
                    catalogRole.getName(),
                    catalogName));

    catalogRoleSyncPlan
        .entitiesNotModified()
        .forEach(
            catalogRole ->
                clientLogger.info(
                    "No change detected in catalog-role {} in catalog {}. Skipping.",
                    catalogRole.getName(),
                    catalogName));

    int syncsCompleted = 0;
    int totalSyncsToComplete = totalSyncsToComplete(catalogRoleSyncPlan);

    for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToCreate()) {
      try {
        target.createCatalogRole(catalogName, catalogRole);
        clientLogger.info(
            "Created catalog-role {} for catalog {}. - {}/{}",
            catalogRole.getName(),
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to create catalog-role {} for catalog {}. - {}/{}",
            catalogRole.getName(),
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToOverwrite()) {
      try {
        target.dropCatalogRole(catalogName, catalogRole.getName());
        target.createCatalogRole(catalogName, catalogRole);
        clientLogger.info(
            "Overwrote catalog-role {} for catalog {}. - {}/{}",
            catalogRole.getName(),
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to overwrite catalog-role {} for catalog {}. - {}/{}",
            catalogRole.getName(),
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToRemove()) {
      try {
        target.dropCatalogRole(catalogName, catalogRole.getName());
        clientLogger.info(
            "Removed catalog-role {} for catalog {}. - {}/{}",
            catalogRole.getName(),
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to remove catalog-role {} for catalog {}. - {}/{}",
            catalogRole.getName(),
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToSyncChildren()) {
      syncAssigneePrincipalRolesForCatalogRole(catalogName, catalogRole.getName());
      syncGrants(catalogName, catalogRole.getName());
    }
  }

  /**
   * Sync grants for a catalog role across the source and the target.
   *
   * @param catalogName
   * @param catalogRoleName
   */
  private void syncGrants(String catalogName, String catalogRoleName) {
    List<GrantResource> grantsSource;

    try {
      grantsSource = source.listGrants(catalogName, catalogRoleName);
      clientLogger.info(
          "Listed {} grants for catalog-role {} in catalog {} from source.",
          grantsSource.size(),
          catalogRoleName,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list grants for catalog-role {} in catalog {} from source.",
          catalogRoleName,
          catalogName,
          e);
      return;
    }

    List<GrantResource> grantsTarget;

    try {
      grantsTarget = target.listGrants(catalogName, catalogRoleName);
      clientLogger.info(
          "Listed {} grants for catalog-role {} in catalog {} from target.",
          grantsTarget.size(),
          catalogRoleName,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list grants for catalog-role {} in catalog {} from target.",
          catalogRoleName,
          catalogName,
          e);
      return;
    }

    SynchronizationPlan<GrantResource> grantSyncPlan =
        syncPlanner.planGrantSync(catalogName, catalogRoleName, grantsSource, grantsTarget);

    grantSyncPlan
        .entitiesToSkip()
        .forEach(
            grant ->
                clientLogger.info(
                    "Skipping addition of grant {} to catalog-role {} in catalog {}.",
                    grant.getType(),
                    catalogRoleName,
                    catalogName));

    grantSyncPlan
        .entitiesNotModified()
        .forEach(
            grant ->
                clientLogger.info(
                    "Grant {} was already added to catalog-role {} in catalog {}. Skipping.",
                    grant.getType(),
                    catalogRoleName,
                    catalogName));

    int syncsCompleted = 0;
    int totalSyncsToComplete = totalSyncsToComplete(grantSyncPlan);

    for (GrantResource grant : grantSyncPlan.entitiesToCreate()) {
      try {
        target.addGrant(catalogName, catalogRoleName, grant);
        clientLogger.info(
            "Added grant {} to catalog-role {} for catalog {}. - {}/{}",
            grant.getType(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to add grant {} to catalog-role {} for catalog {}. - {}/{}",
            grant.getType(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (GrantResource grant : grantSyncPlan.entitiesToOverwrite()) {
      try {
        target.addGrant(catalogName, catalogRoleName, grant);
        clientLogger.info(
            "Added grant {} to catalog-role {} for catalog {}. - {}/{}",
            grant.getType(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to add grant {} to catalog-role {} for catalog {}. - {}/{}",
            grant.getType(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (GrantResource grant : grantSyncPlan.entitiesToRemove()) {
      try {
        target.revokeGrant(catalogName, catalogRoleName, grant);
        clientLogger.info(
            "Revoked grant {} from catalog-role {} for catalog {}. - {}/{}",
            grant.getType(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to revoke grant {} from catalog-role {} for catalog {}. - {}/{}",
            grant.getType(),
            catalogRoleName,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }
  }

  /**
   * Sync namespaces contained within a parent namespace.
   *
   * @param catalogName
   * @param parentNamespace
   * @param sourceIcebergCatalogService
   * @param targetIcebergCatalogService
   */
  public void syncNamespaces(
      String catalogName,
      Namespace parentNamespace,
      IcebergCatalogService sourceIcebergCatalogService,
      IcebergCatalogService targetIcebergCatalogService) {
      List<Namespace> namespacesSource;

    try {
      namespacesSource = sourceIcebergCatalogService.listNamespaces(parentNamespace);
      clientLogger.info(
          "Listed {} namespaces in namespace {} for catalog {} from source.",
          namespacesSource.size(),
          parentNamespace,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list namespaces in namespace {} for catalog {} from source.",
          parentNamespace,
          catalogName,
          e);
      return;
    }

    List<Namespace> namespacesTarget;

    try {
      namespacesTarget = targetIcebergCatalogService.listNamespaces(parentNamespace);
      clientLogger.info(
          "Listed {} namespaces in namespace {} for catalog {} from target.",
          namespacesTarget.size(),
          parentNamespace,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list namespaces in namespace {} for catalog {} from target.",
          parentNamespace,
          catalogName,
          e);
      return;
    }

    SynchronizationPlan<Namespace> namespaceSynchronizationPlan =
        syncPlanner.planNamespaceSync(
            catalogName, parentNamespace, namespacesSource, namespacesTarget);

    int syncsCompleted = 0;
    int totalSyncsToComplete = totalSyncsToComplete(namespaceSynchronizationPlan);

    namespaceSynchronizationPlan
        .entitiesNotModified()
        .forEach(
            namespace ->
                clientLogger.info(
                    "No change detected for namespace {} in namespace {} for catalog {}, skipping.",
                    namespace,
                    parentNamespace,
                    catalogName));

    for (Namespace namespace : namespaceSynchronizationPlan.entitiesToCreate()) {
      try {
        Map<String, String> namespaceMetadata = sourceIcebergCatalogService.loadNamespaceMetadata(namespace);
        targetIcebergCatalogService.createNamespace(namespace, namespaceMetadata);
        clientLogger.info(
            "Created namespace {} in namespace {} for catalog {} - {}/{}",
            namespace,
            parentNamespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to create namespace {} in namespace {} for catalog {} - {}/{}",
            namespace,
            parentNamespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (Namespace namespace : namespaceSynchronizationPlan.entitiesToOverwrite()) {
      try {
        Map<String, String> sourceNamespaceMetadata =
            sourceIcebergCatalogService.loadNamespaceMetadata(namespace);

        if (this.diffOnly) {
          // if only configured to migrate the diff between the source and the target Polaris,
          // then we can load the target namespace metadata and perform a comparison to discontinue early
          // if we notice the metadata did not change

          Map<String, String> targetNamespaceMetadata =
                  targetIcebergCatalogService.loadNamespaceMetadata(namespace);

          if (sourceNamespaceMetadata.equals(targetNamespaceMetadata)) {
            clientLogger.info(
                    "Namespace metadata for namespace {} in namespace {} for catalog {} was not modified, skipping. - {}/{}",
                    namespace,
                    parentNamespace,
                    catalogName,
                    ++syncsCompleted,
                    totalSyncsToComplete);
            continue;
          }
        }

        targetIcebergCatalogService.setNamespaceProperties(namespace, sourceNamespaceMetadata);

        clientLogger.info(
            "Overwrote namespace metadata {} in namespace {} for catalog {} - {}/{}",
            namespace,
            parentNamespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to overwrite namespace metadata {} in namespace {} for catalog {} - {}/{}",
            namespace,
            parentNamespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (Namespace namespace : namespaceSynchronizationPlan.entitiesToRemove()) {
      try {
        targetIcebergCatalogService.dropNamespaceCascade(namespace);
        clientLogger.info(
            "Removed namespace {} in namespace {} for catalog {} - {}/{}",
            namespace,
            parentNamespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to remove namespace {} in namespace {} for catalog {} - {}/{}",
            namespace,
            parentNamespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (Namespace namespace : namespaceSynchronizationPlan.entitiesToSyncChildren()) {
      syncTables(catalogName, namespace, sourceIcebergCatalogService, targetIcebergCatalogService);
      syncNamespaces(catalogName, namespace, sourceIcebergCatalogService, targetIcebergCatalogService);
    }
  }

  /**
   * Sync tables contained within a namespace.
   *
   * @param catalogName
   * @param namespace
   * @param sourceIcebergCatalogService
   * @param targetIcebergCatalogService
   */
  public void syncTables(
      String catalogName,
      Namespace namespace,
      IcebergCatalogService sourceIcebergCatalogService,
      IcebergCatalogService targetIcebergCatalogService) {
    Set<TableIdentifier> sourceTables;

    try {
      sourceTables = new HashSet<>(sourceIcebergCatalogService.listTables(namespace));
      clientLogger.info(
          "Listed {} tables in namespace {} for catalog {} on source.",
          sourceTables.size(),
          namespace,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list tables in namespace {} for catalog {} on source.",
          namespace,
          catalogName,
          e);
      return;
    }

    Set<TableIdentifier> targetTables;

    try {
      targetTables = new HashSet<>(targetIcebergCatalogService.listTables(namespace));
      clientLogger.info(
          "Listed {} tables in namespace {} for catalog {} on target.",
          targetTables.size(),
          namespace,
          catalogName);
    } catch (Exception e) {
      if (haltOnFailure) throw e;
      clientLogger.error(
          "Failed to list tables in namespace {} for catalog {} on target.",
          namespace,
          catalogName,
          e);
      return;
    }

    SynchronizationPlan<TableIdentifier> tableSyncPlan =
        syncPlanner.planTableSync(catalogName, namespace, sourceTables, targetTables);

    tableSyncPlan
        .entitiesToSkip()
        .forEach(
            tableId ->
                clientLogger.info(
                    "Skipping table {} in namespace {} in catalog {}.",
                    tableId,
                    namespace,
                    catalogName));

    int syncsCompleted = 0;
    int totalSyncsToComplete = totalSyncsToComplete(tableSyncPlan);

    for (TableIdentifier tableId : tableSyncPlan.entitiesToCreate()) {
      try {
        Table table = sourceIcebergCatalogService.loadTable(tableId);

        if (table instanceof BaseTable baseTable) {
          targetIcebergCatalogService.registerTable(
              tableId, baseTable.operations().current().metadataFileLocation());
        } else {
          throw new IllegalStateException("Cannot register table that does not extend BaseTable.");
        }

        if (table instanceof BaseTableWithETag tableWithETag) {
          etagManager.storeETag(catalogName, tableId, tableWithETag.etag());
        }

        clientLogger.info(
            "Registered table {} in namespace {} in catalog {}. - {}/{}",
            tableId,
            namespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to register table {} in namespace {} in catalog {}. - {}/{}",
            tableId,
            namespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (TableIdentifier tableId : tableSyncPlan.entitiesToOverwrite()) {
      try {
        Table table;

        if (this.diffOnly && sourceIcebergCatalogService instanceof PolarisIcebergCatalogService polarisCatalogService) {
          String etag = etagManager.getETag(catalogName, tableId);
          table = polarisCatalogService.loadTable(tableId, etag);
        } else {
          table = sourceIcebergCatalogService.loadTable(tableId);
        }

        if (table instanceof BaseTable baseTable) {
          targetIcebergCatalogService.dropTableWithoutPurge(tableId);
          targetIcebergCatalogService.registerTable(
              tableId, baseTable.operations().current().metadataFileLocation());
        } else {
          throw new IllegalStateException("Cannot register table that does not extend BaseTable.");
        }

        if (table instanceof BaseTableWithETag tableWithETag) {
          etagManager.storeETag(catalogName, tableId, tableWithETag.etag());
        }

        clientLogger.info(
            "Dropped and re-registered table {} in namespace {} in catalog {}. - {}/{}",
            tableId,
            namespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (MetadataNotModifiedException e) {
        clientLogger.info(
            "Table {} in namespace {} in catalog {} with was not modified, not overwriting in target catalog. - {}/{}",
            tableId,
            namespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.error(
            "Failed to drop and re-register table {} in namespace {} in catalog {}. - {}/{}",
            tableId,
            namespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }

    for (TableIdentifier table : tableSyncPlan.entitiesToRemove()) {
      try {
        targetIcebergCatalogService.dropTableWithoutPurge(table);
        clientLogger.info(
            "Dropped table {} in namespace {} in catalog {}. - {}/{}",
            table,
            namespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete);
      } catch (Exception e) {
        if (haltOnFailure) throw e;
        clientLogger.info(
            "Failed to drop table {} in namespace {} in catalog {}. - {}/{}",
            table,
            namespace,
            catalogName,
            ++syncsCompleted,
            totalSyncsToComplete,
            e);
      }
    }
  }
}
