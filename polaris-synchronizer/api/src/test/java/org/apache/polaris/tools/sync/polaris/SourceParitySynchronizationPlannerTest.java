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

import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.tools.sync.polaris.planning.SourceParitySynchronizationPlanner;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

public class SourceParitySynchronizationPlannerTest {

    private final static Catalog CATALOG_1 = new Catalog().name("catalog-1");

    private final static Catalog CATALOG_2 = new Catalog().name("catalog-2");

    private final static Catalog CATALOG_3 = new Catalog().name("catalog-3");

    @Test
    public void testCreatesNewCatalogOverwritesOldCatalogRemovesDroppedCatalog() {
        SourceParitySynchronizationPlanner planner = new SourceParitySynchronizationPlanner();

        SynchronizationPlan<Catalog> plan = planner.planCatalogSync(List.of(CATALOG_1, CATALOG_2), List.of(CATALOG_2, CATALOG_3));

        Assertions.assertTrue(plan.entitiesToCreate().contains(CATALOG_1));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(CATALOG_1));
        Assertions.assertFalse(plan.entitiesToRemove().contains(CATALOG_1));

        Assertions.assertFalse(plan.entitiesToCreate().contains(CATALOG_2));
        Assertions.assertTrue(plan.entitiesToOverwrite().contains(CATALOG_2));
        Assertions.assertFalse(plan.entitiesToRemove().contains(CATALOG_2));

