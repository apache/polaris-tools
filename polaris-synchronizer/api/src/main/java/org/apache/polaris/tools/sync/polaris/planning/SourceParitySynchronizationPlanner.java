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

package org.apache.polaris.tools.sync.polaris.planning;

import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Sync planner that attempts to create total parity between the source and target Polaris instances.
 * This involves creating new entities, overwriting entities that exist on both source and target,
 * and removing entities that exist only on the target.
 */
public class SourceParitySynchronizationPlanner implements SynchronizationPlanner {

    @Override
    public SynchronizationPlan<PrincipalRole> planPrincipalRoleSync(List<PrincipalRole> principalRolesOnSource, List<PrincipalRole> principalRolesOnTarget) {
        Set<String> sourcePrincipalRoleNames = principalRolesOnSource.stream().map(PrincipalRole::getName).collect(Collectors.toSet());
        Set<String> targetPrincipalRoleNames = principalRolesOnTarget.stream().map(PrincipalRole::getName).collect(Collectors.toSet());

        SynchronizationPlan<PrincipalRole> plan = new SynchronizationPlan<>();

        for (PrincipalRole principalRole : principalRolesOnSource) {
            if (targetPrincipalRoleNames.contains(principalRole.getName())) {
                // overwrite roles that exist on both
                plan.overwriteEntity(principalRole);
            } else {
                // create roles on target that only exist on source
                plan.createEntity(principalRole);
            }
        }

        // remove roles that aren't on source
        for (PrincipalRole principalRole : principalRolesOnTarget) {
            if (!sourcePrincipalRoleNames.contains(principalRole.getName())) {
                plan.removeEntity(principalRole);
            }
        }

        return plan;
    }

    @Override
    public SynchronizationPlan<Catalog> planCatalogSync(List<Catalog> catalogsOnSource, List<Catalog> catalogsOnTarget) {
        Set<String> sourceCatalogNames = catalogsOnSource.stream().map(Catalog::getName).collect(Collectors.toSet());
        Set<String> targetCatalogNames = catalogsOnTarget.stream().map(Catalog::getName).collect(Collectors.toSet());

        SynchronizationPlan<Catalog> plan = new SynchronizationPlan<>();

        for (Catalog catalog : catalogsOnSource) {
            if (targetCatalogNames.contains(catalog.getName())) {
                // overwrite catalogs on target that exist on both
                plan.overwriteEntity(catalog);
            } else {
                // create catalogs on target that exist only on source
                plan.createEntity(catalog);
            }
        }

        // remove catalogs that are only on target
        for (Catalog catalog : catalogsOnTarget) {
            if (!sourceCatalogNames.contains(catalog.getName())) {
                plan.removeEntity(catalog);
            }
        }

        return plan;
    }

    @Override
    public SynchronizationPlan<CatalogRole> planCatalogRoleSync(String catalogName, List<CatalogRole> catalogRolesOnSource, List<CatalogRole> catalogRolesOnTarget) {
        Set<String> sourceCatalogRoleNames = catalogRolesOnSource.stream().map(CatalogRole::getName).collect(Collectors.toSet());
        Set<String> targetCatalogRoleNames = catalogRolesOnTarget.stream().map(CatalogRole::getName).collect(Collectors.toSet());

        SynchronizationPlan<CatalogRole> plan = new SynchronizationPlan<>();

        for (CatalogRole catalogRole : catalogRolesOnSource) {
            if (targetCatalogRoleNames.contains(catalogRole.getName())) {
                plan.overwriteEntity(catalogRole);
                // overwrite catalog roles on both
            } else {
                // create catalog roles on target that are only on source
                plan.createEntity(catalogRole);
            }
        }

        // remove catalog roles on both the source and target
        for (CatalogRole catalogRole : catalogRolesOnTarget) {
            if (!sourceCatalogRoleNames.contains(catalogRole.getName())) {
                plan.removeEntity(catalogRole);
            }
        }

        return plan;
    }

