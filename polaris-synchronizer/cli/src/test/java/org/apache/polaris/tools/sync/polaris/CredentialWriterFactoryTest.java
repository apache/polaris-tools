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

import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

public class CredentialWriterFactoryTest {

    @TempDir
    Path tempDir;

    @Test
    public void constructConsoleWriterSuccessfully() throws Exception {
        try (var writer = CredentialWriterFactory.createCredentialWriter(
                CredentialWriterFactory.Type.CONSOLE, Map.of())) {
            Assertions.assertNotNull(writer);
        }
    }

    @Test
    public void constructFileWriterSuccessfully() throws Exception {
        String path = tempDir.resolve("creds.jsonl").toString();
        try (var writer = CredentialWriterFactory.createCredentialWriter(
                CredentialWriterFactory.Type.FILE,
                Map.of(JsonFileCredentialWriter.JSON_FILE_PROPERTY, path))) {
            Assertions.assertNotNull(writer);
        }
    }

    @Test
    public void failToConstructFileWriterMissingProperty() {
        Assertions.assertThrows(Exception.class, () ->
                CredentialWriterFactory.createCredentialWriter(CredentialWriterFactory.Type.FILE, Map.of()));
    }

    @Test
    public void constructCustomCredentialWriterSuccessfully() throws Exception {
        try (var writer = CredentialWriterFactory.createCredentialWriter(
                CredentialWriterFactory.Type.CUSTOM,
                Map.of(CredentialWriterFactory.CUSTOM_CLASS_NAME_PROPERTY, ConsoleCredentialWriter.class.getName()))) {
            Assertions.assertNotNull(writer);
        }
    }

    @Test
    public void failToConstructCustomCredentialWriter() {
        Assertions.assertThrows(Exception.class, () ->
                CredentialWriterFactory.createCredentialWriter(CredentialWriterFactory.Type.CUSTOM, Map.of()));
    }

}
