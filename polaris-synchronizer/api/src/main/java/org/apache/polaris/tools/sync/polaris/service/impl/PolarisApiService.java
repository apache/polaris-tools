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

package org.apache.polaris.tools.sync.polaris.service.impl;

import org.apache.iceberg.catalog.Namespace;
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
import org.apache.polaris.core.admin.model.PrincipalWithCredentialsCredentials;
import org.apache.polaris.core.admin.model.RevokeGrantRequest;
import org.apache.polaris.management.ApiClient;
import org.apache.polaris.management.client.PolarisManagementDefaultApi;
import org.apache.polaris.tools.sync.polaris.access.AccessControlService;
import org.apache.polaris.tools.sync.polaris.auth.AuthenticationSessionWrapper;
import org.apache.polaris.tools.sync.polaris.service.IcebergCatalogService;
import org.apache.polaris.tools.sync.polaris.service.PolarisService;

import java.util.List;
import java.util.Map;

public class PolarisApiService implements PolarisService {

    /**
     * Property that denotes whether this service should create omnipotent principals
     * with write access when initializing {@link org.apache.iceberg.catalog.Catalog}.
     */
    public static final String ICEBERG_WRITE_ACCESS_PROPERTY = "iceberg-write-access";

    private Map<String, String> properties = null;

    private String baseUrl = null;

    private PolarisManagementDefaultApi api = null;

    private AccessControlService accessControlService = null;

    private PrincipalWithCredentials omnipotentPrincipal = null;

    private PrincipalRole omnipotentPrincipalRole = null;

    private boolean icebergWriteAccess = false;

    public PolarisApiService() {}

    @Override
    public void initialize(Map<String, String> properties) throws Exception {
        this.properties = properties;

        String baseUrl = properties.get("base-url");

        ApiClient client = new ApiClient();
        client.updateBaseUri(baseUrl + "/api/management/v1");

        AuthenticationSessionWrapper authenticationSessionWrapper = new AuthenticationSessionWrapper(properties);

        client.setRequestInterceptor(requestBuilder
                -> authenticationSessionWrapper.getSessionHeaders().forEach(requestBuilder::header));

        this.baseUrl = baseUrl;
        this.api = new PolarisManagementDefaultApi(client);

        this.omnipotentPrincipal = new PrincipalWithCredentials()
                .principal(new Principal().name(properties.get("omnipotent-principal-name")))
                .credentials(new PrincipalWithCredentialsCredentials()
                        .clientId(properties.get("omnipotent-principal-client-id"))
                        .clientSecret(properties.get("omnipotent-principal-client-secret")));

        this.accessControlService = new AccessControlService(this);
        this.icebergWriteAccess = Boolean.parseBoolean(
                properties.getOrDefault(ICEBERG_WRITE_ACCESS_PROPERTY, Boolean.toString(false))); // by default false
    }

    @Override
    public List<Principal> listPrincipals() {
        return this.api.listPrincipals().getPrincipals();
    }

    @Override
    public Principal getPrincipal(String principalName) {
        return this.api.getPrincipal(principalName);
    }

    @Override
    public PrincipalWithCredentials createPrincipal(Principal principal) {
        CreatePrincipalRequest request = new CreatePrincipalRequest().principal(principal);
        return this.api.createPrincipal(request);
    }

    @Override
    public void dropPrincipal(String principalName) {
        this.api.deletePrincipal(principalName);
    }

    @Override
    public List<PrincipalRole> listPrincipalRoles() {
        return this.api.listPrincipalRoles().getRoles();
    }

    @Override
    public PrincipalRole getPrincipalRole(String principalRoleName) {
        return this.api.getPrincipalRole(principalRoleName);
    }

    @Override
    public void createPrincipalRole(PrincipalRole principalRole) {
        CreatePrincipalRoleRequest request = new CreatePrincipalRoleRequest().principalRole(principalRole);
        this.api.createPrincipalRole(request);
    }

    @Override
    public void dropPrincipalRole(String principalRoleName) {
        this.api.deletePrincipalRole(principalRoleName);
    }

    @Override
    public List<PrincipalRole> listPrincipalRolesAssigned(String principalName) {
        return this.api.listPrincipalRolesAssigned(principalName).getRoles();
    }

    @Override
    public void assignPrincipalRole(String principalName, String principalRoleName) {
        GrantPrincipalRoleRequest request = new GrantPrincipalRoleRequest()
                .principalRole(new PrincipalRole().name(principalRoleName));
        this.api.assignPrincipalRole(principalName, request);
    }

