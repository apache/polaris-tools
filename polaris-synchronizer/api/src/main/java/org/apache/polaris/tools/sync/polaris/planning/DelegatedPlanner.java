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

/**
 * Extend this to delegate planning to another planner, but only override methods for the functionality needed.
 */
public abstract class DelegatedPlanner implements SynchronizationPlanner {

    protected final SynchronizationPlanner delegate;

    public DelegatedPlanner(SynchronizationPlanner delegate) {
        this.delegate = delegate;
    }

    @Override
    public SynchronizationPlan<PrincipalRole> planPrincipalRoleSync(List<PrincipalRole> principalRolesOnSource, List<PrincipalRole> principalRolesOnTarget) {
        return delegate.planPrincipalRoleSync(principalRolesOnSource, principalRolesOnTarget);
    }

    @Override
    public SynchronizationPlan<Catalog> planCatalogSync(List<Catalog> catalogsOnSource, List<Catalog> catalogsOnTarget) {
        return delegate.planCatalogSync(catalogsOnSource, catalogsOnTarget);
    }

    @Override
    public SynchronizationPlan<CatalogRole> planCatalogRoleSync(String catalogName, List<CatalogRole> catalogRolesOnSource, List<CatalogRole> catalogRolesOnTarget) {
        return delegate.planCatalogRoleSync(catalogName, catalogRolesOnSource, catalogRolesOnTarget);
    }

    @Override
    public SynchronizationPlan<GrantResource> planGrantSync(String catalogName, String catalogRoleName, List<GrantResource> grantsOnSource, List<GrantResource> grantsOnTarget) {
        return delegate.planGrantSync(catalogName, catalogRoleName, grantsOnSource, grantsOnTarget);
    }

    @Override
    public SynchronizationPlan<PrincipalRole> planAssignPrincipalRolesToCatalogRolesSync(String catalogName, String catalogRoleName, List<PrincipalRole> assignedPrincipalRolesOnSource, List<PrincipalRole> assignedPrincipalRolesOnTarget) {
        return delegate.planAssignPrincipalRolesToCatalogRolesSync(catalogName, catalogRoleName, assignedPrincipalRolesOnSource, assignedPrincipalRolesOnTarget);
    }

    @Override
    public SynchronizationPlan<Namespace> planNamespaceSync(String catalogName, Namespace namespace, List<Namespace> namespacesOnSource, List<Namespace> namespacesOnTarget) {
        return delegate.planNamespaceSync(catalogName, namespace, namespacesOnSource, namespacesOnTarget);
    }

    @Override
    public SynchronizationPlan<TableIdentifier> planTableSync(String catalogName, Namespace namespace, Set<TableIdentifier> tablesOnSource, Set<TableIdentifier> tablesOnTarget) {
        return delegate.planTableSync(catalogName, namespace, tablesOnSource, tablesOnTarget);
    }

}
