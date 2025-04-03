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

import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.tools.sync.polaris.access.AccessControlConstants;
import org.apache.polaris.tools.sync.polaris.planning.AccessControlAwarePlanner;
import org.apache.polaris.tools.sync.polaris.planning.NoOpSyncPlanner;
import org.apache.polaris.tools.sync.polaris.planning.SynchronizationPlanner;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.List;

public class AccessControlAwarePlannerTest {

    private final static PrincipalRole omnipotentPrincipalRoleSource = new PrincipalRole()
            .name("omnipotent-principal-XXXXX")
            .putPropertiesItem(AccessControlConstants.OMNIPOTENCE_PROPERTY, "");

    private final static PrincipalRole omnipotentPrincipalRoleTarget = new PrincipalRole()
            .name("omnipotent-principal-YYYYY")
            .putPropertiesItem(AccessControlConstants.OMNIPOTENCE_PROPERTY, "");

    @Test
    public void filtersOmnipotentPrincipalRoles() {
        SynchronizationPlanner accessControlAwarePlanner = new AccessControlAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<PrincipalRole> plan = accessControlAwarePlanner.planPrincipalRoleSync(
                List.of(omnipotentPrincipalRoleSource), List.of(omnipotentPrincipalRoleTarget));

        Assertions.assertTrue(plan.entitiesToSkip().contains(omnipotentPrincipalRoleSource));
        Assertions.assertTrue(plan.entitiesToSkip().contains(omnipotentPrincipalRoleTarget));
    }

    private final static PrincipalRole serviceAdminSource = new PrincipalRole()
            .name("service_admin");

    private final static PrincipalRole serviceAdminTarget = new PrincipalRole()
            .name("service_admin");

    @Test
    public void filtersServiceAdmin() {
        SynchronizationPlanner accessControlAwarePlanner = new AccessControlAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<PrincipalRole> plan = accessControlAwarePlanner.planPrincipalRoleSync(
                List.of(serviceAdminSource), List.of(serviceAdminTarget));

        Assertions.assertTrue(plan.entitiesToSkip().contains(serviceAdminSource));
        Assertions.assertTrue(plan.entitiesToSkip().contains(serviceAdminTarget));
    }

    private final static CatalogRole omnipotentCatalogRoleSource = new CatalogRole()
            .name("omnipotent-principal-XXXXX")
            .putPropertiesItem(AccessControlConstants.OMNIPOTENCE_PROPERTY, "");

    private final static CatalogRole omnipotentCatalogRoleTarget = new CatalogRole()
            .name("omnipotent-principal-YYYYY")
            .putPropertiesItem(AccessControlConstants.OMNIPOTENCE_PROPERTY, "");

    @Test
    public void filtersOmnipotentCatalogRolesAndChildren() {
        SynchronizationPlanner accessControlAwarePlanner = new AccessControlAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<CatalogRole> plan = accessControlAwarePlanner.planCatalogRoleSync(
                "catalogName", List.of(omnipotentCatalogRoleSource), List.of(omnipotentCatalogRoleTarget));

        Assertions.assertTrue(plan.entitiesToSkipAndSkipChildren().contains(omnipotentCatalogRoleSource));
        Assertions.assertTrue(plan.entitiesToSkipAndSkipChildren().contains(omnipotentCatalogRoleTarget));
    }

    private final static CatalogRole catalogAdminSource = new CatalogRole()
            .name("catalog_admin");

    private final static CatalogRole catalogAdminTarget = new CatalogRole()
            .name("catalog_admin");

    @Test
    public void filtersCatalogAdminAndChildren() {
        SynchronizationPlanner accessControlAwarePlanner = new AccessControlAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<CatalogRole> plan = accessControlAwarePlanner.planCatalogRoleSync(
                "catalogName", List.of(catalogAdminSource), List.of(catalogAdminTarget));

        Assertions.assertTrue(plan.entitiesToSkipAndSkipChildren().contains(catalogAdminSource));
        Assertions.assertTrue(plan.entitiesToSkipAndSkipChildren().contains(catalogAdminTarget));
    }

    @Test
    public void filtersOutAssignmentOfOmnipotentPrincipalRoles() {
        SynchronizationPlanner accessControlAwarePlanner = new AccessControlAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<PrincipalRole> plan = accessControlAwarePlanner.planAssignPrincipalRolesToCatalogRolesSync(
                "catalogName", "catalogRoleName",
                List.of(omnipotentPrincipalRoleSource), List.of(omnipotentPrincipalRoleTarget));

        Assertions.assertTrue(plan.entitiesToSkip().contains(omnipotentPrincipalRoleSource));
        Assertions.assertTrue(plan.entitiesToSkip().contains(omnipotentPrincipalRoleTarget));
    }

    @Test
    public void filtersOutAssignmentOfServiceAdmin() {
        SynchronizationPlanner accessControlAwarePlanner = new AccessControlAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<PrincipalRole> plan = accessControlAwarePlanner.planAssignPrincipalRolesToCatalogRolesSync(
                "catalogName", "catalogRoleName",
                List.of(serviceAdminSource), List.of(serviceAdminTarget));

        Assertions.assertTrue(plan.entitiesToSkip().contains(serviceAdminSource));
        Assertions.assertTrue(plan.entitiesToSkip().contains(serviceAdminTarget));
    }

}
