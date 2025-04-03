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

import org.apache.polaris.management.ApiClient;
import org.apache.polaris.management.client.PolarisManagementDefaultApi;
import org.apache.http.HttpHeaders;
import org.apache.polaris.tools.sync.polaris.http.OAuth2Util;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Used to initialize a {@link PolarisService}
 */
public class PolarisServiceFactory {

    private static void validatePolarisInstanceProperties(
            String baseUrl,
            String accessToken,
            String oauth2ServerUri,
            String clientId,
            String clientSecret,
            String scope
    ) {
        if (baseUrl == null) {
            throw new IllegalArgumentException("baseUrl is required but was not provided");
        }

        if (accessToken != null) {
            return;
        }

        final String oauthErrorMessage =
                "Either the accessToken property must be provided, or all of oauth2ServerUri, clientId, clientSecret, scope";

        if (oauth2ServerUri == null || clientId == null || clientSecret == null || scope == null) {
            throw new IllegalArgumentException(oauthErrorMessage);
        }
    }

    public static PolarisService newPolarisService(
            String baseUrl,
            String oauth2ServerUri,
            String clientId,
            String clientSecret,
            String scope
    ) throws IOException {
        validatePolarisInstanceProperties(baseUrl, null, oauth2ServerUri, clientId, clientSecret, scope);

        String accessToken = OAuth2Util.fetchToken(oauth2ServerUri, clientId, clientSecret, scope);

        return newPolarisService(baseUrl, accessToken);
    }

    public static PolarisService newPolarisService(String baseUrl, String accessToken) {
        validatePolarisInstanceProperties(baseUrl, accessToken, null, null, null, null);

        ApiClient client = new ApiClient();
        client.updateBaseUri(baseUrl + "/api/management/v1");

        // TODO: Add token refresh
        client.setRequestInterceptor(requestBuilder -> {
            requestBuilder.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
        });

        Map<String, String> catalogProperties = new HashMap<>();
        catalogProperties.putIfAbsent("uri", baseUrl + "/api/catalog");

        PolarisManagementDefaultApi polarisClient = new PolarisManagementDefaultApi(client);
        return new PolarisService(polarisClient, catalogProperties);
    }

}
