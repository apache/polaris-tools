/*
 * Copyright (C) 2025 Dremio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.polaris.tools.sync.polaris;

import org.apache.iceberg.BaseTable;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.SupportsNamespaces;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.access.AccessControlService;
import org.apache.polaris.tools.sync.polaris.catalog.BaseTableWithETag;
import org.apache.polaris.tools.sync.polaris.catalog.ETagService;
import org.apache.polaris.tools.sync.polaris.catalog.NotModifiedException;
import org.apache.polaris.tools.sync.polaris.catalog.PolarisCatalog;
import org.apache.polaris.tools.sync.polaris.planning.SynchronizationPlanner;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Encapsulates idempotent and failure-safe logic to perform Polaris entity syncs. Performs logging with configurability
 * and all actions related to the generated sync plans.
 */
public class PolarisSynchronizer {

    private final Logger clientLogger;

    private final SynchronizationPlanner syncPlanner;

    private final PolarisService source;

    private final PolarisService target;

    private final PrincipalWithCredentials sourceOmnipotentPrincipal;

    private final PrincipalWithCredentials targetOmnipotentPrincipal;

    private final PrincipalRole sourceOmnipotentPrincipalRole;

    private final PrincipalRole targetOmnipotentPrincipalRole;

    private final AccessControlService sourceAccessControlService;

    private final AccessControlService targetAccessControlService;

    private final ETagService etagService;

    public PolarisSynchronizer(
            Logger clientLogger,
            SynchronizationPlanner synchronizationPlanner,
            PrincipalWithCredentials sourceOmnipotentPrincipal,
            PrincipalWithCredentials targetOmnipotentPrincipal,
            PolarisService source,
            PolarisService target,
            ETagService eTagService
    ) {
        this.clientLogger = clientLogger == null ? LoggerFactory.getLogger(PolarisSynchronizer.class) : clientLogger;
        this.syncPlanner = synchronizationPlanner;
        this.sourceOmnipotentPrincipal = sourceOmnipotentPrincipal;
        this.targetOmnipotentPrincipal = targetOmnipotentPrincipal;
        this.source = source;
        this.target = target;
        this.sourceAccessControlService = new AccessControlService(source);
        this.targetAccessControlService = new AccessControlService(target);

        this.sourceOmnipotentPrincipalRole = sourceAccessControlService.getOmnipotentPrincipalRoleForPrincipal(
                sourceOmnipotentPrincipal.getPrincipal().getName());
        this.targetOmnipotentPrincipalRole = targetAccessControlService.getOmnipotentPrincipalRoleForPrincipal(
                targetOmnipotentPrincipal.getPrincipal().getName());
        this.etagService = eTagService;
    }

    /**
     * Calculates the total number of sync tasks to complete
     * @param plan the plan to scan for cahnges
     * @return the nuber of syncs to perform
     */
    private int totalSyncsToComplete(SynchronizationPlan<?> plan) {
        return plan.entitiesToCreate().size() + plan.entitiesToOverwrite().size() + plan.entitiesToRemove().size();
    }