        Assertions.assertFalse(plan.entitiesToCreate().contains(CATALOG_3));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(CATALOG_3));
        Assertions.assertTrue(plan.entitiesToRemove().contains(CATALOG_3));
    }

    private final static PrincipalRole PRINCIPAL_ROLE_1 = new PrincipalRole().name("principal-role-1");

    private final static PrincipalRole PRINCIPAL_ROLE_2 = new PrincipalRole().name("principal-role-2");

    private final static PrincipalRole PRINCIPAL_ROLE_3 = new PrincipalRole().name("principal-role-3");

    @Test
    public void testCreatesNewPrincipalRoleOverwritesOldPrincipalRoleRemovesDroppedPrincipalRole() {
        SourceParitySynchronizationPlanner planner = new SourceParitySynchronizationPlanner();

        SynchronizationPlan<PrincipalRole> plan = planner.planPrincipalRoleSync(
                List.of(PRINCIPAL_ROLE_1, PRINCIPAL_ROLE_2), List.of(PRINCIPAL_ROLE_2, PRINCIPAL_ROLE_3));

        Assertions.assertTrue(plan.entitiesToCreate().contains(PRINCIPAL_ROLE_1));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(PRINCIPAL_ROLE_1));
        Assertions.assertFalse(plan.entitiesToRemove().contains(PRINCIPAL_ROLE_1));

        Assertions.assertFalse(plan.entitiesToCreate().contains(PRINCIPAL_ROLE_2));
        Assertions.assertTrue(plan.entitiesToOverwrite().contains(PRINCIPAL_ROLE_2));
        Assertions.assertFalse(plan.entitiesToRemove().contains(PRINCIPAL_ROLE_2));

        Assertions.assertFalse(plan.entitiesToCreate().contains(PRINCIPAL_ROLE_3));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(PRINCIPAL_ROLE_3));
        Assertions.assertTrue(plan.entitiesToRemove().contains(PRINCIPAL_ROLE_3));
    }

    private final static CatalogRole CATALOG_ROLE_1 = new CatalogRole().name("catalog-role-1");

    private final static CatalogRole CATALOG_ROLE_2 = new CatalogRole().name("catalog-role-2");

    private final static CatalogRole CATALOG_ROLE_3 = new CatalogRole().name("catalog-role-3");

    @Test
    public void testCreatesNewCatalogRoleOverwritesOldCatalogRoleRemovesDroppedCatalogRole() {
        SourceParitySynchronizationPlanner planner = new SourceParitySynchronizationPlanner();

        SynchronizationPlan<CatalogRole> plan = planner.planCatalogRoleSync(
                "catalog", List.of(CATALOG_ROLE_1, CATALOG_ROLE_2), List.of(CATALOG_ROLE_2, CATALOG_ROLE_3));

        Assertions.assertTrue(plan.entitiesToCreate().contains(CATALOG_ROLE_1));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(CATALOG_ROLE_1));
        Assertions.assertFalse(plan.entitiesToRemove().contains(CATALOG_ROLE_1));

        Assertions.assertFalse(plan.entitiesToCreate().contains(CATALOG_ROLE_2));
        Assertions.assertTrue(plan.entitiesToOverwrite().contains(CATALOG_ROLE_2));
        Assertions.assertFalse(plan.entitiesToRemove().contains(CATALOG_ROLE_2));

        Assertions.assertFalse(plan.entitiesToCreate().contains(CATALOG_ROLE_3));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(CATALOG_ROLE_3));
        Assertions.assertTrue(plan.entitiesToRemove().contains(CATALOG_ROLE_3));
    }

    private final static GrantResource GRANT_1 = new GrantResource().type(GrantResource.TypeEnum.CATALOG);

    private final static GrantResource GRANT_2 = new GrantResource().type(GrantResource.TypeEnum.NAMESPACE);

    private final static GrantResource GRANT_3 = new GrantResource().type(GrantResource.TypeEnum.TABLE);

    @Test
    public void testCreatesNewGrantResourceRemovesDroppedGrantResource() {
        SourceParitySynchronizationPlanner planner = new SourceParitySynchronizationPlanner();

        SynchronizationPlan<GrantResource> plan = planner.planGrantSync(
                "catalog", "catalogRole", List.of(GRANT_1, GRANT_2), List.of(GRANT_2, GRANT_3));

        Assertions.assertTrue(plan.entitiesToCreate().contains(GRANT_1));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(GRANT_1));
        Assertions.assertFalse(plan.entitiesToRemove().contains(GRANT_1));

        // special case: no concept of overwriting a grant
        Assertions.assertFalse(plan.entitiesToCreate().contains(GRANT_2));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(GRANT_2));
        Assertions.assertFalse(plan.entitiesToRemove().contains(GRANT_2));

        Assertions.assertFalse(plan.entitiesToCreate().contains(GRANT_3));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(GRANT_3));
        Assertions.assertTrue(plan.entitiesToRemove().contains(GRANT_3));
    }

    private final static PrincipalRole ASSIGNED_PRINCIPAL_ROLE_1 = new PrincipalRole().name("principal-role-1");

    private final static PrincipalRole ASSIGNED_PRINCIPAL_ROLE_2 = new PrincipalRole().name("principal-role-2");

    private final static PrincipalRole ASSIGNED_PRINCIPAL_ROLE_3 = new PrincipalRole().name("principal-role-3");

    @Test
    public void testAssignsNewPrincipalRoleRevokesDroppedPrincipalRole() {
        SourceParitySynchronizationPlanner planner = new SourceParitySynchronizationPlanner();

        SynchronizationPlan<PrincipalRole> plan = planner.planAssignPrincipalRolesToCatalogRolesSync(
                "catalog", "catalogRole",
                List.of(ASSIGNED_PRINCIPAL_ROLE_1, ASSIGNED_PRINCIPAL_ROLE_2), List.of(ASSIGNED_PRINCIPAL_ROLE_2, ASSIGNED_PRINCIPAL_ROLE_3));

        Assertions.assertTrue(plan.entitiesToCreate().contains(ASSIGNED_PRINCIPAL_ROLE_1));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(ASSIGNED_PRINCIPAL_ROLE_1));
        Assertions.assertFalse(plan.entitiesToRemove().contains(ASSIGNED_PRINCIPAL_ROLE_1));

        // special case: no concept of overwriting the assignment of a principal role
        Assertions.assertFalse(plan.entitiesToCreate().contains(ASSIGNED_PRINCIPAL_ROLE_2));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(ASSIGNED_PRINCIPAL_ROLE_2));
        Assertions.assertFalse(plan.entitiesToRemove().contains(ASSIGNED_PRINCIPAL_ROLE_2));

        Assertions.assertFalse(plan.entitiesToCreate().contains(ASSIGNED_PRINCIPAL_ROLE_3));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(ASSIGNED_PRINCIPAL_ROLE_3));
        Assertions.assertTrue(plan.entitiesToRemove().contains(ASSIGNED_PRINCIPAL_ROLE_3));
    }

    private final static Namespace NS_1 = Namespace.of("ns1");

    private final static Namespace NS_2 = Namespace.of("ns2");

    private final static Namespace NS_3 = Namespace.of("ns3");

    @Test
    public void testCreatesNewNamespaceOverwritesOldNamespaceDropsDroppedNamespace() {
        SourceParitySynchronizationPlanner planner = new SourceParitySynchronizationPlanner();
        SynchronizationPlan<Namespace> plan = planner.planNamespaceSync(
                "catalog", Namespace.empty(), List.of(NS_1, NS_2), List.of(NS_2, NS_3));

        Assertions.assertTrue(plan.entitiesToCreate().contains(NS_1));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(NS_1));
        Assertions.assertFalse(plan.entitiesToRemove().contains(NS_1));

        Assertions.assertFalse(plan.entitiesToCreate().contains(NS_2));
        Assertions.assertTrue(plan.entitiesToOverwrite().contains(NS_2));
        Assertions.assertFalse(plan.entitiesToRemove().contains(NS_2));

        Assertions.assertFalse(plan.entitiesToCreate().contains(NS_3));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(NS_3));
        Assertions.assertTrue(plan.entitiesToRemove().contains(NS_3));
    }

    private final static TableIdentifier TABLE_1 = TableIdentifier.of("ns", "table1");

    private final static TableIdentifier TABLE_2 = TableIdentifier.of("ns", "table2");

    private final static TableIdentifier TABLE_3 = TableIdentifier.of("ns", "table3");

    @Test
    public void testCreatesNewTableIdentifierOverwritesOldTableIdentifierRevokesDroppedTableIdentifier() {
        SourceParitySynchronizationPlanner planner = new SourceParitySynchronizationPlanner();

        SynchronizationPlan<TableIdentifier> plan = planner.planTableSync(
                "catalog", Namespace.empty(), Set.of(TABLE_1, TABLE_2), Set.of(TABLE_2, TABLE_3));

        Assertions.assertTrue(plan.entitiesToCreate().contains(TABLE_1));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(TABLE_1));
        Assertions.assertFalse(plan.entitiesToRemove().contains(TABLE_1));

        Assertions.assertFalse(plan.entitiesToCreate().contains(TABLE_2));
        Assertions.assertTrue(plan.entitiesToOverwrite().contains(TABLE_2));
        Assertions.assertFalse(plan.entitiesToRemove().contains(TABLE_2));

        Assertions.assertFalse(plan.entitiesToCreate().contains(TABLE_3));
        Assertions.assertFalse(plan.entitiesToOverwrite().contains(TABLE_3));
        Assertions.assertTrue(plan.entitiesToRemove().contains(TABLE_3));
    }

}
