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

package org.apache.polaris.tools.cli;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Obtains an OAuth2 bearer token from a Polaris token endpoint using the
 * client-credentials grant.
 */
class OAuthHelper {

    private static final Pattern ACCESS_TOKEN_PATTERN =
            Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"");

    /**
     * Performs a {@code client_credentials} exchange against {@code tokenEndpoint}
     * and returns the resulting access token.
     *
     * @param tokenEndpoint full URL, e.g. {@code http://localhost:8181/api/catalog/v1/oauth/tokens}
     * @param clientId      OAuth client ID
     * @param clientSecret  OAuth client secret
     * @return the access token string
     * @throws Exception if the HTTP call fails or the response contains no {@code access_token}
     */
    static String obtainToken(String tokenEndpoint, String clientId, String clientSecret)
            throws Exception {
        String body = "grant_type=client_credentials"
                + "&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&client_secret=" + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8)
                + "&scope=PRINCIPAL_ROLE:ALL";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenEndpoint))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException(
                    "OAuth token request failed: HTTP " + response.statusCode()
                    + " — " + response.body());
        }

        Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(response.body());
        if (!matcher.find()) {
            throw new IllegalStateException(
                    "No access_token found in OAuth response: " + response.body());
        }
        return matcher.group(1);
    }

    private OAuthHelper() {}
}