    @Override
    public void revokePrincipalRole(String principalName, String principalRoleName) {
        this.api.revokePrincipalRole(principalName, principalRoleName);
    }

    @Override
    public List<Catalog> listCatalogs() {
        return this.api.listCatalogs().getCatalogs();
    }

    @Override
    public Catalog getCatalog(String catalogName) {
        return this.api.getCatalog(catalogName);
    }

    @Override
    public void createCatalog(Catalog catalog) {
        CreateCatalogRequest request = new CreateCatalogRequest().catalog(catalog);
        this.api.createCatalog(request);
        setupOmnipotentCatalogRoleIfNotExists(catalog.getName());
    }

    @Override
    public void dropCatalogCascade(String catalogName) {
        setupOmnipotentCatalogRoleIfNotExists(catalogName);
        IcebergCatalogService icebergCatalogService = this.initializeIcebergCatalogService(catalogName);

        // drop all namespaces within catalog
        icebergCatalogService.dropNamespaceCascade(Namespace.empty());

        List<CatalogRole> catalogRoles = this.listCatalogRoles(catalogName);

        // drop all catalog roles within catalog
        for (CatalogRole catalogRole : catalogRoles) {
            if (!catalogRole.getName().equals("catalog_admin")) {
                this.dropCatalogRole(catalogName, catalogRole.getName());
            }
        }

        this.api.deleteCatalog(catalogName);
    }

    @Override
    public List<CatalogRole> listCatalogRoles(String catalogName) {
        return this.api.listCatalogRoles(catalogName).getRoles();
    }

    @Override
    public CatalogRole getCatalogRole(String catalogName, String catalogRoleName) {
        return this.api.getCatalogRole(catalogName, catalogRoleName);
    }

    @Override
    public void createCatalogRole(String catalogName, CatalogRole catalogRole) {
        CreateCatalogRoleRequest request = new CreateCatalogRoleRequest().catalogRole(catalogRole);
        this.api.createCatalogRole(catalogName, request);
    }

    @Override
    public void dropCatalogRole(String catalogName, String catalogRoleName) {
        this.api.deleteCatalogRole(catalogName, catalogRoleName);
    }

    @Override
    public List<PrincipalRole> listAssigneePrincipalRolesForCatalogRole(String catalogName, String catalogRoleName) {
        return this.api.listAssigneePrincipalRolesForCatalogRole(catalogName, catalogRoleName).getRoles();
    }

    @Override
    public void assignCatalogRole(String principalRoleName, String catalogName, String catalogRoleName) {
        GrantCatalogRoleRequest request = new GrantCatalogRoleRequest()
                .catalogRole(new CatalogRole().name(catalogRoleName));
        this.api.assignCatalogRoleToPrincipalRole(principalRoleName, catalogName, request);
    }

    @Override
    public void revokeCatalogRole(String principalRoleName, String catalogName, String catalogRoleName) {
        this.api.revokeCatalogRoleFromPrincipalRole(principalRoleName, catalogName, catalogRoleName);
    }

    @Override
    public List<GrantResource> listGrants(String catalogName, String catalogRoleName) {
        return this.api.listGrantsForCatalogRole(catalogName, catalogRoleName).getGrants();
    }

    @Override
    public void addGrant(String catalogName, String catalogRoleName, GrantResource grant) {
        AddGrantRequest request = new AddGrantRequest().grant(grant);
        this.api.addGrantToCatalogRole(catalogName, catalogRoleName, request);
    }

    @Override
    public void revokeGrant(String catalogName, String catalogRoleName, GrantResource grant) {
        RevokeGrantRequest request = new RevokeGrantRequest().grant(grant);
        this.api.revokeGrantFromCatalogRole(catalogName, catalogRoleName, false, request);
    }

    private void setupOmnipotentCatalogRoleIfNotExists(String catalogName) {
        if (this.omnipotentPrincipalRole == null) {
            this.omnipotentPrincipalRole =
                    this.accessControlService.getOmnipotentPrincipalRoleForPrincipal(
                            omnipotentPrincipal.getPrincipal().getName());
        }

        if (!this.accessControlService.omnipotentCatalogRoleExists(catalogName)) {
            this.accessControlService.setupOmnipotentRoleForCatalog(
                    catalogName,
                    omnipotentPrincipalRole,
                    false /* replace */,
                    icebergWriteAccess /* withWriteAccess */
            );
        }
    }

    @Override
    public IcebergCatalogService initializeIcebergCatalogService(String catalogName) {
        setupOmnipotentCatalogRoleIfNotExists(catalogName);
        return new PolarisIcebergCatalogService(
                baseUrl, catalogName, omnipotentPrincipal, properties);
    }

}
