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

import org.apache.polaris.management.ApiException;
import org.apache.polaris.management.client.PolarisManagementDefaultApi;
import org.apache.http.HttpStatus;
import org.apache.iceberg.CatalogUtil;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.SupportsNamespaces;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.polaris.core.admin.model.AddGrantRequest;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.CatalogRole;
import org.apache.polaris.core.admin.model.CreateCatalogRequest;
import org.apache.polaris.core.admin.model.CreateCatalogRoleRequest;
import org.apache.polaris.core.admin.model.CreatePrincipalRequest;
import org.apache.polaris.core.admin.model.CreatePrincipalRoleRequest;
import org.apache.polaris.core.admin.model.GrantCatalogRoleRequest;
import org.apache.polaris.core.admin.model.GrantPrincipalRoleRequest;
import org.apache.polaris.core.admin.model.GrantResource;
import org.apache.polaris.core.admin.model.Principal;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.core.admin.model.RevokeGrantRequest;
import org.apache.polaris.tools.sync.polaris.catalog.PolarisCatalog;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service class that wraps Polaris HTTP client and performs recursive operations
 * like drops on overwrites.
 */
public class PolarisService {

    private final PolarisManagementDefaultApi api;

    private final Map<String, String> catalogProperties;

    public PolarisService(PolarisManagementDefaultApi api, Map<String, String> catalogProperties) {
        this.api = api;
        this.catalogProperties = catalogProperties;
    }

    public List<Principal> listPrincipals() {
        return this.api.listPrincipals().getPrincipals();
    }

    public Principal getPrincipal(String principalName) {
        return this.api.getPrincipal(principalName);
    }

    public boolean principalExists(String principalName) {
        try {
            getPrincipal(principalName);
            return true;
        } catch (ApiException apiException) {
            if (apiException.getCode() == HttpStatus.SC_NOT_FOUND) {
                return false;
            }
            throw apiException;
        }
    }

    public PrincipalWithCredentials createPrincipal(Principal principal, boolean overwrite) {
        if (overwrite) {
            removePrincipal(principal.getName());
        }

        CreatePrincipalRequest request = new CreatePrincipalRequest().principal(principal);
        return this.api.createPrincipal(request);
    }

    public void removePrincipal(String principalName) {
        this.api.deletePrincipal(principalName);
    }

    public void assignPrincipalRole(String principalName, String principalRoleName) {
        GrantPrincipalRoleRequest request = new GrantPrincipalRoleRequest()
                .principalRole(new PrincipalRole().name(principalRoleName));
        this.api.assignPrincipalRole(principalName, request);
    }

    public void createPrincipalRole(PrincipalRole principalRole, boolean overwrite) {
        if (overwrite) {
            removePrincipalRole(principalRole.getName());
        }
        CreatePrincipalRoleRequest request = new CreatePrincipalRoleRequest().principalRole(principalRole);
        this.api.createPrincipalRole(request);
    }

    public List<PrincipalRole> listPrincipalRolesAssignedForPrincipal(String principalName) {
        return this.api.listPrincipalRolesAssigned(principalName).getRoles();
    }

    public List<PrincipalRole> listPrincipalRoles() {
        return this.api.listPrincipalRoles().getRoles();
    }

    public List<PrincipalRole> listAssigneePrincipalRolesForCatalogRole(String catalogName, String catalogRoleName) {
        return this.api.listAssigneePrincipalRolesForCatalogRole(catalogName, catalogRoleName).getRoles();
    }

    public void assignCatalogRoleToPrincipalRole(String principalRoleName, String catalogName, String catalogRoleName) {
        GrantCatalogRoleRequest request = new GrantCatalogRoleRequest()
                .catalogRole(new CatalogRole().name(catalogRoleName));
        this.api.assignCatalogRoleToPrincipalRole(principalRoleName, catalogName, request);
    }

    public void removeCatalogRoleFromPrincipalRole(String principalRoleName, String catalogName, String catalogRoleName) {
        this.api.revokeCatalogRoleFromPrincipalRole(principalRoleName, catalogName, catalogRoleName);
    }

    public PrincipalRole getPrincipalRole(String principalRoleName) {
        return this.api.getPrincipalRole(principalRoleName);
    }

