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
package org.apache.polaris.tools.sync.polaris.access;

import static org.apache.polaris.core.admin.model.CatalogPrivilege.*;
import static org.apache.polaris.tools.sync.polaris.access.AccessControlConstants.OMNIPOTENCE_PROPERTY;
import static org.apache.polaris.tools.sync.polaris.access.AccessControlConstants.OMNIPOTENT_PRINCIPAL_NAME_PREFIX;

import java.util.List;
import java.util.NoSuchElementException;
import org.apache.polaris.core.admin.model.CatalogGrant;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.Principal;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.PolarisService;

/**
 * Service class to facilitate the access control needs of the synchronization. This involves
 * setting up principals, principal roles, catalog roles, and grants to allow the tool to be able to
 * introspect into catalog internals like catalog-roles, tables, grants.
 */
public class AccessControlService {

  private final PolarisService polaris;

  public AccessControlService(PolarisService polaris) {
    this.polaris = polaris;
  }

  /**
   * Creates or replaces the existing omnipotent principal on the provided polaris instance.
   *
   * @param replace if true, if an existing omnipotent principal role exists, it will be dropped and
   *     recreated
   * @return the principal and credentials for the omnipotent principal
   */
  public PrincipalWithCredentials createOmnipotentPrincipal(boolean replace) {
    List<Principal> principals = polaris.listPrincipals();

    Principal omnipotentPrincipalPrototype =
        new Principal()
            .name(OMNIPOTENT_PRINCIPAL_NAME_PREFIX + System.currentTimeMillis())
            .putPropertiesItem(
                OMNIPOTENCE_PROPERTY, ""); // this property identifies the omnipotent principal

    for (Principal principal : principals) {
      if (principal.getProperties() != null
          && principal.getProperties().containsKey(OMNIPOTENCE_PROPERTY)) {
        if (replace) {
          // drop existing omnipotent principal in preparation for replacement
          polaris.removePrincipal(principal.getName());
        } else {
          // we cannot create another omnipotent principal and cannot replace the existing, fail
          throw new IllegalStateException(
              "Not permitted to replace existing omnipotent principal, but omnipotent "
                  + "principal with property "
                  + OMNIPOTENCE_PROPERTY
                  + " already exists");
        }
      }
    }

    // existing principal with identifying property does not exist, create a new one
    return polaris.createPrincipal(omnipotentPrincipalPrototype, false);
  }

  /**
   * Retrieves the omnipotent principal role for the provided principalName
   *
   * @param principalName the principal name to search for roles with
   * @return the principal role for the provided principal, if exists
   */
  public PrincipalRole getOmnipotentPrincipalRoleForPrincipal(String principalName) {
    List<PrincipalRole> principalRolesAssigned =
        polaris.listPrincipalRolesAssignedForPrincipal(principalName);

    return principalRolesAssigned.stream()
        .filter(
            principalRole ->
                principalRole.getProperties() != null
                    && principalRole.getProperties().containsKey(OMNIPOTENCE_PROPERTY))
        .findFirst()
        .orElseThrow(
            () ->
                new NoSuchElementException(
                    "No omnipotent principal role with property "
                        + OMNIPOTENCE_PROPERTY
                        + " exists for principal "
                        + principalName));
  }

  /**
   * Creates a principal role for the omnipotent principal and assigns it to the provided omnipotent
   * principal.
   *
   * @param omnipotentPrincipal the principal to create and assign the role for
   * @param replace if true, drops existing omnipotent principal roles if they exist before creating
   *     the new one
   * @return the principal role for the omnipotent principal
   */
  public PrincipalRole createAndAssignPrincipalRole(
      PrincipalWithCredentials omnipotentPrincipal, boolean replace) {
    List<PrincipalRole> principalRoles = polaris.listPrincipalRoles();

    PrincipalRole omnipotentPrincipalRole =
        new PrincipalRole()
            .name(omnipotentPrincipal.getPrincipal().getName())
            .putPropertiesItem(OMNIPOTENCE_PROPERTY, "");

    for (PrincipalRole principalRole : principalRoles) {
      if (principalRole.getProperties() != null
          && principalRole.getProperties().containsKey(OMNIPOTENCE_PROPERTY)) {
        // replace existing principal role if exists
        if (replace) {
          polaris.removePrincipalRole(principalRole.getName());
        } else {
          throw new IllegalStateException(
              "Not permitted to replace existing omnipotent principal role, but omnipotent "
                  + "principal role with property "
                  + OMNIPOTENCE_PROPERTY
                  + " already exists");
        }
      }
    }

    polaris.createPrincipalRole(omnipotentPrincipalRole, false);
    polaris.assignPrincipalRole(
        omnipotentPrincipal.getPrincipal().getName(), omnipotentPrincipalRole.getName());
    return omnipotentPrincipalRole;
  }

