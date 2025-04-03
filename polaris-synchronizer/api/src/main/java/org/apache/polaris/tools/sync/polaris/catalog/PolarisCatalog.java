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

package org.apache.polaris.tools.sync.polaris.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.http.HttpHeaders;
import org.apache.http.HttpStatus;
import org.apache.iceberg.BaseTable;
import org.apache.iceberg.CatalogUtil;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Catalog;
import org.apache.iceberg.catalog.SupportsNamespaces;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.catalog.ViewCatalog;
import org.apache.iceberg.hadoop.Configurable;
import org.apache.iceberg.rest.RESTCatalog;
import org.apache.iceberg.rest.ResourcePaths;
import org.apache.iceberg.rest.responses.LoadTableResponse;
import org.apache.iceberg.rest.responses.LoadTableResponseParser;
import org.apache.polaris.tools.sync.polaris.http.OAuth2Util;

import java.io.Closeable;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

/**
 * Overrides loadTable default implementation to issue a custom loadTable request to the Polaris
 * Iceberg REST Api and build the table metadata. This is necessary since the existing {@link RESTCatalog}
 * does not provide a way to capture response headers to retrieve the ETag on a loadTable request.
 */
public class PolarisCatalog extends RESTCatalog implements Catalog, ViewCatalog, SupportsNamespaces, Configurable<Object>, Closeable {

    private String name = null;

    private Map<String, String> properties = null;

    private String accessToken = null;

    private HttpClient httpClient = null;

    private ObjectMapper objectMapper = null;

    private ResourcePaths resourcePaths = null;

    public PolarisCatalog() {
        super();
    }

    @Override
    public void initialize(String name, Map<String, String> props) {
        this.name = name;
        this.properties = props;

        if (resourcePaths == null) {
            this.properties.put("prefix", props.get("warehouse"));
            resourcePaths = ResourcePaths.forCatalogProperties(this.properties);
        }

        if (accessToken == null || httpClient == null || this.objectMapper == null) {
            String oauth2ServerUri = props.get("uri") + "/v1/oauth/tokens";
            String credential = props.get("credential");

            String clientId = credential.split(":")[0];
            String clientSecret = credential.split(":")[1];

            String scope = props.get("scope");

            // TODO: Add token refresh
            try {
                this.accessToken = OAuth2Util.fetchToken(oauth2ServerUri, clientId, clientSecret, scope);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }

            this.httpClient = HttpClient.newBuilder().build();
            this.objectMapper = new ObjectMapper();
        }
        super.initialize(name, props);
    }

    @Override
    public Table loadTable(TableIdentifier ident) {
        return loadTable(ident, null);
    }

    /**
     * Perform a loadTable with a specified ETag in the If-None-Match header.
     * TODO: Remove this once ETag is officially supported in Iceberg
     * @param ident the identifier of the table
     * @param etag the etag
     * @return a {@link BaseTable} if no ETag was found in the response headers.
     * A {@link BaseTableWithETag} if an ETag was included in the response headers.
     * @throws NotModifiedException if the Iceberg REST catalog responded with 304 NOT MODIFIED
     */
    public Table loadTable(TableIdentifier ident, String etag) {
        String catalogName = this.properties.get("warehouse");

        String tablePath = String.format("%s/%s",
                this.properties.get("uri"), resourcePaths.table(ident));

        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(tablePath))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .GET();

        // specify last known etag in if-none-match header
        if (etag != null) {
            requestBuilder.header(HttpHeaders.IF_NONE_MATCH, etag);
        }

        HttpRequest request = requestBuilder.build();

        HttpResponse<String> response;

        try {
            response = this.httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        // api responded with 304 not modified, throw from here to signal
        if (response.statusCode() == HttpStatus.SC_NOT_MODIFIED) {
            throw new NotModifiedException(ident);
        }

        String body = response.body();

        String newETag = null;

        // if etag header is present in response, store new provided etag
        if (response.headers().firstValue(HttpHeaders.ETAG).isPresent()) {
            newETag = response.headers().firstValue(HttpHeaders.ETAG).get();
        }

        // build custom base table with metadata so that tool can retrieve the
        // location and register it on the target side
        LoadTableResponse loadTableResponse = LoadTableResponseParser.fromJson(body);
        MetadataWrapperTableOperations ops = new MetadataWrapperTableOperations(loadTableResponse.tableMetadata());

        if (newETag != null) {
            return new BaseTableWithETag(ops, CatalogUtil.fullTableName(catalogName, ident), newETag);
        }

        return new BaseTable(ops, CatalogUtil.fullTableName(catalogName, ident));
    }

}