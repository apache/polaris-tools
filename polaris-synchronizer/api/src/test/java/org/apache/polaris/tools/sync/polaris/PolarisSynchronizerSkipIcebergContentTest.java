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
import org.apache.polaris.tools.sync.polaris.service.IcebergCatalogService;
import org.apache.polaris.tools.sync.polaris.service.PolarisService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

/**
 * Verifies that {@code --skip-iceberg-content} prevents {@link PolarisSynchronizer#syncCatalogs()}
 * from ever initializing an Iceberg REST catalog session, while still synchronizing catalog roles.
 */
public class PolarisSynchronizerSkipIcebergContentTest {

  private static final Catalog catalog =
      new PolarisCatalog()
          .name("catalog")
          .type(Catalog.TypeEnum.INTERNAL)
          .properties(new CatalogProperties())
          .storageConfigInfo(
              new AwsStorageConfigInfo()
                  .storageType(StorageConfigInfo.StorageTypeEnum.S3)
                  .roleArn("roleArn")
                  .userArn("userArn")
                  .externalId("externalId")
                  .region("region"));

  private static final CatalogRole catalogRole = new CatalogRole().name("catalog-role");

  private static final GrantResource tableScopedGrant =
      new GrantResource().type(GrantResource.TypeEnum.TABLE);

  /** Planner that always presents {@link #catalog} as needing its children synced. */
  private static class SingleCatalogPlanner extends NoOpSyncPlanner {
    @Override
    public SynchronizationPlan<Catalog> planCatalogSync(
        List<Catalog> catalogsOnSource, List<Catalog> catalogsOnTarget) {
      SynchronizationPlan<Catalog> plan = new SynchronizationPlan<>();
      plan.skipEntity(catalog);
      return plan;
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

  /**
   * Planner that, in addition to {@link SingleCatalogPlanner}'s behavior, always presents
   * {@link #catalogRole} as needing its children synced and always stages {@link #tableScopedGrant}
   * for creation - regardless of whether the underlying table was ever synced.
   */
  private static class SingleCatalogWithGrantPlanner extends SingleCatalogPlanner {
    @Override
    public SynchronizationPlan<CatalogRole> planCatalogRoleSync(
        String catalogName,
        List<CatalogRole> catalogRolesOnSource,
        List<CatalogRole> catalogRolesOnTarget) {
      SynchronizationPlan<CatalogRole> plan = new SynchronizationPlan<>();
      plan.skipEntity(catalogRole);
      return plan;
    }

    @Override
    public SynchronizationPlan<GrantResource> planGrantSync(
        String catalogName,
        String catalogRoleName,
        List<GrantResource> grantsOnSource,
        List<GrantResource> grantsOnTarget) {
      SynchronizationPlan<GrantResource> plan = new SynchronizationPlan<>();
      plan.createEntity(tableScopedGrant);
      return plan;
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

  /** Stub {@link PolarisService} that tracks how often Iceberg and catalog-role sync is attempted. */
  private static class TrackingPolarisService implements PolarisService {

    private final List<Catalog> catalogs;
    final List<GrantResource> grantsAdded = new ArrayList<>();
    int initializeIcebergCatalogServiceCalls = 0;
    int listCatalogRolesCalls = 0;

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
    public void createCatalog(Catalog catalog) {}

    @Override
    public void dropCatalogCascade(String catalogName) {}

    @Override
    public List<CatalogRole> listCatalogRoles(String catalogName) {
      listCatalogRolesCalls++;
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
    public void addGrant(String catalogName, String catalogRoleName, GrantResource grant) {
      grantsAdded.add(grant);
    }

    @Override
    public void revokeGrant(String catalogName, String catalogRoleName, GrantResource grant) {}

    @Override
    public IcebergCatalogService initializeIcebergCatalogService(String catalogName) {
      initializeIcebergCatalogServiceCalls++;
      return new CountingIcebergCatalogService();
    }

    @Override
    public void close() {}
  }

  @Test
  public void testSkipIcebergContentSkipsIcebergSyncButStillSyncsCatalogRoles() {
    TrackingPolarisService source = new TrackingPolarisService(List.of(catalog));
    TrackingPolarisService target = new TrackingPolarisService(List.of());

    PolarisSynchronizer synchronizer =
        new PolarisSynchronizer(
            null,
            false,
            new SingleCatalogPlanner(),
            source,
            target,
            new NoOpETagManager(),
            false,
            true);

    synchronizer.syncCatalogs();

    Assertions.assertEquals(0, source.initializeIcebergCatalogServiceCalls);
    Assertions.assertEquals(0, target.initializeIcebergCatalogServiceCalls);
    Assertions.assertEquals(1, source.listCatalogRolesCalls);
    Assertions.assertEquals(1, target.listCatalogRolesCalls);
  }

  @Test
  public void testIcebergContentSyncedWhenNotSkipped() {
    TrackingPolarisService source = new TrackingPolarisService(List.of(catalog));
    TrackingPolarisService target = new TrackingPolarisService(List.of());

    PolarisSynchronizer synchronizer =
        new PolarisSynchronizer(
            null,
            false,
            new SingleCatalogPlanner(),
            source,
            target,
            new NoOpETagManager(),
            false,
            false);

    synchronizer.syncCatalogs();

    Assertions.assertEquals(1, source.initializeIcebergCatalogServiceCalls);
    Assertions.assertEquals(1, target.initializeIcebergCatalogServiceCalls);
    Assertions.assertEquals(1, source.listCatalogRolesCalls);
    Assertions.assertEquals(1, target.listCatalogRolesCalls);
  }

  /**
   * Documents a known consequence of {@code --skip-iceberg-content}: grant sync is not scoped by
   * grant type, so a TABLE- or NAMESPACE-scoped grant is still applied to the target even though the
   * table/namespace it refers to was never synced. Against a real Polaris server this would likely
   * fail server-side (grant referencing an unknown resource); this test only proves the client still
   * attempts it.
   */
  @Test
  public void testTableScopedGrantsStillAttemptedWhenIcebergContentSkipped() {
    TrackingPolarisService source = new TrackingPolarisService(List.of(catalog));
    TrackingPolarisService target = new TrackingPolarisService(List.of());

    PolarisSynchronizer synchronizer =
        new PolarisSynchronizer(
            null,
            false,
            new SingleCatalogWithGrantPlanner(),
            source,
            target,
            new NoOpETagManager(),
            false,
            true);

    synchronizer.syncCatalogs();

    Assertions.assertEquals(0, source.initializeIcebergCatalogServiceCalls);
    Assertions.assertEquals(0, target.initializeIcebergCatalogServiceCalls);
    Assertions.assertEquals(List.of(tableScopedGrant), target.grantsAdded);
  }
}
