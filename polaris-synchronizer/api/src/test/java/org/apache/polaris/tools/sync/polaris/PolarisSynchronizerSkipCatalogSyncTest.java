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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.AwsStorageConfigInfo;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogProperties;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.Principal;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.core.admin.model.PolarisCatalog;
import org.apache.polaris.core.admin.model.StorageConfigInfo;
import org.apache.polaris.tools.sync.polaris.catalog.NoOpETagManager;
import org.apache.polaris.tools.sync.polaris.planning.NoOpSyncPlanner;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationReport;
import org.apache.polaris.tools.sync.polaris.service.IcebergCatalogService;
import org.apache.polaris.tools.sync.polaris.service.PolarisService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

/**
 * Verifies that {@code --skip-catalog-sync} prevents {@link PolarisSynchronizer#syncCatalogs()}
 * from creating, overwriting, or removing catalog objects on the target, while still synchronizing
 * catalog-roles/grants for catalogs that already exist on the target.
 */
public class PolarisSynchronizerSkipCatalogSyncTest {

  private static Catalog newCatalog(String name) {
    return new PolarisCatalog()
        .name(name)
        .type(Catalog.TypeEnum.INTERNAL)
        .properties(new CatalogProperties())
        .storageConfigInfo(
            new AwsStorageConfigInfo()
                .storageType(StorageConfigInfo.StorageTypeEnum.S3)
                .roleArn("roleArn")
                .userArn("userArn")
                .externalId("externalId")
                .region("region"));
  }

  private static final Catalog sourceOnlyCatalog = newCatalog("source-only-catalog");
  private static final Catalog overwriteCatalog = newCatalog("overwrite-catalog");
  private static final Catalog removeCatalog = newCatalog("remove-catalog");

  /** Planner that stages one catalog for CREATE, one for OVERWRITE, and one for REMOVE. */
  private static class CreateOverwriteRemovePlanner extends NoOpSyncPlanner {
    @Override
    public SynchronizationPlan<Catalog> planCatalogSync(
        List<Catalog> catalogsOnSource, List<Catalog> catalogsOnTarget) {
      SynchronizationPlan<Catalog> plan = new SynchronizationPlan<>();
      plan.createEntity(sourceOnlyCatalog);
      plan.overwriteEntity(overwriteCatalog);
      plan.removeEntity(removeCatalog);
      return plan;
    }

    @Override
    public SynchronizationPlan<CatalogRole> planCatalogRoleSync(
        String catalogName,
        List<CatalogRole> catalogRolesOnSource,
        List<CatalogRole> catalogRolesOnTarget) {
      return new SynchronizationPlan<>();
    }

    @Override
    public SynchronizationPlan<Namespace> planNamespaceSync(
        String catalogName,
        Namespace namespace,
        List<Namespace> namespacesOnSource,
        List<Namespace> namespacesOnTarget) {
      // NoOpSyncPlanner returns null here, which would NPE once syncNamespaces() runs.
      return new SynchronizationPlan<>();
    }
  }

  private static class CountingIcebergCatalogService implements IcebergCatalogService {
    @Override
    public List<Namespace> listNamespaces(Namespace parentNamespace) {
      return List.of();
    }

    @Override
    public Map<String, String> loadNamespaceMetadata(Namespace namespace) {
      return Map.of();
    }

    @Override
    public void createNamespace(Namespace namespace, Map<String, String> namespaceMetadata) {}

    @Override
    public void setNamespaceProperties(Namespace namespace, Map<String, String> namespaceProperties) {}

    @Override
    public void dropNamespaceCascade(Namespace namespace) {}

    @Override
    public List<TableIdentifier> listTables(Namespace namespace) {
      return List.of();
    }

    @Override
    public Table loadTable(TableIdentifier tableIdentifier) {
      throw new UnsupportedOperationException();
    }

    @Override
    public void registerTable(TableIdentifier tableIdentifier, String metadataFileLocation) {}

    @Override
    public void dropTableWithoutPurge(TableIdentifier tableIdentifier) {}

    @Override
    public void close() {}
  }

  /** Stub {@link PolarisService} that tracks catalog create/overwrite/remove and catalog-role sync calls. */
  private static class TrackingPolarisService implements PolarisService {

    private final List<Catalog> catalogs;
    final List<String> catalogsCreated = new ArrayList<>();
    final List<String> catalogsDropped = new ArrayList<>();
    final List<String> catalogRoleSyncsAttempted = new ArrayList<>();

    TrackingPolarisService(List<Catalog> catalogs) {
      this.catalogs = catalogs;
    }

    @Override
    public void initialize(Map<String, String> properties) {}

    @Override
    public List<Principal> listPrincipals() {
      return List.of();
    }

    @Override
    public Principal getPrincipal(String principalName) {
      throw new UnsupportedOperationException();
    }

    @Override
    public PrincipalWithCredentials createPrincipal(Principal principal) {
      throw new UnsupportedOperationException();
    }

    @Override
    public void dropPrincipal(String principalName) {}

    @Override
    public List<PrincipalRole> listPrincipalRoles() {
      return List.of();
    }

