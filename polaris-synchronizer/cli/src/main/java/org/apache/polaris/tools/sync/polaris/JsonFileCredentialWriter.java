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

import static java.nio.charset.StandardCharsets.UTF_8;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedWriter;
import java.io.Closeable;
import java.io.File;
import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Map;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.access.CredentialWriter;

/**
 * Implementation that writes principal credentials as JSON Lines (one JSON object per line) to a
 * file. The file is created with owner-only read/write permissions where the filesystem supports
 * it, since it contains plaintext secrets.
 */
public class JsonFileCredentialWriter implements CredentialWriter, Closeable {

  public static final String JSON_FILE_PROPERTY = "json-file";

  public static final String APPEND_PROPERTY = "append";

  private final ObjectMapper objectMapper = new ObjectMapper();

  private final BufferedWriter writer;

  public JsonFileCredentialWriter(Map<String, String> properties) {
    if (!properties.containsKey(JSON_FILE_PROPERTY)) {
      throw new IllegalArgumentException("Missing required property " + JSON_FILE_PROPERTY);
    }

    boolean append = Boolean.parseBoolean(properties.getOrDefault(APPEND_PROPERTY, "false"));

    File file = new File(properties.get(JSON_FILE_PROPERTY));

    try {
      if (file.getParentFile() != null) {
        Files.createDirectories(file.getParentFile().toPath());
      }

      if (!file.exists()) {
        createRestrictedFile(file);
      } else {
        restrictExistingFilePermissions(file);
      }

      this.writer =
          Files.newBufferedWriter(
              file.toPath(),
              UTF_8,
              StandardOpenOption.CREATE,
              StandardOpenOption.WRITE,
              append ? StandardOpenOption.APPEND : StandardOpenOption.TRUNCATE_EXISTING);
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  private void createRestrictedFile(File file) throws IOException {
    if (FileSystems.getDefault().supportedFileAttributeViews().contains("posix")) {
      Files.createFile(
          file.toPath(), PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
    } else {
      Files.createFile(file.toPath());
      restrictExistingFilePermissions(file);
    }
  }

  private void restrictExistingFilePermissions(File file) throws IOException {
    if (FileSystems.getDefault().supportedFileAttributeViews().contains("posix")) {
      Files.setPosixFilePermissions(file.toPath(), PosixFilePermissions.fromString("rw-------"));
    } else {
      file.setReadable(false, false);
      file.setReadable(true, true);
      file.setWritable(false, false);
      file.setWritable(true, true);
    }
  }

  @Override
  public void writeCredentials(PrincipalWithCredentials principalWithCredentials) {
    try {
      writer.write(objectMapper.writeValueAsString(principalWithCredentials));
      writer.newLine();
      writer.flush();
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public void close() throws IOException {
    if (writer != null) {
      writer.close();
    }
  }
}
