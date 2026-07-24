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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.polaris.core.admin.model.Principal;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.core.admin.model.PrincipalWithCredentialsCredentials;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

public class JsonFileCredentialWriterTest {

    @TempDir
    Path tempDir;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private PrincipalWithCredentials buildPrincipal(String name, String clientId, String clientSecret) {
        return new PrincipalWithCredentials()
                .principal(new Principal().name(name))
                .credentials(new PrincipalWithCredentialsCredentials()
                        .clientId(clientId)
                        .clientSecret(clientSecret));
    }

    @Test
    public void writesSingleLineOfValidJson() throws Exception {
        Path path = tempDir.resolve("single.jsonl");

        try (JsonFileCredentialWriter writer =
                new JsonFileCredentialWriter(Map.of(JsonFileCredentialWriter.JSON_FILE_PROPERTY, path.toString()))) {
            writer.writeCredentials(buildPrincipal("test-principal", "client-id", "client-secret"));
        }

        List<String> lines = Files.readAllLines(path);
        Assertions.assertEquals(1, lines.size());

        JsonNode node = objectMapper.readTree(lines.get(0));
        Assertions.assertEquals("test-principal", node.get("principal").get("name").asText());
        Assertions.assertEquals("client-id", node.get("credentials").get("clientId").asText());
        Assertions.assertEquals("client-secret", node.get("credentials").get("clientSecret").asText());
    }

    @Test
    public void appendsMultipleEntriesAsJsonLines() throws Exception {
        Path path = tempDir.resolve("multi.jsonl");

        try (JsonFileCredentialWriter writer =
                new JsonFileCredentialWriter(Map.of(JsonFileCredentialWriter.JSON_FILE_PROPERTY, path.toString()))) {
            writer.writeCredentials(buildPrincipal("principal-1", "id-1", "secret-1"));
            writer.writeCredentials(buildPrincipal("principal-2", "id-2", "secret-2"));
            writer.writeCredentials(buildPrincipal("principal-3", "id-3", "secret-3"));
        }

        List<String> lines = Files.readAllLines(path);
        Assertions.assertEquals(3, lines.size());

        for (String line : lines) {
            Assertions.assertDoesNotThrow(() -> objectMapper.readTree(line));
        }
    }

    @Test
    public void defaultOverwritesExistingFile() throws Exception {
        Path path = tempDir.resolve("overwrite.jsonl");
        Files.writeString(path, "{\"stale\":\"data\"}\n");

        try (JsonFileCredentialWriter writer =
                new JsonFileCredentialWriter(Map.of(JsonFileCredentialWriter.JSON_FILE_PROPERTY, path.toString()))) {
            writer.writeCredentials(buildPrincipal("fresh-principal", "id", "secret"));
        }

        List<String> lines = Files.readAllLines(path);
        Assertions.assertEquals(1, lines.size());
        Assertions.assertTrue(lines.get(0).contains("fresh-principal"));
    }

    @Test
    public void appendPropertyPreservesExistingContent() throws Exception {
        Path path = tempDir.resolve("append.jsonl");
        Files.writeString(path, "{\"principal\":{\"name\":\"existing\"}}\n");

        try (JsonFileCredentialWriter writer =
                new JsonFileCredentialWriter(Map.of(
                        JsonFileCredentialWriter.JSON_FILE_PROPERTY, path.toString(),
                        JsonFileCredentialWriter.APPEND_PROPERTY, "true"))) {
            writer.writeCredentials(buildPrincipal("new-principal", "id", "secret"));
        }

        List<String> lines = Files.readAllLines(path);
        Assertions.assertEquals(2, lines.size());
        Assertions.assertTrue(lines.get(0).contains("existing"));
        Assertions.assertTrue(lines.get(1).contains("new-principal"));
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    public void filePermissionsRestrictedToOwner() throws Exception {
        Path path = tempDir.resolve("secure.jsonl");

        org.junit.jupiter.api.Assumptions.assumeTrue(
                FileSystems.getDefault().supportedFileAttributeViews().contains("posix"));

        try (JsonFileCredentialWriter writer =
                new JsonFileCredentialWriter(Map.of(JsonFileCredentialWriter.JSON_FILE_PROPERTY, path.toString()))) {
            writer.writeCredentials(buildPrincipal("principal", "id", "secret"));
        }

        Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(path);
        Assertions.assertEquals(
                Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE),
                permissions);
    }

}
