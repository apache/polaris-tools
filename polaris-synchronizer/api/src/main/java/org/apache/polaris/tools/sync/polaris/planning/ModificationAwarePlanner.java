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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.tools.sync.polaris.planning.plan.SynchronizationPlan;

/** Planner that checks for modifications and plans to skip entities that have not been modified. */
public class ModificationAwarePlanner implements SynchronizationPlanner {

  private static final String CREATE_TIMESTAMP = "createTimestamp";

  private static final String LAST_UPDATE_TIMESTAMP = "lastUpdateTimestamp";

  private static final String ENTITY_VERSION = "entityVersion";

  private static final List<String> DEFAULT_KEYS_TO_IGNORE =
      List.of(CREATE_TIMESTAMP, LAST_UPDATE_TIMESTAMP, ENTITY_VERSION);

  private static final List<String> CATALOG_KEYS_TO_IGNORE =
      List.of(
          // defaults
          CREATE_TIMESTAMP,
          LAST_UPDATE_TIMESTAMP,
          ENTITY_VERSION,

          // For certain storageConfigInfo fields, depending on the credentials Polaris was set up
          // with
          // to access the storage, some fields will always be different across the source and the
          // target.
          // For example, for S3 my source and target Polaris instances may be set up with different
          // AWS users,
          // each of which assumes the same role to access the storage

          // S3
          "storageConfigInfo.userArn",

          // AZURE
          "storageConfigInfo.consentUrl",
          "storageConfigInfo.multiTenantAppName",

          // GCP
          "storageConfigInfo.gcsServiceAccount");

  private final SynchronizationPlanner delegate;

  private final ObjectMapper objectMapper;

  public ModificationAwarePlanner(SynchronizationPlanner delegate) {
    this.objectMapper = new ObjectMapper();
    this.delegate = delegate;
  }

  /**
   * Removes keys from the provided map.
   *
   * @param map the map to remove the keys from
   * @param keysToRemove a list of keys, nested keys should be separated by '.' eg. "key1.key2"
   * @return the map with the keys removed
   */
  private Map<String, Object> removeKeys(Map<String, Object> map, List<String> keysToRemove) {
    Map<String, Object> cleaned =
        objectMapper.convertValue(map, new TypeReference<Map<String, Object>>() {});

    for (String key : keysToRemove) {
      // splits key into first part and rest, eg. key1.key2.key3 becomes [key1, key2.key3]
      String[] separateFirst = key.split("\\.", 2);
      String primary = separateFirst[0];

      if (separateFirst.length > 1) {
        // if there are more nested keys, we want to recursively search the sub map if it exists
        Object valueForPrimary = cleaned.get(primary); // get object for primary key if it exists

        if (valueForPrimary == null) {
          continue;
        }

        try {
          Map<String, Object> subMap =
              objectMapper.convertValue(valueForPrimary, new TypeReference<>() {});
          Map<String, Object> cleanedSubMap =
              removeKeys(subMap, List.of(separateFirst[1])); // remove nested keys from submap
          cleaned.put(primary, cleanedSubMap); // replace sub-map with key removed
        } catch (IllegalArgumentException e) {
          // do nothing because that means the key does not exist, no need to remove it
        }
      } else {
        cleaned.remove(primary); // just remove the key if we have no more nesting
      }
    }

    return cleaned;
  }

  /**
   * Compares two objects to see if they are the same
   *
   * @param o1
   * @param o2
   * @param keysToIgnore list of keys to ignore in the comparison
   * @return true if they are the same, false otherwise
   */
  private boolean areSame(Object o1, Object o2, List<String> keysToIgnore) {
    Map<String, Object> o1AsMap = objectMapper.convertValue(o1, new TypeReference<>() {});
    Map<String, Object> o2AsMap = objectMapper.convertValue(o2, new TypeReference<>() {});
    o1AsMap = removeKeys(o1AsMap, keysToIgnore);
    o2AsMap = removeKeys(o2AsMap, keysToIgnore);
    return o1AsMap.equals(o2AsMap);
  }