  /**
   * Creates an omnipotent catalog role for a catalog and assigns it to the provided omnipotent
   * principal role
   *
   * @param catalogName the catalog to create the catalog role for
   * @param omnipotentPrincipalRole the omnipotent principal role to assign the created catalog role
   *     to
   * @param replace if true, drops and recreates the existing omnipotent catalog role
   * @return the created omnipotent catalog role
   */
  public CatalogRole createAndAssignCatalogRole(
      String catalogName, PrincipalRole omnipotentPrincipalRole, boolean replace) {
    List<CatalogRole> catalogRoles = polaris.listCatalogRoles(catalogName);

    for (CatalogRole catalogRole : catalogRoles) {
      if (catalogRole.getProperties() != null
          && catalogRole.getProperties().containsKey(OMNIPOTENCE_PROPERTY)) {
        if (replace) {
          polaris.removeCatalogRole(catalogName, catalogRole.getName());
        } else {
          throw new IllegalStateException(
              "Not permitted to replace existing omnipotent catalog role for catalog "
                  + catalogName
                  + ", but omnipotent principal with property "
                  + OMNIPOTENCE_PROPERTY
                  + " already exists");
        }
      }
    }

    CatalogRole omnipotentCatalogRole =
        new CatalogRole()
            .name(omnipotentPrincipalRole.getName())
            .putPropertiesItem(OMNIPOTENCE_PROPERTY, "");

    polaris.createCatalogRole(catalogName, omnipotentCatalogRole, false /* overwrite */);
    polaris.assignCatalogRole(
        omnipotentPrincipalRole.getName(), catalogName, omnipotentCatalogRole.getName());
    return omnipotentCatalogRole;
  }

  /**
   * Adds grants for privilege level desired on the omnipotent catalog role
   *
   * @param catalogName the catalog to identify the role in
   * @param catalogRoleName the name of the catalog role to assign the grants tpo
   * @param withWriteAccess if the catalog role should be given write access to the catalog
   *     internals
   * @return the grants that were added to the catalog role
   */
  public List<CatalogGrant> addGrantsToCatalogRole(
      String catalogName, String catalogRoleName, boolean withWriteAccess) {
    if (withWriteAccess) {
      // write access only requires CATALOG_MANAGE_METADATA
      CatalogGrant catalogManageMetadata =
          new CatalogGrant()
              .type(GrantResource.TypeEnum.CATALOG)
              .privilege(CATALOG_MANAGE_METADATA);

      polaris.addGrant(catalogName, catalogRoleName, catalogManageMetadata);
      return List.of(catalogManageMetadata);
    } else {
      // read access requires reading properties and listing entities for each entity type
      CatalogGrant catalogReadProperties =
          new CatalogGrant()
              .type(GrantResource.TypeEnum.CATALOG)
              .privilege(CATALOG_READ_PROPERTIES);

      CatalogGrant namespaceReadProperties =
          new CatalogGrant()
              .type(GrantResource.TypeEnum.CATALOG)
              .privilege(NAMESPACE_READ_PROPERTIES);

      CatalogGrant namespaceList =
          new CatalogGrant().type(GrantResource.TypeEnum.CATALOG).privilege(NAMESPACE_LIST);

      CatalogGrant tableReadProperties =
          new CatalogGrant().type(GrantResource.TypeEnum.CATALOG).privilege(TABLE_READ_PROPERTIES);

      CatalogGrant tableList =
          new CatalogGrant().type(GrantResource.TypeEnum.CATALOG).privilege(TABLE_LIST);

      CatalogGrant viewReadProperties =
          new CatalogGrant().type(GrantResource.TypeEnum.CATALOG).privilege(VIEW_READ_PROPERTIES);

      CatalogGrant viewList =
          new CatalogGrant().type(GrantResource.TypeEnum.CATALOG).privilege(VIEW_LIST);

      polaris.addGrant(catalogName, catalogRoleName, catalogReadProperties);
      polaris.addGrant(catalogName, catalogRoleName, namespaceReadProperties);
      polaris.addGrant(catalogName, catalogRoleName, namespaceList);
      polaris.addGrant(catalogName, catalogRoleName, tableReadProperties);
      polaris.addGrant(catalogName, catalogRoleName, tableList);
      polaris.addGrant(catalogName, catalogRoleName, viewReadProperties);
      polaris.addGrant(catalogName, catalogRoleName, viewList);
      return List.of(
          catalogReadProperties, namespaceReadProperties, tableReadProperties, viewReadProperties);
    }
  }

  /**
   * Determines if an omnipotent catalog role already exists for this catalog
   *
   * @param catalogName the catalog to search in
   * @return true if exists, false otherwise
   */
  public boolean omnipotentCatalogRoleExists(String catalogName) {
    List<CatalogRole> catalogRoles = polaris.listCatalogRoles(catalogName);

    return catalogRoles.stream()
        .anyMatch(
            catalogRole ->
                catalogRole.getProperties() != null
                    && catalogRole.getProperties().containsKey(OMNIPOTENCE_PROPERTY));
  }

  /**
   * Creates catalog role for catalog, assigns it to provided principal role, and assigns grants
   * with appropriate privilege level
   *
   * @param catalogName the catalog to create the role for
   * @param omnipotentPrincipalRole the principal role to assign the catalog role to
   * @param replace if true, drops the existing catalog role if it exists
   * @param withWriteAccess gives write access to the catalog role
   */
  public void setupOmnipotentRoleForCatalog(
      String catalogName,
      PrincipalRole omnipotentPrincipalRole,
      boolean replace,
      boolean withWriteAccess) {
    CatalogRole omniPotentCatalogRole =
        createAndAssignCatalogRole(catalogName, omnipotentPrincipalRole, replace);
    addGrantsToCatalogRole(catalogName, omniPotentCatalogRole.getName(), withWriteAccess);
  }
}
