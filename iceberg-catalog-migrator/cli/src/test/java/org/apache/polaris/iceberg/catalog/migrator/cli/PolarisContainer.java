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
package org.apache.polaris.iceberg.catalog.migrator.cli;

import static org.junit.Assert.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.base.Preconditions;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.testcontainers.containers.BindMode;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

public class PolarisContainer extends GenericContainer<PolarisContainer> {

  private static final DockerImageName IMAGE =
      DockerImageName.parse("apache/polaris:1.1.0-incubating");
  private static final int POLARIS_PORT = 8181;

  public static final String CATALOG_NAME = "test";
  public static final String NAMESPACE_NAME = "testNamespace";
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  private static final String CLIENT_ID = "root";
  private static final String CLIENT_SECRET = "s3cr3t";

  private final Map<String, String> jvmOptions = new HashMap<>();

  private final String hostDirectory;

  public PolarisContainer(String hostDirectory) {
    super(IMAGE);

    Preconditions.checkArgument(hostDirectory != null, "host directory is null");
    this.hostDirectory = hostDirectory;
    this.withFileSystemBind(hostDirectory, hostDirectory, BindMode.READ_WRITE);
    Wait.forHttp("/").forStatusCode(200);
    this.withExposedPorts(POLARIS_PORT).withEnv("JAVA_TOOL_OPTIONS", "-Duser.dir=" + hostDirectory);
  }

  @Override
  public void start() {
    // setup to allow file storage
    jvmOptions.put("polaris.readiness.ignore-severe-issues", "true");
    jvmOptions.put("polaris.features.\"SUPPORTED_CATALOG_STORAGE_TYPES\"", "[\"FILE\"]");
    jvmOptions.put("polaris.features.\"ALLOW_INSECURE_STORAGE_TYPES\"", "true");
    jvmOptions.put("polaris.features.\"ALLOW_UNSTRUCTURED_TABLE_LOCATION\"", "true");
    String jvmOptionsString =
        jvmOptions.entrySet().stream()
            .map(e -> "-D" + e.getKey() + "=" + e.getValue())
            .collect(Collectors.joining(" "));
    this.addEnv("JAVA_OPTS_APPEND", jvmOptionsString);
    this.addEnv(
        "POLARIS_BOOTSTRAP_CREDENTIALS", String.format("POLARIS,%s,%s", CLIENT_ID, CLIENT_SECRET));
    super.start();
    createCatalog(CATALOG_NAME, hostDirectory);
    createNamespace(NAMESPACE_NAME);
  }

  @Override
  public void setDockerImageName(String dockerImageName) {
    throw new UnsupportedOperationException("Docker image name can not be changed");
  }

  public String getApiEndpoint(String prefix) {
    return "http://localhost:" + getMappedPort(POLARIS_PORT) + prefix;
  }

  public String getIcebergApiEndpoint() {
    return getApiEndpoint("/api/catalog");
  }

  public String getClientId() {
    return CLIENT_ID;
  }

  public String getClientSecret() {
    return CLIENT_SECRET;
  }

  public String httpGet(String apiUrl) throws Exception {
    String accessToken = getAccessToken(CLIENT_ID, CLIENT_SECRET);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getApiEndpoint(apiUrl)))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(response.body(), 200, response.statusCode());
    return response.body();
  }

  public String getAccessToken(String clientId, String clientSecret) {
    try {
      String body =
          String.format(
              "grant_type=client_credentials&client_id=%s&client_secret=%s&scope=PRINCIPAL_ROLE:ALL",
              clientId, clientSecret);
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(getApiEndpoint("/api/catalog/v1/oauth/tokens")))
              .header("Content-Type", "application/x-www-form-urlencoded")
              .header("Accept", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(body))
              .build();

      HttpResponse<String> response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
      ObjectMapper mapper = new ObjectMapper();
      JsonNode root = mapper.readTree(response.body());
      return root.path("access_token").asText();
    } catch (Exception e) {
      throw new AssertionError("Error fetching access token");
    }
  }

  public void createCatalog(String catalogName, String hostDirectory) {
    try {
      String body =
          String.format(
              "{\n"
                  + "    \"catalog\": {\n"
                  + "      \"name\": \"%s\",\n"
                  + "      \"type\": \"INTERNAL\",\n"
                  + "      \"readOnly\": false,\n"
                  + "      \"properties\": {\n"
                  + "        \"default-base-location\": \"file:%s/\"\n"
                  + "      },\n"
                  + "      \"storageConfigInfo\": {\n"
                  + "        \"storageType\": \"FILE\",\n"
                  + "        \"allowedLocations\": [\n"
                  + "          \"file:%s\"\n"
                  + "        ]\n"
                  + "      }\n"
                  + "    }\n"
                  + "  }",
              catalogName, hostDirectory, hostDirectory);
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(getApiEndpoint("/api/management/v1/catalogs")))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + getAccessToken(CLIENT_ID, CLIENT_SECRET))
              .header("Accept", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(body))
              .build();

      HttpResponse<String> response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
      assertEquals(response.body(), 201, response.statusCode());
    } catch (Exception e) {
      throw new AssertionError("Error creating catalog");
    }
  }

  public void createNamespace(String namespaceName) {
    try {
      String body = String.format("{ \"namespace\": [\"%s\"]}", namespaceName);
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(
                  URI.create(
                      getApiEndpoint(String.format("/api/catalog/v1/%s/namespaces", CATALOG_NAME))))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + getAccessToken(CLIENT_ID, CLIENT_SECRET))
              .header("Accept", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(body))
              .build();

      HttpResponse<String> response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
      assertEquals(response.body(), 200, response.statusCode());
    } catch (Exception e) {
      throw new AssertionError("Error creating namespace");
    }
  }
}
