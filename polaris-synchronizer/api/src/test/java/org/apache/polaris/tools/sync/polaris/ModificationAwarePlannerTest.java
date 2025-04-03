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

import org.apache.polaris.core.admin.model.AwsStorageConfigInfo;
import org.apache.polaris.core.admin.model.AzureStorageConfigInfo;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogProperties;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.ExternalCatalog;
import org.apache.polaris.core.admin.model.GcpStorageConfigInfo;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.PolarisCatalog;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.core.admin.model.StorageConfigInfo;
import org.apache.polaris.tools.sync.polaris.planning.ModificationAwarePlanner;
import org.apache.polaris.tools.sync.polaris.planning.NoOpSyncPlanner;
import org.apache.polaris.tools.sync.polaris.planning.SynchronizationPlanner;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.List;

public class ModificationAwarePlannerTest {

    private static final PrincipalRole principalRole = new PrincipalRole().name("principal-role");

    private static final PrincipalRole modifiedPrincipalRole = new PrincipalRole().name("principal-role")
            .putPropertiesItem("newproperty", "newvalue");

    @Test
    public void testPrincipalRoleNotModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<PrincipalRole> plan = modificationPlanner.planPrincipalRoleSync(List.of(principalRole), List.of(principalRole));

        Assertions.assertTrue(plan.entitiesNotModified().contains(principalRole));
    }

    @Test
    public void testPrincipalRoleModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<PrincipalRole> plan = modificationPlanner.planPrincipalRoleSync(List.of(principalRole), List.of(modifiedPrincipalRole));

        Assertions.assertFalse(plan.entitiesNotModified().contains(principalRole));
    }

    private static final CatalogRole catalogRole = new CatalogRole().name("catalog-role");

    private static final CatalogRole modifiedCatalogRole = new CatalogRole().name("catalog-role")
            .putPropertiesItem("newproperty", "newvalue");

    @Test
    public void testCatalogRoleNotModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<CatalogRole> plan = modificationPlanner.planCatalogRoleSync(
                "catalog", List.of(catalogRole), List.of(catalogRole));

        Assertions.assertTrue(plan.entitiesNotModified().contains(catalogRole));
    }

    @Test
    public void testCatalogRoleModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<CatalogRole> plan = modificationPlanner.planCatalogRoleSync(
                "catalog", List.of(catalogRole), List.of(modifiedCatalogRole));

        Assertions.assertFalse(plan.entitiesNotModified().contains(catalogRole));
    }

    private static final GrantResource grant = new GrantResource().type(GrantResource.TypeEnum.CATALOG);

    @Test
    public void testGrantNotRevoked() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<GrantResource> plan = modificationPlanner.planGrantSync(
                "catalog", "catalogRole", List.of(grant), List.of(grant));

        Assertions.assertTrue(plan.entitiesNotModified().contains(grant));
    }

    private static final Catalog catalog = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.INTERNAL)
            .properties(new CatalogProperties())
            .storageConfigInfo(new AwsStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.S3)
                    .roleArn("roleArn")
                    .userArn("userArn")
                    .externalId("externalId")
                    .region("region"));

    private static final Catalog catalogWithTypeChange = new ExternalCatalog().name("catalog")
            .type(Catalog.TypeEnum.EXTERNAL) // changed type
            .properties(new CatalogProperties())
            .storageConfigInfo(new AwsStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.S3)
                    .roleArn("roleArn")
                    .userArn("userArn")
                    .externalId("externalId")
                    .region("region"));

    private static final Catalog catalogWithStorageConfigInfoChange = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.EXTERNAL) // changed type
            .properties(new CatalogProperties())
            .storageConfigInfo(new AzureStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.AZURE)
                    .consentUrl("consentUrl")
                    .tenantId("tenantId")
                    .multiTenantAppName("multiTenantAppName"));

    private static final Catalog catalogWithOnlyUserArnChange = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.INTERNAL)
            .properties(new CatalogProperties())
            .storageConfigInfo(new AwsStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.S3)
                    .roleArn("roleArn")
                    .userArn("userArnChanged") // only user arn changed
                    .externalId("externalId")
                    .region("region"));

    private static final Catalog catalogWithPropertyChange = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.INTERNAL)
            .properties(new CatalogProperties().putAdditionalProperty("newproperty", "newvalue"))
            .storageConfigInfo(new AwsStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.S3)
                    .roleArn("roleArn")
                    .userArn("userArn")
                    .externalId("externalId")
                    .region("region"));

    private static final Catalog azureCatalog = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.INTERNAL)
            .properties(new CatalogProperties())
            .storageConfigInfo(new AzureStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.AZURE)
                    .consentUrl("consentUrl")
                    .multiTenantAppName("multiTenantAppName")
                    .tenantId("tenantId"));

    private static final Catalog azureCatalogConsentUrlAndTenantAppNameChange = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.INTERNAL)
            .properties(new CatalogProperties())
            .storageConfigInfo(new AzureStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.AZURE)
                    .consentUrl("consentUrlChanged")
                    .multiTenantAppName("multiTenantAppNameChanged")
                    .tenantId("tenantId"));

    private static final Catalog gcpCatalog = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.INTERNAL)
            .properties(new CatalogProperties())
            .storageConfigInfo(new GcpStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.AZURE)
                    .gcsServiceAccount("gcsServiceAccount"));

    private static final Catalog gcpCatalogGcsServiceAccountChange = new PolarisCatalog().name("catalog")
            .type(Catalog.TypeEnum.INTERNAL)
            .properties(new CatalogProperties())
            .storageConfigInfo(new GcpStorageConfigInfo()
                    .storageType(StorageConfigInfo.StorageTypeEnum.AZURE)
                    .gcsServiceAccount("gcsServiceAccountChanged"));


    @Test
    public void testCatalogNotModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<Catalog> plan = modificationPlanner.planCatalogSync(
                List.of(catalog), List.of(catalog));

        Assertions.assertTrue(plan.entitiesNotModified().contains(catalog));
    }

    @Test
    public void testCatalogTypeModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<Catalog> plan = modificationPlanner.planCatalogSync(
                List.of(catalogWithTypeChange), List.of(catalog));

        Assertions.assertFalse(plan.entitiesNotModified().contains(catalogWithTypeChange));
    }

    @Test
    public void testCatalogStorageConfigInfoModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<Catalog> plan = modificationPlanner.planCatalogSync(
                List.of(catalogWithStorageConfigInfoChange), List.of(catalog));

        Assertions.assertFalse(plan.entitiesNotModified().contains(catalogWithStorageConfigInfoChange));
    }

    @Test
    public void testCatalogPropertiesModified() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<Catalog> plan = modificationPlanner.planCatalogSync(
                List.of(catalogWithPropertyChange), List.of(catalog));

        Assertions.assertFalse(plan.entitiesNotModified().contains(catalogWithPropertyChange));
    }

    @Test
    public void testOnlyUserArnModifiedForAws() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<Catalog> plan = modificationPlanner.planCatalogSync(
                List.of(catalogWithOnlyUserArnChange), List.of(catalog));

        Assertions.assertTrue(plan.entitiesNotModified().contains(catalogWithOnlyUserArnChange));
    }

    @Test
    public void testOnlyConsentUrlAndTenantAppNameChangeAzure() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<Catalog> plan = modificationPlanner.planCatalogSync(
                List.of(azureCatalogConsentUrlAndTenantAppNameChange), List.of(azureCatalog));

        Assertions.assertTrue(plan.entitiesNotModified().contains(azureCatalogConsentUrlAndTenantAppNameChange));
    }

    @Test
    public void testOnlyGcsServiceAccountChangeGCP() {
        SynchronizationPlanner modificationPlanner = new ModificationAwarePlanner(new NoOpSyncPlanner());

        SynchronizationPlan<Catalog> plan = modificationPlanner.planCatalogSync(
                List.of(gcpCatalogGcsServiceAccountChange), List.of(gcpCatalog));

        Assertions.assertTrue(plan.entitiesNotModified().contains(gcpCatalogGcsServiceAccountChange));
    }

}