    @Override
    public SynchronizationPlan<GrantResource> planGrantSync(String catalogName, String catalogRoleName, List<GrantResource> grantsOnSource, List<GrantResource> grantsOnTarget) {
        Set<GrantResource> grantsSourceSet = Set.copyOf(grantsOnSource);
        Set<GrantResource> grantsTargetSet = Set.copyOf(grantsOnTarget);

        SynchronizationPlan<GrantResource> plan = new SynchronizationPlan<>();

        // special case: no concept of overwriting a grant
        // it exists and cannot change, so just create new ones
        for (GrantResource grant : grantsOnSource) {
            if (!grantsTargetSet.contains(grant)) {
                plan.createEntity(grant);
            }
        }

        // remove grants that are not on the source
        for (GrantResource grant : grantsOnTarget) {
            if (!grantsSourceSet.contains(grant)) {
                plan.removeEntity(grant);
            }
        }

        return plan;
    }

    @Override
    public SynchronizationPlan<PrincipalRole> planAssignPrincipalRolesToCatalogRolesSync(String catalogName, String catalogRoleName, List<PrincipalRole> assignedPrincipalRolesOnSource, List<PrincipalRole> assignedPrincipalRolesOnTarget) {
        Set<String> sourcePrincipalRoleNames = assignedPrincipalRolesOnSource.stream().map(PrincipalRole::getName).collect(Collectors.toSet());
        Set<String> targetPrincipalRoleNames = assignedPrincipalRolesOnTarget.stream().map(PrincipalRole::getName).collect(Collectors.toSet());

        SynchronizationPlan<PrincipalRole> plan = new SynchronizationPlan<>();

        // special case: no concept of overwriting an assignment of principal role to catalog role
        // it either exists or it doesn't, it cannot change
        for (PrincipalRole principalRole : assignedPrincipalRolesOnSource) {
            if (!targetPrincipalRoleNames.contains(principalRole.getName())) {
                plan.createEntity(principalRole);
            }
        }

        // revoke principal roles that do not exist on the source
        for (PrincipalRole principalRole : assignedPrincipalRolesOnTarget) {
            if (!sourcePrincipalRoleNames.contains(principalRole.getName())) {
                plan.removeEntity(principalRole);
            }
        }

        return plan;
    }

    @Override
    public SynchronizationPlan<Namespace> planNamespaceSync(String catalogName, Namespace namespace, List<Namespace> namespacesOnSource, List<Namespace> namespacesOnTarget) {
        SynchronizationPlan<Namespace> plan = new SynchronizationPlan<>();

        for (Namespace ns : namespacesOnSource) {
            if (namespacesOnTarget.contains(ns)) {
                // overwrite the entity on the target with the entity on the source
                plan.overwriteEntity(ns);
            } else {
                // if the namespace is not on the target, plan to create it
                plan.createEntity(ns);
            }
        }

        for (Namespace ns : namespacesOnTarget) {
            if (!namespacesOnSource.contains(ns)) {
                // remove namespaces that do not exist on the source but do exist on the target
                plan.removeEntity(ns);
            }
        }

        return plan;
    }

    @Override
    public SynchronizationPlan<TableIdentifier> planTableSync(String catalogName, Namespace namespace, Set<TableIdentifier> tablesOnSource, Set<TableIdentifier> tablesOnTarget) {
        SynchronizationPlan<TableIdentifier> plan = new SynchronizationPlan<>();

        for (TableIdentifier tableIdentifier : tablesOnSource) {
            if (tablesOnTarget.contains(tableIdentifier)) {
                // overwrite tables on target and source
                plan.overwriteEntity(tableIdentifier);
            } else {
                // create tables on source but not target
                plan.createEntity(tableIdentifier);
            }
        }

        // remove tables only on target
        for (TableIdentifier tableIdentifier : tablesOnTarget) {
            if (!tablesOnSource.contains(tableIdentifier)) {
                plan.removeEntity(tableIdentifier);
            }
        }

        return plan;
    }

}