    @Override
    public PrincipalRole getPrincipalRole(String principalRoleName) {
      throw new UnsupportedOperationException();
    }

    @Override
    public void createPrincipalRole(PrincipalRole principalRole) {}

    @Override
    public void dropPrincipalRole(String principalRoleName) {}

    @Override
    public List<PrincipalRole> listPrincipalRolesAssigned(String principalName) {
      return List.of();
    }

    @Override
    public void assignPrincipalRole(String principalName, String principalRoleName) {}

    @Override
    public void revokePrincipalRole(String principalName, String principalRoleName) {}

    @Override
    public List<Catalog> listCatalogs() {
      return catalogs;
    }

    @Override
    public Catalog getCatalog(String catalogName) {
      throw new UnsupportedOperationException();
    }

    @Override
    public void createCatalog(Catalog catalog) {
      catalogsCreated.add(catalog.getName());
    }

    @Override
    public void dropCatalogCascade(String catalogName) {
      catalogsDropped.add(catalogName);
    }

    @Override
    public List<CatalogRole> listCatalogRoles(String catalogName) {
      catalogRoleSyncsAttempted.add(catalogName);
      return List.of();
    }

    @Override
    public CatalogRole getCatalogRole(String catalogName, String catalogRoleName) {
      throw new UnsupportedOperationException();
    }

    @Override
    public void createCatalogRole(String catalogName, CatalogRole catalogRole) {}

    @Override
    public void dropCatalogRole(String catalogName, String catalogRoleName) {}

    @Override
    public List<PrincipalRole> listAssigneePrincipalRolesForCatalogRole(
        String catalogName, String catalogRoleName) {
      return List.of();
    }

    @Override
    public void assignCatalogRole(
        String principalRoleName, String catalogName, String catalogRoleName) {}

    @Override
    public void revokeCatalogRole(
        String principalRoleName, String catalogName, String catalogRoleName) {}

    @Override
    public List<GrantResource> listGrants(String catalogName, String catalogRoleName) {
      return List.of();
    }

    @Override
    public void addGrant(String catalogName, String catalogRoleName, GrantResource grant) {}

    @Override
    public void revokeGrant(String catalogName, String catalogRoleName, GrantResource grant) {}

    @Override
    public IcebergCatalogService initializeIcebergCatalogService(String catalogName) {
      return new CountingIcebergCatalogService();
    }

    @Override
    public void close() {}
  }

  @Test
  public void testSkipCatalogSyncSkipsCreateOverwriteAndRemoveButStillSyncsRolesForExistingCatalogs() {
    TrackingPolarisService source =
        new TrackingPolarisService(List.of(sourceOnlyCatalog, overwriteCatalog));
    TrackingPolarisService target = new TrackingPolarisService(List.of(overwriteCatalog, removeCatalog));

    PolarisSynchronizer synchronizer =
        new PolarisSynchronizer(
            null,
            false,
            new CreateOverwriteRemovePlanner(),
            source,
            target,
            new NoOpETagManager(),
            false,
            new SynchronizationReport(),
            true /* skipIcebergContent */,
            true /* skipCatalogSync */);

    synchronizer.syncCatalogs();

    // no catalog objects should be created, overwritten (dropped+recreated), or removed on target
    Assertions.assertEquals(List.of(), target.catalogsCreated);
    Assertions.assertEquals(List.of(), target.catalogsDropped);

    // the source-only catalog has no match on target, so it must be excluded from catalog-role sync
    Assertions.assertFalse(
        target.catalogRoleSyncsAttempted.contains(sourceOnlyCatalog.getName()));

    // the catalog that exists on both sides should still have its catalog-roles synced
    Assertions.assertTrue(target.catalogRoleSyncsAttempted.contains(overwriteCatalog.getName()));
    Assertions.assertTrue(source.catalogRoleSyncsAttempted.contains(overwriteCatalog.getName()));
  }

  @Test
  public void testCatalogSyncedWhenNotSkipped() {
    TrackingPolarisService source =
        new TrackingPolarisService(List.of(sourceOnlyCatalog, overwriteCatalog));
    TrackingPolarisService target = new TrackingPolarisService(List.of(overwriteCatalog, removeCatalog));

    PolarisSynchronizer synchronizer =
        new PolarisSynchronizer(
            null,
            false,
            new CreateOverwriteRemovePlanner(),
            source,
            target,
            new NoOpETagManager(),
            false,
            new SynchronizationReport(),
            true /* skipIcebergContent */,
            false /* skipCatalogSync */);

    synchronizer.syncCatalogs();

    Assertions.assertEquals(
        List.of(sourceOnlyCatalog.getName(), overwriteCatalog.getName()), target.catalogsCreated);
    Assertions.assertEquals(
        List.of(overwriteCatalog.getName(), removeCatalog.getName()), target.catalogsDropped);
    Assertions.assertTrue(target.catalogRoleSyncsAttempted.contains(sourceOnlyCatalog.getName()));
    Assertions.assertTrue(target.catalogRoleSyncsAttempted.contains(overwriteCatalog.getName()));
  }
}
