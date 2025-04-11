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
package org.apache.polaris.tools.sync.polaris.http;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.NoSuchElementException;
import org.apache.http.HttpHeaders;
import org.apache.http.entity.ContentType;

/** Utility class to manage OAuth2 flow for a Polaris instance. */
public class OAuth2Util {

  private static final HttpClient httpClient = HttpClient.newHttpClient();

  private static final ObjectMapper objectMapper = new ObjectMapper();

  public static String fetchToken(
      String oauth2ServerUri, String clientId, String clientSecret, String scope)
      throws IOException {

    Map<String, String> formBody =
        Map.of(
            "grant_type", "client_credentials",
            "scope", scope,
            "client_id", clientId,
            "client_secret", clientSecret);

    String formBodyAsString = HttpUtil.constructFormEncodedString(formBody);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(oauth2ServerUri))
            .header(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_FORM_URLENCODED.getMimeType())
            .POST(HttpRequest.BodyPublishers.ofString(formBodyAsString))
            .build();

    try {
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      Map<String, String> responseBody =
          objectMapper.readValue(response.body(), new TypeReference<>() {});

      String accessToken = responseBody.getOrDefault("access_token", null);

      if (accessToken != null) {
        return accessToken;
      }

      throw new NoSuchElementException(
          "No field 'access_token' found in response from oauth2-server-uri.");
    } catch (Exception e) {
      throw new RuntimeException("Could not fetch access token", e);
    }
  }
}