    public boolean principalRoleExists(String principalRoleName) {
        try {
            getPrincipalRole(principalRoleName);
            return true;
        } catch (ApiException apiException) {
            if (apiException.getCode() == HttpStatus.SC_NOT_FOUND) {
                return false;
            }
            throw apiException;
        }
    }

    public void removePrincipalRole(String principalRoleName) {
        this.api.deletePrincipalRole(principalRoleName);
    }

    public List<Catalog> listCatalogs() {
        return this.api.listCatalogs().getCatalogs();
    }

    public void createCatalog(Catalog catalog) {
        CreateCatalogRequest request = new CreateCatalogRequest().catalog(catalog);
        this.api.createCatalog(request);
    }

    /**
     * Performs a cascading drop on the catalog before recreating.
     * @param catalog
     * @param omnipotentPrincipal necessary to initialize an Iceberg catalog to drop catalog internals
     */
    public void overwriteCatalog(Catalog catalog, PrincipalWithCredentials omnipotentPrincipal) {
        removeCatalogCascade(catalog.getName(), omnipotentPrincipal);
        createCatalog(catalog);
    }

    /**
     * Recursively discover all namespaces contained within an Iceberg catalog
     * @param catalog
     * @return a list of all the namespaces in the catalog
     */
    private List<Namespace> discoverAllNamespaces(org.apache.iceberg.catalog.Catalog catalog) {
        List<Namespace> namespaces = new ArrayList<>();
        namespaces.add(Namespace.empty());

        if (catalog instanceof SupportsNamespaces namespaceCatalog) {
            namespaces.addAll(discoverContainedNamespaces(namespaceCatalog, Namespace.empty()));
        }

        return namespaces;
    }

    /**
     * Discover all child namespaces of a given namespace
     * @param namespaceCatalog a catalog that supports nested namespaces
     * @param namespace the namespace to look under
     * @return a list of all child namespaces
     */
    private List<Namespace> discoverContainedNamespaces(SupportsNamespaces namespaceCatalog, Namespace namespace) {
        List<Namespace> immediateChildren = namespaceCatalog.listNamespaces(namespace);

        List<Namespace> namespaces = new ArrayList<>();

        for (Namespace ns : immediateChildren) {
            namespaces.add(ns);

            // discover children of child namespace
            namespaces.addAll(discoverContainedNamespaces(namespaceCatalog, ns));
        }

        return namespaces;
    }

    /**
     * Perform a cascading drop of a catalog. Removes all namespaces, tables, catalog-roles first.
     * @param catalogName
     * @param omnipotentPrincipal
     */
    public void removeCatalogCascade(String catalogName, PrincipalWithCredentials omnipotentPrincipal) {
        org.apache.iceberg.catalog.Catalog icebergCatalog = initializeCatalog(catalogName, omnipotentPrincipal);

        // find all namespaces in the catalog
        List<Namespace> namespaces = discoverAllNamespaces(icebergCatalog);

        List<TableIdentifier> tables = new ArrayList<>();

        // find all tables in the catalog
        for (Namespace ns : namespaces) {
            if (!ns.isEmpty()) {
                tables.addAll(icebergCatalog.listTables(ns));
            }
        }

        // drop every table in the catalog
        for (TableIdentifier table : tables) {
            icebergCatalog.dropTable(table);
        }

        // drop every namespace in the catalog, note that because we discovered the namespaces
        // parent-first, we should reverse over the namespaces to ensure that we drop child namespaces
        // before we drop parent namespaces, as we cannot drop nonempty namespaces
        for (Namespace ns : namespaces.reversed()) {
            // NOTE: this is checking if the namespace is not the empty namespace, not if it is empty
            // in the sense of containing no tables/namespaces
            if (!ns.isEmpty() && icebergCatalog instanceof SupportsNamespaces namespaceCatalog) {
                namespaceCatalog.dropNamespace(ns);
            }
        }

        List<CatalogRole> catalogRoles = listCatalogRoles(catalogName);

        // remove catalog roles under catalog
        for (CatalogRole catalogRole : catalogRoles) {
            if (catalogRole.getName().equals("catalog_admin")) continue;

            removeCatalogRole(catalogName, catalogRole.getName());
        }

        this.api.deleteCatalog(catalogName);
    }

