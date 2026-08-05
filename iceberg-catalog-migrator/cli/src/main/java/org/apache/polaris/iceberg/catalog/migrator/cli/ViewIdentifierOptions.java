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

import com.google.common.base.Preconditions;
import com.google.common.collect.Sets;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Collectors;
import org.apache.iceberg.catalog.TableIdentifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;

public class ViewIdentifierOptions {

  @CommandLine.Option(
      names = {"--view-identifiers"},
      split = ",",
      description = {
        "Optional selective set of view identifiers to migrate. Use this when there are few view identifiers that "
            + "need to be migrated. For a large number of view identifiers, use the `--view-identifiers-from-file` "
            + "or `--view-identifiers-regex` option.",
        "Example: --view-identifiers foo.v1,bar.v2"
      })
  protected Set<String> identifiers = new HashSet<>();

  @CommandLine.Option(
      names = {"--view-identifiers-from-file"},
      description = {
        "Optional text file path that contains a set of view identifiers (one per line) to migrate. Should not be "
            + "used with `--view-identifiers` or `--view-identifiers-regex` option.",
        "Example: --view-identifiers-from-file /tmp/files/ids.txt"
      })
  protected String identifiersFromFile;

  @CommandLine.Option(
      names = {"--view-identifiers-regex"},
      description = {
        "Optional regular expression pattern used to migrate only the views whose view identifiers match this pattern. "
            + "Should not be used with `--view-identifiers` or '--view-identifiers-from-file' option.",
        "Example: --view-identifiers-regex ^foo\\..*"
      })
  protected String identifiersRegEx;

  private static final Logger consoleLog = LoggerFactory.getLogger("console-log");

  protected Set<TableIdentifier> processIdentifiersInput() {

    if (!identifiers.isEmpty()) {
      return identifiers.stream()
          .map(TableIdentifier::parse)
          .collect(Collectors.toCollection(LinkedHashSet::new));
    } else if (identifiersFromFile != null) {
      Preconditions.checkArgument(
          Files.exists(Paths.get(identifiersFromFile)),
          "File specified in `--view-identifiers-from-file` option does not exist");
      try {
        consoleLog.info("Collecting view identifiers from the file {} ...", identifiersFromFile);
        return Files.readAllLines(Paths.get(identifiersFromFile)).stream()
            .map(String::trim)
            .filter(string -> !string.isEmpty())
            .map(TableIdentifier::parse)
            .collect(Collectors.toCollection(LinkedHashSet::new));
      } catch (IOException e) {
        throw new UncheckedIOException(
            String.format("Failed to read the file: %s", identifiersFromFile), e);
      }
    } else if (identifiersRegEx != null) {
      Preconditions.checkArgument(
          !identifiersRegEx.trim().isEmpty(), "--view-identifiers-regex should not be empty");
      // check whether pattern is compilable
      try {
        Pattern.compile(identifiersRegEx);
      } catch (PatternSyntaxException ex) {
        throw new IllegalArgumentException(
            "--view-identifiers-regex pattern is not compilable", ex);
      }
    }
    return Sets.newHashSet();
  }
}
