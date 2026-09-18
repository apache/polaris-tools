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

import org.apache.iceberg.CatalogUtil;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.rest.ResourcePaths;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.catalog.PolarisCatalog;
import org.apache.polaris.tools.sync.polaris.service.IcebergCatalogService;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PolarisIcebergCatalogService implements IcebergCatalogService {

    private final PolarisCatalog catalog;

    public PolarisIcebergCatalogService(
            String baseUrl,
            String catalogName,
            PrincipalWithCredentials omnipotentPrincipal,
            Map<String, String> properties
    ) {
        Map<String, String> catalogProperties = new HashMap<>();
        String uri = baseUrl + "/api/catalog";
        catalogProperties.put("uri", uri);
        catalogProperties.put("warehouse", catalogName);

        // Default to /v1/oauth/tokens endpoint unless an explicit property was provided
        String oauth2ServerUri = properties.getOrDefault(
                "omnipotent-principal-oauth2-server-uri", uri + "/" + ResourcePaths.tokens());

        catalogProperties.put("oauth2-server-uri", oauth2ServerUri);

        String clientId = omnipotentPrincipal.getCredentials().getClientId();
        String clientSecret = omnipotentPrincipal.getCredentials().getClientSecret();
        catalogProperties.putIfAbsent(
                "credential", String.format("%s:%s", clientId, clientSecret));
        catalogProperties.putIfAbsent("scope", "PRINCIPAL_ROLE:ALL");

        // forward the realm-context header on every Iceberg REST catalog call, leveraging
        // RESTSessionCatalog's built-in "header.<name>" -> HTTP header property convention
        String realm = properties.get("realm");
        if (realm != null) {
            String realmHeaderName = properties.getOrDefault("realm-header-name", "Polaris-Realm");
            catalogProperties.put("header." + realmHeaderName, realm);
        }

        this.catalog = (PolarisCatalog) CatalogUtil.loadCatalog(
                PolarisCatalog.class.getName(),
                "SOURCE_CATALOG_REST_" + catalogName,
                catalogProperties,
                null
        );
    }

    @Override
    public List<Namespace> listNamespaces(Namespace parentNamespace) {
        return this.catalog.listNamespaces(parentNamespace);
    }

    /**
     * List all namespaces in hierarchy underneath a particular namespace in addition to all
     * immediate children.
     * @param parentNamespace the namespace to search for child namespaces under
     * @return all child namespaces in hierarchy
     */
    private List<Namespace> listAllChildNamespaces(Namespace parentNamespace) {
        List<Namespace> immediateChildren = this.listNamespaces(parentNamespace);

        List<Namespace> allChildNamespaces = new ArrayList<>(immediateChildren);

        for (Namespace childNamespace : immediateChildren) {
            allChildNamespaces.addAll(this.listAllChildNamespaces(childNamespace));
        }

        return allChildNamespaces;
    }

    @Override
    public Map<String, String> loadNamespaceMetadata(Namespace namespace) {
        return this.catalog.loadNamespaceMetadata(namespace);
    }

    @Override
    public void createNamespace(Namespace namespace, Map<String, String> namespaceMetadata) {
        this.catalog.createNamespace(namespace, namespaceMetadata);
    }

    @Override
    public void setNamespaceProperties(Namespace namespace, Map<String, String> namespaceProperties) {
        this.catalog.setProperties(namespace, namespaceProperties);
    }

    @Override
    public void dropNamespaceCascade(Namespace namespace) {
        List<Namespace> allChildNamespaces = this.listAllChildNamespaces(namespace);

        List<TableIdentifier> tables = new ArrayList<>();

        for (Namespace childNamespace : allChildNamespaces) {
            tables.addAll(this.catalog.listTables(childNamespace));
        }

        if (!namespace.isEmpty()) {
            tables.addAll(this.catalog.listTables(namespace));
        }

        for (TableIdentifier tableIdentifier : tables) {
            this.catalog.dropTable(tableIdentifier);
        }

        // go over in reverse order of namespaces since we discover namespaces
        // in the parent -> child order, so we need to drop all children
        // before we can drop the parent
        for (Namespace childNamespace : allChildNamespaces.reversed()) {
            this.catalog.dropNamespace(childNamespace);
        }

        if (!namespace.isEmpty()) {
            this.catalog.dropNamespace(namespace);
        }
    }

    @Override
    public List<TableIdentifier> listTables(Namespace namespace) {
        return this.catalog.listTables(namespace);
    }

    @Override
    public Table loadTable(TableIdentifier tableIdentifier) {
        return this.catalog.loadTable(tableIdentifier);
    }

    public Table loadTable(TableIdentifier tableIdentifier, String etag) {
        return this.catalog.loadTable(tableIdentifier, etag);
    }

    @Override
    public void registerTable(TableIdentifier tableIdentifier, String metadataFileLocation) {
        this.catalog.registerTable(tableIdentifier, metadataFileLocation);
    }

    @Override
    public void dropTableWithoutPurge(TableIdentifier tableIdentifier) {
        this.catalog.dropTable(tableIdentifier, false /* purge */);
    }

    @Override
    public void close() throws IOException {
        this.catalog.close();
    }

}