    public List<CatalogRole> listCatalogRoles(String catalogName) {
        return this.api.listCatalogRoles(catalogName).getRoles();
    }

    public CatalogRole getCatalogRole(String catalogName, String catalogRoleName) {
        return this.api.getCatalogRole(catalogName, catalogRoleName);
    }

    public boolean catalogRoleExists(String catalogName, String catalogRoleName) {
        try {
            getCatalogRole(catalogName, catalogRoleName);
            return true;
        } catch (ApiException apiException) {
            if (apiException.getCode() == HttpStatus.SC_NOT_FOUND) {
                return false;
            }
            throw apiException;
        }
    }

    public void assignCatalogRole(String principalRoleName, String catalogName, String catalogRoleName) {
        GrantCatalogRoleRequest request = new GrantCatalogRoleRequest()
                .catalogRole(new CatalogRole().name(catalogRoleName));
        this.api.assignCatalogRoleToPrincipalRole(principalRoleName, catalogName, request);
    }

    public void createCatalogRole(String catalogName, CatalogRole catalogRole, boolean overwrite) {
        if (overwrite) {
            removeCatalogRole(catalogName, catalogRole.getName());
        }

        CreateCatalogRoleRequest request = new CreateCatalogRoleRequest().catalogRole(catalogRole);
        this.api.createCatalogRole(catalogName, request);
    }

    public void removeCatalogRole(String catalogName, String catalogRoleName) {
        this.api.deleteCatalogRole(catalogName, catalogRoleName);
    }

    public List<GrantResource> listGrants(String catalogName, String catalogRoleName) {
        return this.api.listGrantsForCatalogRole(catalogName, catalogRoleName).getGrants();
    }

    public void addGrant(String catalogName, String catalogRoleName, GrantResource grant) {
        AddGrantRequest addGrantRequest = new AddGrantRequest().grant(grant);
        this.api.addGrantToCatalogRole(catalogName, catalogRoleName, addGrantRequest);
    }

    public void revokeGrant(String catalogName, String catalogRoleName, GrantResource grant) {
        RevokeGrantRequest revokeGrantRequest = new RevokeGrantRequest().grant(grant);
        this.api.revokeGrantFromCatalogRole(catalogName, catalogRoleName, false, revokeGrantRequest);
    }

    public org.apache.iceberg.catalog.Catalog initializeCatalog(String catalogName, PrincipalWithCredentials migratorPrincipal) {
        Map<String, String> currentCatalogProperties = new HashMap<>(catalogProperties);
        currentCatalogProperties.put("warehouse", catalogName);

        String clientId = migratorPrincipal.getCredentials().getClientId();
        String clientSecret = migratorPrincipal.getCredentials().getClientSecret();
        currentCatalogProperties.putIfAbsent("credential", String.format("%s:%s", clientId, clientSecret));
        currentCatalogProperties.putIfAbsent("scope", "PRINCIPAL_ROLE:ALL");

        return CatalogUtil.loadCatalog(
                PolarisCatalog.class.getName(), "SOURCE_CATALOG_REST", currentCatalogProperties, null);
    }

    /**
     * Perform cascading drop of a namespace
     * @param icebergCatalog the iceberg catalog to use
     * @param namespace the namespace to drop
     */
    public void dropNamespaceCascade(org.apache.iceberg.catalog.Catalog icebergCatalog, Namespace namespace) {
        if (icebergCatalog instanceof SupportsNamespaces namespaceCatalog) {
            List<Namespace> namespaces = discoverContainedNamespaces(namespaceCatalog, namespace);

            List<TableIdentifier> tables = new ArrayList<>();

            for (Namespace ns : namespaces) {
                tables.addAll(icebergCatalog.listTables(ns));
            }

            tables.addAll(icebergCatalog.listTables(namespace));

            for (TableIdentifier table : tables) {
                icebergCatalog.dropTable(table);
            }

            // go over in reverse order of namespaces since we discover namespaces
            // in the parent -> child order, so we need to drop all children
            // before we can drop the parent
            for (Namespace ns : namespaces.reversed()) {
                namespaceCatalog.dropNamespace(ns);
            }

            namespaceCatalog.dropNamespace(namespace);
        }
    }

}