    /**
     * Sync principal roles from source to target
     */
    public void syncPrincipalRoles() {
        List<PrincipalRole> principalRolesSource;

        try {
            principalRolesSource = source.listPrincipalRoles();
            clientLogger.info("Listed {} principal-roles from source.", principalRolesSource.size());
        } catch (Exception e) {
            clientLogger.error("Failed to list principal-roles from source.", e);
            return;
        }

        List<PrincipalRole> principalRolesTarget;

        try {
            principalRolesTarget = target.listPrincipalRoles();
            clientLogger.info("Listed {} principal-roles from target.", principalRolesTarget.size());
        } catch (Exception e) {
            clientLogger.error("Failed to list principal-roles from target.", e);
            return;
        }

        SynchronizationPlan<PrincipalRole> principalRoleSyncPlan = syncPlanner.planPrincipalRoleSync(principalRolesSource, principalRolesTarget);

        principalRoleSyncPlan.entitiesToSkip().forEach(principalRole ->
                clientLogger.info("Skipping principal-role {}.", principalRole.getName()));

        principalRoleSyncPlan.entitiesNotModified().forEach(principalRole ->
                clientLogger.info("No change detected for principal-role {}, skipping.", principalRole.getName()));

        int syncsCompleted = 0;
        final int totalSyncsToComplete = totalSyncsToComplete(principalRoleSyncPlan);

        for (PrincipalRole principalRole : principalRoleSyncPlan.entitiesToCreate()) {
            try {
                target.createPrincipalRole(principalRole, false);
                clientLogger.info("Created principal-role {} on target. - {}/{}", principalRole.getName(), ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to create principal-role {} on target. - {}/{}", principalRole.getName(), ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (PrincipalRole principalRole : principalRoleSyncPlan.entitiesToOverwrite()) {
            try {
                target.createPrincipalRole(principalRole, true);
                clientLogger.info("Overwrote principal-role {} on target. - {}/{}", principalRole.getName(), ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to overwrite principal-role {} on target. - {}/{}", principalRole.getName(), ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (PrincipalRole principalRole : principalRoleSyncPlan.entitiesToRemove()) {
            try {
                target.removePrincipalRole(principalRole.getName());
                clientLogger.info("Removed principal-role {} on target. - {}/{}", principalRole.getName(), ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to remove principal-role {} on target. - {}/{}", principalRole.getName(), ++syncsCompleted, totalSyncsToComplete, e);
            }
        }
    }

    /**
     * Sync assignments of principal roles to a catalog role
     * @param catalogName the catalog that the catalog role is in
     * @param catalogRoleName the name of the catalog role
     */
    public void syncAssigneePrincipalRolesForCatalogRole(String catalogName, String catalogRoleName) {
        List<PrincipalRole> principalRolesSource;

        try {
            principalRolesSource = source.listAssigneePrincipalRolesForCatalogRole(catalogName, catalogRoleName);
            clientLogger.info("Listed {} assignee principal-roles for catalog-role {} in catalog {} from source.",
                    principalRolesSource.size(), catalogRoleName, catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list assignee principal-roles for catalog-role {} in catalog {} from source.", catalogRoleName, catalogName, e);
            return;
        }

        List<PrincipalRole> principalRolesTarget;

        try {
            principalRolesTarget = target.listAssigneePrincipalRolesForCatalogRole(catalogName, catalogRoleName);
            clientLogger.info("Listed {} assignee principal-roles for catalog-role {} in catalog {} from target.",
                    principalRolesTarget.size(), catalogRoleName, catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list assignee principal-roles for catalog-role {} in catalog {} from target.", catalogRoleName, catalogName, e);
            return;
        }

        SynchronizationPlan<PrincipalRole> assignedPrincipalRoleSyncPlan = syncPlanner.planAssignPrincipalRolesToCatalogRolesSync(
                catalogName, catalogRoleName, principalRolesSource, principalRolesTarget);

        assignedPrincipalRoleSyncPlan.entitiesToSkip().forEach(principalRole ->
                clientLogger.info("Skipping assignment of principal-role {} to catalog-role {} in catalog {}.",
                        principalRole.getName(), catalogRoleName, catalogName));

        assignedPrincipalRoleSyncPlan.entitiesNotModified().forEach(principalRole ->
                clientLogger.info("Principal-role {} is already assigned to catalog-role {} in catalog {}. Skipping.",
                        principalRole.getName(), catalogRoleName, catalogName));

        int syncsCompleted = 0;
        int totalSyncsToComplete = totalSyncsToComplete(assignedPrincipalRoleSyncPlan);

        for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToCreate()) {
            try {
                target.assignCatalogRoleToPrincipalRole(principalRole.getName(), catalogName, catalogRoleName);
                clientLogger.info("Assigned principal-role {} to catalog-role {} in catalog {}. - {}/{}",
                        principalRole.getName(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to assign principal-role {} to catalog-role {} in catalog {}. - {}/{}",
                        principalRole.getName(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToOverwrite()) {
            try {
                target.assignCatalogRoleToPrincipalRole(principalRole.getName(), catalogName, catalogRoleName);
                clientLogger.info("Assigned principal-role {} to catalog-role {} in catalog {}. - {}/{}",
                        principalRole.getName(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to assign principal-role {} to catalog-role {} in catalog {}. - {}/{}",
                        principalRole.getName(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (PrincipalRole principalRole : assignedPrincipalRoleSyncPlan.entitiesToRemove()) {
            try {
                target.removeCatalogRoleFromPrincipalRole(principalRole.getName(), catalogName, catalogRoleName);
                clientLogger.info("Revoked principal-role {} from catalog-role {} in catalog {}. - {}/{}",
                        principalRole.getName(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to revoke principal-role {} from catalog-role {} in catalog {}. - {}/{}",
                        principalRole.getName(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }
    }

    /**
     * Sync catalogs across the source and target polaris instance
     */
    public void syncCatalogs() {
        List<Catalog> catalogsSource;

        try {
            catalogsSource = source.listCatalogs();
            clientLogger.info("Listed {} catalogs from source.", catalogsSource.size());
        } catch (Exception e) {
            clientLogger.error("Failed to list catalogs from source.", e);
            return;
        }

        List<Catalog> catalogsTarget;

        try {
            catalogsTarget = target.listCatalogs();
            clientLogger.info("Listed {} catalogs from target.", catalogsTarget.size());
        } catch (Exception e) {
            clientLogger.error("Failed to list catalogs from target.", e);
            return;
        }

        SynchronizationPlan<Catalog> catalogSyncPlan = syncPlanner.planCatalogSync(catalogsSource, catalogsTarget);

        catalogSyncPlan.entitiesToSkip().forEach(catalog ->
                clientLogger.info("Skipping catalog {}.", catalog.getName()));

        catalogSyncPlan.entitiesToSkipAndSkipChildren().forEach(catalog ->
                clientLogger.info("Skipping catalog {} and all child entities.", catalog.getName()));

        catalogSyncPlan.entitiesNotModified().forEach(catalog ->
                clientLogger.info("No change detected in catalog {}. Skipping.", catalog.getName()));

        int syncsCompleted = 0;
        int totalSyncsToComplete = totalSyncsToComplete(catalogSyncPlan);

        for (Catalog catalog : catalogSyncPlan.entitiesToCreate()) {
            try {
                target.createCatalog(catalog);
                clientLogger.info("Created catalog {}. - {}/{}", catalog.getName(), ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to create catalog {}. - {}/{}", catalog.getName(), ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (Catalog catalog : catalogSyncPlan.entitiesToOverwrite()) {
            try {
                setupOmnipotentCatalogRoleIfNotExistsTarget(catalog.getName());
                target.overwriteCatalog(catalog, targetOmnipotentPrincipal);
                clientLogger.info("Overwrote catalog {}. - {}/{}", catalog.getName(), ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to overwrite catalog {}. - {}/{}", catalog.getName(), ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (Catalog catalog : catalogSyncPlan.entitiesToRemove()) {
            try {
                setupOmnipotentCatalogRoleIfNotExistsTarget(catalog.getName());
                target.removeCatalogCascade(catalog.getName(), targetOmnipotentPrincipal);
                clientLogger.info("Removed catalog {}. - {}/{}", catalog.getName(), ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to remove catalog {}. - {}/{}", catalog.getName(), ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (Catalog catalog : catalogSyncPlan.entitiesToSyncChildren()) {
            syncCatalogRoles(catalog.getName());

            org.apache.iceberg.catalog.Catalog sourceIcebergCatalog;

            try {
                sourceIcebergCatalog = initializeIcebergCatalogSource(catalog.getName());
                clientLogger.info("Initialized Iceberg REST catalog for Polaris catalog {} on source.", catalog.getName());
            } catch (Exception e) {
                clientLogger.error("Failed to initialize Iceberg REST catalog for Polaris catalog {} on source.", catalog.getName(), e);
                continue;
            }

            org.apache.iceberg.catalog.Catalog targetIcebergCatalog;

            try {
                targetIcebergCatalog = initializeIcebergCatalogTarget(catalog.getName());
                clientLogger.info("Initialized Iceberg REST catalog for Polaris catalog {} on target.", catalog.getName());
            } catch (Exception e) {
                clientLogger.error("Failed to initialize Iceberg REST catalog for Polaris catalog {} on target.", catalog.getName(), e);
                continue;
            }

            syncNamespaces(catalog.getName(), Namespace.empty(), sourceIcebergCatalog, targetIcebergCatalog);
        }
    }

    /**
     * Sync catalog roles across the source and polaris instance for a catalog
     * @param catalogName the catalog to sync roles for
     */
    public void syncCatalogRoles(String catalogName) {
        List<CatalogRole> catalogRolesSource;

        try {
            catalogRolesSource = source.listCatalogRoles(catalogName);
            clientLogger.info("Listed {} catalog-roles for catalog {} from source.", catalogRolesSource.size(), catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list catalog-roles for catalog {} from source.", catalogName, e);
            return;
        }

        List<CatalogRole> catalogRolesTarget;

        try {
            catalogRolesTarget = target.listCatalogRoles(catalogName);
            clientLogger.info("Listed {} catalog-roles for catalog {} from target.", catalogRolesTarget.size(), catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list catalog-roles for catalog {} from target.", catalogName, e);
            return;
        }

        SynchronizationPlan<CatalogRole> catalogRoleSyncPlan = syncPlanner.planCatalogRoleSync(catalogName, catalogRolesSource, catalogRolesTarget);

        catalogRoleSyncPlan.entitiesToSkip().forEach(catalogRole ->
                clientLogger.info("Skipping catalog-role {} in catalog {}.", catalogRole.getName(), catalogName));

        catalogRoleSyncPlan.entitiesToSkipAndSkipChildren().forEach(catalogRole ->
                clientLogger.info("Skipping catalog-role {} in catalog {} and all child entities.", catalogRole.getName(), catalogName));

        catalogRoleSyncPlan.entitiesNotModified().forEach(catalogRole ->
                clientLogger.info("No change detected in catalog-role {} in catalog {}. Skipping.", catalogRole.getName(), catalogName));

        int syncsCompleted = 0;
        int totalSyncsToComplete = totalSyncsToComplete(catalogRoleSyncPlan);

        for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToCreate()) {
            try {
                target.createCatalogRole(catalogName, catalogRole, false);
                clientLogger.info("Created catalog-role {} for catalog {}. - {}/{}", catalogRole.getName(), catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to create catalog-role {} for catalog {}. - {}/{}", catalogRole.getName(), catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToOverwrite()) {
            try {
                target.createCatalogRole(catalogName, catalogRole, true);
                clientLogger.info("Overwrote catalog-role {} for catalog {}. - {}/{}", catalogRole.getName(), catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to overwrite catalog-role {} for catalog {}. - {}/{}", catalogRole.getName(), catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToRemove()) {
            try {
                target.removeCatalogRole(catalogName, catalogRole.getName());
                clientLogger.info("Removed catalog-role {} for catalog {}. - {}/{}", catalogRole.getName(), catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to remove catalog-role {} for catalog {}. - {}/{}", catalogRole.getName(), catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (CatalogRole catalogRole : catalogRoleSyncPlan.entitiesToSyncChildren()) {
            syncAssigneePrincipalRolesForCatalogRole(catalogName, catalogRole.getName());
            syncGrants(catalogName, catalogRole.getName());
        }
    }

    /**
     * Sync grants for a catalog role across the source and the target
     * @param catalogName
     * @param catalogRoleName
     */
    private void syncGrants(String catalogName, String catalogRoleName) {
        List<GrantResource> grantsSource;

        try {
            grantsSource = source.listGrants(catalogName, catalogRoleName);
            clientLogger.info("Listed {} grants for catalog-role {} in catalog {} from source.",
                    grantsSource.size(), catalogRoleName, catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list grants for catalog-role {} in catalog {} from source.",
                    catalogRoleName, catalogName, e);
            return;
        }

        List<GrantResource> grantsTarget;

        try {
            grantsTarget = target.listGrants(catalogName, catalogRoleName);
            clientLogger.info("Listed {} grants for catalog-role {} in catalog {} from target.",
                    grantsTarget.size(), catalogRoleName, catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list grants for catalog-role {} in catalog {} from target.",
                    catalogRoleName, catalogName, e);
            return;
        }

        SynchronizationPlan<GrantResource> grantSyncPlan = syncPlanner.planGrantSync(catalogName, catalogRoleName, grantsSource, grantsTarget);

        grantSyncPlan.entitiesToSkip().forEach(grant ->
                clientLogger.info("Skipping addition of grant {} to catalog-role {} in catalog {}.",
                        grant.getType(), catalogRoleName, catalogName));

        grantSyncPlan.entitiesNotModified().forEach(grant ->
                clientLogger.info("Grant {} was already added to catalog-role {} in catalog {}. Skipping.",
                        grant.getType(), catalogRoleName, catalogName));

        int syncsCompleted = 0;
        int totalSyncsToComplete = totalSyncsToComplete(grantSyncPlan);

        for (GrantResource grant : grantSyncPlan.entitiesToCreate()) {
            try {
                target.addGrant(catalogName, catalogRoleName, grant);
                clientLogger.info("Added grant {} to catalog-role {} for catalog {}. - {}/{}",
                        grant.getType(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to add grant {} to catalog-role {} for catalog {}. - {}/{}",
                        grant.getType(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (GrantResource grant : grantSyncPlan.entitiesToOverwrite()) {
            try {
                target.addGrant(catalogName, catalogRoleName, grant);
                clientLogger.info("Added grant {} to catalog-role {} for catalog {}. - {}/{}",
                        grant.getType(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to add grant {} to catalog-role {} for catalog {}. - {}/{}",
                        grant.getType(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (GrantResource grant : grantSyncPlan.entitiesToRemove()) {
            try {
                target.revokeGrant(catalogName, catalogRoleName, grant);
                clientLogger.info("Revoked grant {} from catalog-role {} for catalog {}. - {}/{}",
                        grant.getType(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to revoke grant {} from catalog-role {} for catalog {}. - {}/{}",
                        grant.getType(), catalogRoleName, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }
    }

    /**
     * Setup an omnipotent principal for the provided catalog on the source Polaris instance
     * @param catalogName
     */
    private void setupOmnipotentCatalogRoleIfNotExistsTarget(String catalogName) {
        if (!this.targetAccessControlService.omnipotentCatalogRoleExists(catalogName)) {
            clientLogger.info("No omnipotent catalog-role exists for catalog {} on target. Going to set one up.", catalogName);

            targetAccessControlService.setupOmnipotentRoleForCatalog(
                    catalogName, targetOmnipotentPrincipalRole, false, true);

            clientLogger.info("Setup omnipotent catalog-role for catalog {} on target.", catalogName);
        }
    }

    /**
     * Setup an omnipotent principal for the provided catalog on the target Polaris instance
     * @param catalogName
     */
    private void setupOmnipotentCatalogRoleIfNotExistsSource(String catalogName) {
        if (!this.sourceAccessControlService.omnipotentCatalogRoleExists(catalogName)) {
            clientLogger.info("No omnipotent catalog-role exists for catalog {} on source. Going to set one up.", catalogName);

            sourceAccessControlService.setupOmnipotentRoleForCatalog(
                    catalogName, sourceOmnipotentPrincipalRole, false, false);

            clientLogger.info("Setup omnipotent catalog-role for catalog {} on source.", catalogName);
        }
    }

    public org.apache.iceberg.catalog.Catalog initializeIcebergCatalogSource(String catalogName) {
        setupOmnipotentCatalogRoleIfNotExistsSource(catalogName);
        return source.initializeCatalog(catalogName, sourceOmnipotentPrincipal);
    }

    public org.apache.iceberg.catalog.Catalog initializeIcebergCatalogTarget(String catalogName) {
        setupOmnipotentCatalogRoleIfNotExistsTarget(catalogName);
        return target.initializeCatalog(catalogName, targetOmnipotentPrincipal);
    }

    /**
     * Sync namespaces contained within a parent namespace
     * @param catalogName
     * @param parentNamespace
     * @param sourceIcebergCatalog
     * @param targetIcebergCatalog
     */
    public void syncNamespaces(
            String catalogName,
            Namespace parentNamespace,
            org.apache.iceberg.catalog.Catalog sourceIcebergCatalog,
            org.apache.iceberg.catalog.Catalog targetIcebergCatalog
    ) {
        // no namespaces to sync if catalog does not implement SupportsNamespaces
        if (
                sourceIcebergCatalog instanceof SupportsNamespaces sourceNamespaceCatalog
                        && targetIcebergCatalog instanceof SupportsNamespaces targetNamespaceCatalog
        )
        {
            List<Namespace> namespacesSource;

            try {
                namespacesSource = sourceNamespaceCatalog.listNamespaces(parentNamespace);
                clientLogger.info("Listed {} namespaces in namespace {} for catalog {} from source.", namespacesSource.size(), parentNamespace, catalogName);
            } catch (Exception e) {
                clientLogger.error("Failed to list namespaces in namespace {} for catalog {} from source.", parentNamespace, catalogName, e);
                return;
            }

            List<Namespace> namespacesTarget;

            try {
                namespacesTarget = targetNamespaceCatalog.listNamespaces(parentNamespace);
                clientLogger.info("Listed {} namespaces in namespace {} for catalog {} from target.", namespacesTarget.size(), parentNamespace, catalogName);
            } catch (Exception e) {
                clientLogger.error("Failed to list namespaces in namespace {} for catalog {} from target.", parentNamespace, catalogName, e);
                return;
            }

            SynchronizationPlan<Namespace> namespaceSynchronizationPlan = syncPlanner.planNamespaceSync(catalogName, parentNamespace, namespacesSource, namespacesTarget);

            int syncsCompleted = 0;
            int totalSyncsToComplete = totalSyncsToComplete(namespaceSynchronizationPlan);

            namespaceSynchronizationPlan.entitiesNotModified().forEach(namespace ->
                    clientLogger.info("No change detected for namespace {} in namespace {} for catalog {}, skipping.", namespace, parentNamespace, catalogName));

            for (Namespace namespace : namespaceSynchronizationPlan.entitiesToCreate()) {
                try {
                    targetNamespaceCatalog.createNamespace(namespace);
                    clientLogger.info("Created namespace {} in namespace {} for catalog {} - {}/{}",
                            namespace, parentNamespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
                } catch (Exception e) {
                    clientLogger.error("Failed to create namespace {} in namespace {} for catalog {} - {}/{}",
                            namespace, parentNamespace, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
                }
            }

            for (Namespace namespace : namespaceSynchronizationPlan.entitiesToOverwrite()) {
                try {
                    Map<String, String> sourceNamespaceMetadata = sourceNamespaceCatalog.loadNamespaceMetadata(namespace);
                    Map<String, String> targetNamespaceMetadata = targetNamespaceCatalog.loadNamespaceMetadata(namespace);

                    if (sourceNamespaceMetadata.equals(targetNamespaceMetadata)) {
                        clientLogger.info("Namespace metadata for namespace {} in namespace {} for catalog {} was not modified, skipping. - {}/{}",
                                namespace, parentNamespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
                        continue;
                    }

                    target.dropNamespaceCascade(targetIcebergCatalog, namespace);
                    targetNamespaceCatalog.createNamespace(namespace, sourceNamespaceMetadata);

                    clientLogger.info("Overwrote namespace {} in namespace {} for catalog {} - {}/{}",
                            namespace, parentNamespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
                } catch (Exception e) {
                    clientLogger.error("Failed to overwrite namespace {} in namespace {} for catalog {} - {}/{}",
                            namespace, parentNamespace, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
                }
            }

            for (Namespace namespace : namespaceSynchronizationPlan.entitiesToRemove()) {
                try {
                    target.dropNamespaceCascade(targetIcebergCatalog, namespace);
                    clientLogger.info("Removed namespace {} in namespace {} for catalog {} - {}/{}",
                            namespace, parentNamespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
                } catch (Exception e) {
                    clientLogger.error("Failed to remove namespace {} in namespace {} for catalog {} - {}/{}",
                            namespace, parentNamespace, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
                }
            }

            for (Namespace namespace : namespaceSynchronizationPlan.entitiesToSyncChildren()) {
                syncTables(catalogName, namespace, sourceIcebergCatalog, targetIcebergCatalog);
                syncNamespaces(catalogName, namespace, sourceIcebergCatalog, targetIcebergCatalog);
            }
        }
    }

    /**
     * Sync tables contained within a namespace
     * @param catalogName
     * @param namespace
     * @param sourceIcebergCatalog
     * @param targetIcebergCatalog
     */
    public void syncTables(
            String catalogName,
            Namespace namespace,
            org.apache.iceberg.catalog.Catalog sourceIcebergCatalog,
            org.apache.iceberg.catalog.Catalog targetIcebergCatalog
    ) {
        Set<TableIdentifier> sourceTables;

        try {
            sourceTables = new HashSet<>(sourceIcebergCatalog.listTables(namespace));
            clientLogger.info("Listed {} tables in namespace {} for catalog {} on source.", sourceTables.size(), namespace, catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list tables in namespace {} for catalog {} on source.", namespace, catalogName, e);
            return;
        }

        Set<TableIdentifier> targetTables;

        try {
            targetTables = new HashSet<>(targetIcebergCatalog.listTables(namespace));
            clientLogger.info("Listed {} tables in namespace {} for catalog {} on target.", targetTables.size(), namespace, catalogName);
        } catch (Exception e) {
            clientLogger.error("Failed to list tables in namespace {} for catalog {} on target.", namespace, catalogName, e);
            return;
        }

        SynchronizationPlan<TableIdentifier> tableSyncPlan = syncPlanner.planTableSync(catalogName, namespace, sourceTables, targetTables);

        tableSyncPlan.entitiesToSkip().forEach(tableId ->
                clientLogger.info("Skipping table {} in namespace {} in catalog {}.", tableId, namespace, catalogName));

        int syncsCompleted = 0;
        int totalSyncsToComplete = totalSyncsToComplete(tableSyncPlan);

        for (TableIdentifier tableId : tableSyncPlan.entitiesToCreate()) {
            try {
                Table table = sourceIcebergCatalog.loadTable(tableId);

                if (table instanceof BaseTable baseTable) {
                    targetIcebergCatalog.registerTable(tableId, baseTable.operations().current().metadataFileLocation());
                } else {
                    throw new IllegalStateException("Cannot register table that does not extend BaseTable.");
                }

                if (table instanceof BaseTableWithETag tableWithETag) {
                    etagService.storeETag(catalogName, tableId, tableWithETag.eTag());
                }

                clientLogger.info("Registered table {} in namespace {} in catalog {}. - {}/{}", tableId, namespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to register table {} in namespace {} in catalog {}. - {}/{}", tableId, namespace, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (TableIdentifier tableId : tableSyncPlan.entitiesToOverwrite()) {
            try {
                Table table;

                if (sourceIcebergCatalog instanceof PolarisCatalog polarisCatalog) {
                    String etag = etagService.getETag(catalogName, tableId);
                    table = polarisCatalog.loadTable(tableId, etag);
                } else {
                    table = sourceIcebergCatalog.loadTable(tableId);
                }

                if (table instanceof BaseTable baseTable) {
                    targetIcebergCatalog.dropTable(tableId, /* purge */ false);
                    targetIcebergCatalog.registerTable(tableId, baseTable.operations().current().metadataFileLocation());
                } else {
                    throw new IllegalStateException("Cannot register table that does not extend BaseTable.");
                }

                if (table instanceof BaseTableWithETag tableWithETag) {
                    etagService.storeETag(catalogName, tableId, tableWithETag.eTag());
                }

                clientLogger.info("Dropped and re-registered table {} in namespace {} in catalog {}. - {}/{}", tableId, namespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (NotModifiedException e) {
                clientLogger.info("Table {} in namespace {} in catalog {} with was not modified, not overwriting in target catalog. - {}/{}", tableId, namespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.error("Failed to drop and re-register table {} in namespace {} in catalog {}. - {}/{}", tableId, namespace, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }

        for (TableIdentifier table : tableSyncPlan.entitiesToRemove()) {
            try {
                targetIcebergCatalog.dropTable(table, /* purge */ false);
                clientLogger.info("Dropped table {} in namespace {} in catalog {}. - {}/{}", table, namespace, catalogName, ++syncsCompleted, totalSyncsToComplete);
            } catch (Exception e) {
                clientLogger.info("Failed to drop table {} in namespace {} in catalog {}. - {}/{}", table, namespace, catalogName, ++syncsCompleted, totalSyncsToComplete, e);
            }
        }
    }

}