  private boolean areSame(Object o1, Object o2) {
    return areSame(o1, o2, DEFAULT_KEYS_TO_IGNORE);
  }

  @Override
  public SynchronizationPlan<PrincipalRole> planPrincipalRoleSync(
      List<PrincipalRole> principalRolesOnSource, List<PrincipalRole> principalRolesOnTarget) {
    Map<String, PrincipalRole> sourceRolesByName = new HashMap<>();
    Map<String, PrincipalRole> targetRolesByName = new HashMap<>();

    List<PrincipalRole> notModifiedPrincipalRoles = new ArrayList<>();

    principalRolesOnSource.forEach(role -> sourceRolesByName.put(role.getName(), role));
    principalRolesOnTarget.forEach(role -> targetRolesByName.put(role.getName(), role));

    for (PrincipalRole sourceRole : principalRolesOnSource) {
      if (targetRolesByName.containsKey(sourceRole.getName())) {
        PrincipalRole targetRole = targetRolesByName.get(sourceRole.getName());

        if (areSame(sourceRole, targetRole)) {
          targetRolesByName.remove(targetRole.getName());
          sourceRolesByName.remove(sourceRole.getName());
          notModifiedPrincipalRoles.add(sourceRole);
        }
      }
    }

    SynchronizationPlan<PrincipalRole> delegatedPlan =
        delegate.planPrincipalRoleSync(
            sourceRolesByName.values().stream().toList(),
            targetRolesByName.values().stream().toList());

    for (PrincipalRole principalRole : notModifiedPrincipalRoles) {
      delegatedPlan.skipEntityNotModified(principalRole);
    }

    return delegatedPlan;
  }

  private boolean areSame(Catalog source, Catalog target) {
    return areSame(source, target, CATALOG_KEYS_TO_IGNORE)
        // because of the way the jackson serialization works, any class that extends HashMap is
        // serialized
        // with just the fields in the map. Unfortunately, CatalogProperties extends HashMap so we
        // must
        // manually compare the fields in the catalog properties and cannot automatically
        // deserialize them
        // as a map
        && Objects.equals(source.getProperties(), target.getProperties());
  }

  @Override
  public SynchronizationPlan<Catalog> planCatalogSync(
      List<Catalog> catalogsOnSource, List<Catalog> catalogsOnTarget) {
    Map<String, Catalog> sourceCatalogsByName = new HashMap<>();
    Map<String, Catalog> targetCatalogsByName = new HashMap<>();

    List<Catalog> notModifiedCatalogs = new ArrayList<>();

    catalogsOnSource.forEach(catalog -> sourceCatalogsByName.put(catalog.getName(), catalog));
    catalogsOnTarget.forEach(catalog -> targetCatalogsByName.put(catalog.getName(), catalog));

    for (Catalog sourceCatalog : catalogsOnSource) {
      if (targetCatalogsByName.containsKey(sourceCatalog.getName())) {
        Catalog targetCatalog = targetCatalogsByName.get(sourceCatalog.getName());

        if (areSame(sourceCatalog, targetCatalog)) {
          targetCatalogsByName.remove(targetCatalog.getName());
          sourceCatalogsByName.remove(sourceCatalog.getName());
          notModifiedCatalogs.add(sourceCatalog);
        }
      }
    }

    SynchronizationPlan<Catalog> delegatedPlan =
        delegate.planCatalogSync(
            sourceCatalogsByName.values().stream().toList(),
            targetCatalogsByName.values().stream().toList());

    for (Catalog catalog : notModifiedCatalogs) {
      delegatedPlan.skipEntityNotModified(catalog);
    }

    return delegatedPlan;
  }

  @Override
  public SynchronizationPlan<CatalogRole> planCatalogRoleSync(
      String catalogName,
      List<CatalogRole> catalogRolesOnSource,
      List<CatalogRole> catalogRolesOnTarget) {
    Map<String, CatalogRole> sourceCatalogRolesByName = new HashMap<>();
    Map<String, CatalogRole> targetCatalogRolesByName = new HashMap<>();

    List<CatalogRole> notModifiedCatalogRoles = new ArrayList<>();

    catalogRolesOnSource.forEach(role -> sourceCatalogRolesByName.put(role.getName(), role));
    catalogRolesOnTarget.forEach(role -> targetCatalogRolesByName.put(role.getName(), role));

    for (CatalogRole sourceCatalogRole : catalogRolesOnSource) {
      if (targetCatalogRolesByName.containsKey(sourceCatalogRole.getName())) {
        CatalogRole targetCatalogRole = targetCatalogRolesByName.get(sourceCatalogRole.getName());

        if (areSame(sourceCatalogRole, targetCatalogRole)) {
          targetCatalogRolesByName.remove(targetCatalogRole.getName());
          sourceCatalogRolesByName.remove(sourceCatalogRole.getName());
          notModifiedCatalogRoles.add(sourceCatalogRole);
        }
      }
    }

    SynchronizationPlan<CatalogRole> delegatedPlan =
        delegate.planCatalogRoleSync(
            catalogName,
            sourceCatalogRolesByName.values().stream().toList(),
            targetCatalogRolesByName.values().stream().toList());

    for (CatalogRole catalogRole : notModifiedCatalogRoles) {
      delegatedPlan.skipEntityNotModified(catalogRole);
    }

    return delegatedPlan;
  }

  @Override
  public SynchronizationPlan<GrantResource> planGrantSync(
      String catalogName,
      String catalogRoleName,
      List<GrantResource> grantsOnSource,
      List<GrantResource> grantsOnTarget) {
    Set<GrantResource> sourceGrants = new HashSet<>(grantsOnSource);
    Set<GrantResource> targetGrants = new HashSet<>(grantsOnTarget);

    List<GrantResource> notModifiedGrants = new ArrayList<>();

    for (GrantResource grantResource : grantsOnSource) {
      if (targetGrants.contains(grantResource)) {
        sourceGrants.remove(grantResource);
        targetGrants.remove(grantResource);
        notModifiedGrants.add(grantResource);
      }
    }

    SynchronizationPlan<GrantResource> delegatedPlan =
        delegate.planGrantSync(
            catalogName,
            catalogRoleName,
            sourceGrants.stream().toList(),
            targetGrants.stream().toList());

    for (GrantResource grant : notModifiedGrants) {
      delegatedPlan.skipEntityNotModified(grant);
    }

    return delegatedPlan;
  }

  @Override
  public SynchronizationPlan<PrincipalRole> planAssignPrincipalRolesToCatalogRolesSync(
      String catalogName,
      String catalogRoleName,
      List<PrincipalRole> assignedPrincipalRolesOnSource,
      List<PrincipalRole> assignedPrincipalRolesOnTarget) {
    return delegate.planAssignPrincipalRolesToCatalogRolesSync(
        catalogName,
        catalogRoleName,
        assignedPrincipalRolesOnSource,
        assignedPrincipalRolesOnTarget);
  }

  @Override
  public SynchronizationPlan<Namespace> planNamespaceSync(
      String catalogName,
      Namespace namespace,
      List<Namespace> namespacesOnSource,
      List<Namespace> namespacesOnTarget) {
    return delegate.planNamespaceSync(
        catalogName, namespace, namespacesOnSource, namespacesOnTarget);
  }

  @Override
  public SynchronizationPlan<TableIdentifier> planTableSync(
      String catalogName,
      Namespace namespace,
      Set<TableIdentifier> tablesOnSource,
      Set<TableIdentifier> tablesOnTarget) {
    return delegate.planTableSync(catalogName, namespace, tablesOnSource, tablesOnTarget);
  }
}
