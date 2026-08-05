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
import java.io.Console;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;
import org.apache.iceberg.catalog.Catalog;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.catalog.ViewCatalog;
import org.apache.polaris.iceberg.catalog.migrator.api.CatalogMigrationResult;
import org.apache.polaris.iceberg.catalog.migrator.api.CatalogMigrator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;

public abstract class BaseRegisterCommand implements Callable<Integer> {

  @CommandLine.ArgGroup(
      exclusive = false,
      multiplicity = "1",
      heading = "Source catalog options: %n")
  protected SourceCatalogOptions sourceCatalogOptions;

  @CommandLine.ArgGroup(
      exclusive = false,
      multiplicity = "1",
      heading = "Target catalog options: %n")
  private TargetCatalogOptions targetCatalogOptions;

  @CommandLine.ArgGroup(heading = "Identifier options: %n")
  private IdentifierOptions identifierOptions;

  @CommandLine.Option(
      names = {"--output-dir"},
      defaultValue = "",
      description = {
        "Optional local output directory path to write CLI output files like `failed_identifiers.txt`, "
            + "`failed_to_delete_at_source.txt`, `dry_run_identifiers.txt`. "
            + "If not specified, uses the present working directory.",
        "Example: --output-dir /tmp/output/",
        "         --output-dir $PWD/output_folder"
      })
  private Path outputDirPath;

  @CommandLine.Option(
      names = {"--dry-run"},
      description =
          "Optional configuration to simulate the registration without actually registering. Can learn about a list "
              + "of tables that will be registered by running this.")
  private boolean isDryRun;

  @CommandLine.Option(
      names = {"--disable-safety-prompts"},
      description = "Optional configuration to disable safety prompts which needs console input.")
  private boolean disablePrompts;

  @CommandLine.Option(
      names = {"--stacktrace"},
      description =
          "Optional configuration to enable capturing stacktrace in logs in case of failures.")
  private boolean enableStackTrace;

  private static final int BATCH_SIZE = 100;
  public static final String FAILED_IDENTIFIERS_FILE = "failed_identifiers.txt";
  public static final String FAILED_TO_DELETE_AT_SOURCE_FILE = "failed_to_delete_at_source.txt";
  public static final String DRY_RUN_FILE = "dry_run_identifiers.txt";
  public static final String DRY_RUN_VIEW_FILE = "dry_run_view_identifiers.txt";
  public static final String FAILED_VIEW_IDENTIFIERS_FILE = "failed_view_identifiers.txt";
  public static final String FAILED_TO_DELETE_VIEW_AT_SOURCE_FILE =
      "failed_to_delete_view_at_source.txt";

  private static final Logger consoleLog = LoggerFactory.getLogger("console-log");

  public BaseRegisterCommand() {}

  protected abstract CatalogMigrator catalogMigrator(
      Catalog sourceCatalog, Catalog targetCatalog, boolean enableStackTrace);

  protected abstract boolean canProceed(Catalog sourceCatalog);

  protected abstract String operation();

  protected abstract String operated();

  protected abstract String operate();

  protected ViewIdentifierOptions viewIdentifierOptions() {
    return null;
  }

  @Override
  public Integer call() {
    Set<TableIdentifier> identifiers = Collections.emptySet();
    Set<TableIdentifier> viewIdentifiers = Collections.emptySet();
    boolean tableSelectorSpecified = identifierOptions != null;
    String identifierRegEx = identifierOptions != null ? identifierOptions.identifiersRegEx : null;

    if (identifierOptions != null) {
      identifiers = identifierOptions.processIdentifiersInput();
    }

    ViewIdentifierOptions viewIdentifierOptions = viewIdentifierOptions();
    boolean viewSelectorSpecified = viewIdentifierOptions != null;
    String viewIdentifierRegEx =
        viewIdentifierOptions != null ? viewIdentifierOptions.identifiersRegEx : null;

    if (viewIdentifierOptions != null) {
      viewIdentifiers = viewIdentifierOptions.processIdentifiersInput();
    }

    validateOutputDir();

    Catalog sourceCatalog = null;
    Catalog targetCatalog = null;

    try {
      sourceCatalog = sourceCatalogOptions.build();
      consoleLog.info("Configured source catalog: {}", sourceCatalog.name());

      targetCatalog = targetCatalogOptions.build();
      consoleLog.info("Configured target catalog: {}", targetCatalog.name());

      if (!isDryRun && !disablePrompts && !canProceed(sourceCatalog)) {
        return 1;
      }

      CatalogMigrator catalogMigrator =
          catalogMigrator(sourceCatalog, targetCatalog, enableStackTrace);

      boolean isMigrate = catalogMigrator.deleteEntriesFromSourceCatalog();
      boolean supportViewMigration =
          sourceCatalog instanceof ViewCatalog && targetCatalog instanceof ViewCatalog;

      boolean tableSelectionRequested = !viewSelectorSpecified || tableSelectorSpecified;
      boolean viewSelectionRequested =
          isMigrate && (!tableSelectorSpecified || viewSelectorSpecified);

      if (identifiers.isEmpty() && tableSelectionRequested) {
        checkAndWarnAboutIdentifiers(identifierRegEx, "table");
        consoleLog.info("Identifying tables for {} ...", operation());
        identifiers = catalogMigrator.getMatchingTableIdentifiers(identifierRegEx);
        if (identifiers.isEmpty()) {
          consoleLog.warn(
              "No tables were identified for {}. Please check `catalog_migration.log` file for more info.",
              operation());
        }
      }

      if (viewSelectorSpecified && !isMigrate) {
        consoleLog.error("View migration is supported only by the `migrate` command.");
        return 1;
      }

      if (viewSelectorSpecified && !supportViewMigration) {
        consoleLog.error(
            "View migration is not supported because {} catalog does not support views.",
            sourceCatalog instanceof ViewCatalog ? "target" : "source");
        return 1;
      }

      if (supportViewMigration && viewIdentifiers.isEmpty() && viewSelectionRequested) {
        checkAndWarnAboutIdentifiers(viewIdentifierRegEx, "view");
        consoleLog.info("Identifying views for {} ...", operation());
        viewIdentifiers = catalogMigrator.getMatchingViewIdentifiers(viewIdentifierRegEx);
        if (viewIdentifiers.isEmpty()) {
          consoleLog.warn(
              "No views were identified for {}. Please check `catalog_migration.log` file for more info.",
              operation());
        }
      }

      if (identifiers.isEmpty() && viewIdentifiers.isEmpty()) {
        String content =
            supportViewMigration && viewSelectionRequested ? "tables or views" : "tables";
        consoleLog.warn(
            "No {} were identified for {}. Please check `catalog_migration.log` file for more info.",
            content,
            operation());
        return 1;
      }

      if (isDryRun) {
        consoleLog.info("Dry run is completed.");
        if (tableSelectionRequested) {
          handleDryRunResult(identifiers);
        }
        if (supportViewMigration && viewSelectionRequested && !viewIdentifiers.isEmpty()) {
          handleDryRunViewResult(viewIdentifiers);
        }
        return 0;
      }

      if (!identifiers.isEmpty()) {
        consoleLog.info("Identified {} tables for {}.", identifiers.size(), operation());
        consoleLog.info("Started {} ...", operation());

        int processedIdentifiersCount = 0;
        for (TableIdentifier identifier : identifiers) {
          catalogMigrator.registerTable(identifier);
          processedIdentifiersCount++;
          if (processedIdentifiersCount % BATCH_SIZE == 0
              || processedIdentifiersCount == identifiers.size()) {
            consoleLog.info(
                "Attempted {} for {} tables out of {} tables.",
                operation(),
                processedIdentifiersCount,
                identifiers.size());
          }
        }
        consoleLog.info("Finished {} tables ...", operation());
      }

      if (!viewIdentifiers.isEmpty()) {
        consoleLog.info("Identified {} views for {}.", viewIdentifiers.size(), operation());
        consoleLog.info("Started {} ...", operation());

        int processedViewIdentifiersCount = 0;
        for (TableIdentifier identifier : viewIdentifiers) {
          catalogMigrator.migrateView(identifier);
          processedViewIdentifiersCount++;
          if (processedViewIdentifiersCount % BATCH_SIZE == 0
              || processedViewIdentifiersCount == viewIdentifiers.size()) {
            consoleLog.info(
                "Attempted {} for {} views out of {} views.",
                operation(),
                processedViewIdentifiersCount,
                viewIdentifiers.size());
          }
        }
        consoleLog.info("Finished {} views ...", operation());
      }

      CatalogMigrationResult result = catalogMigrator.result();
      handleResults(result);

      if (!result.failedToRegisterTableIdentifiers().isEmpty()
          || !result.failedToDeleteTableIdentifiers().isEmpty()
          || !result.failedToRegisterViewIdentifiers().isEmpty()
          || !result.failedToDeleteViewIdentifiers().isEmpty()) {
        return 1;
      }

      return 0;
    } finally {
      close(sourceCatalog);
      close(targetCatalog);
    }
  }

  private void close(Catalog catalog) {
    if (catalog instanceof AutoCloseable) {
      try {
        ((AutoCloseable) catalog).close();
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
    }
  }

  private void checkAndWarnAboutIdentifiers(String identifierRegEx, String content) {
    if (identifierRegEx != null) {
      consoleLog.warn(
          "User has not specified the {} identifiers."
              + " Will be selecting all the {}s from all the namespaces from the source catalog "
              + "which matches the regex pattern:{}",
          content,
          content,
          identifierRegEx);
    } else {
      consoleLog.warn(
          "User has not specified the {} identifiers."
              + " Will be selecting all the {}s from all the namespaces from the source catalog.",
          content,
          content);
    }
  }

  private void validateOutputDir() {
    if (!Files.exists(outputDirPath)) {
      try {
        Files.createDirectories(outputDirPath);
      } catch (IOException ex) {
        throw new UncheckedIOException(
            "Failed to create the output directory from the path specified in `--output-dir`", ex);
      }
    }
    Preconditions.checkArgument(
        Files.isWritable(outputDirPath), "Path specified in `--output-dir` is not writable");
  }

  private void handleResults(CatalogMigrationResult result) {
    try {
      writeToFile(
          outputDirPath.resolve(FAILED_IDENTIFIERS_FILE),
          result.failedToRegisterTableIdentifiers());
      writeToFile(
          outputDirPath.resolve(FAILED_TO_DELETE_AT_SOURCE_FILE),
          result.failedToDeleteTableIdentifiers());
      if (!result.failedToRegisterViewIdentifiers().isEmpty()) {
        writeToFile(
            outputDirPath.resolve(FAILED_VIEW_IDENTIFIERS_FILE),
            result.failedToRegisterViewIdentifiers());
      }
      if (!result.failedToDeleteViewIdentifiers().isEmpty()) {
        writeToFile(
            outputDirPath.resolve(FAILED_TO_DELETE_VIEW_AT_SOURCE_FILE),
            result.failedToDeleteViewIdentifiers());
      }
    } finally {
      printSummary(result);
      printDetails(result);
    }
  }

  private void handleDryRunResult(Set<TableIdentifier> identifiers) {
    try {
      writeToFile(outputDirPath.resolve(DRY_RUN_FILE), identifiers);
    } finally {
      printDryRunResult(identifiers);
    }
  }

  private void handleDryRunViewResult(Set<TableIdentifier> identifiers) {
    try {
      writeToFile(outputDirPath.resolve(DRY_RUN_VIEW_FILE), identifiers);
    } finally {
      printDryRunViewResult(identifiers);
    }
  }

  private void printSummary(CatalogMigrationResult result) {
    consoleLog.info("Summary: ");
    if (!result.registeredTableIdentifiers().isEmpty()) {
      consoleLog.info(
          "Successfully {} {} tables from {} catalog to {} catalog.",
          operated(),
          result.registeredTableIdentifiers().size(),
          sourceCatalogOptions.type.name(),
          targetCatalogOptions.type.name());
    }
    if (!result.failedToRegisterTableIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to {} {} tables from {} catalog to {} catalog. "
              + "Please check the `catalog_migration.log` file for the failure reason. "
              + "Failed identifiers are written into `{}`. "
              + "Retry with that file using `--identifiers-from-file` option "
              + "if the failure is because of network/connection timeouts.",
          operate(),
          result.failedToRegisterTableIdentifiers().size(),
          sourceCatalogOptions.type.name(),
          targetCatalogOptions.type.name(),
          FAILED_IDENTIFIERS_FILE);
    }
    if (!result.failedToDeleteTableIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to delete {} tables from {} catalog. "
              + "Please check the `catalog_migration.log` file for the failure reason. "
              + "{}Failed to delete identifiers are written into `{}`.",
          result.failedToDeleteTableIdentifiers().size(),
          sourceCatalogOptions.type.name(),
          System.lineSeparator(),
          FAILED_TO_DELETE_AT_SOURCE_FILE);
    }
    if (!result.registeredViewIdentifiers().isEmpty()) {
      consoleLog.info(
          "Successfully {} {} views from {} catalog to {} catalog.",
          operated(),
          result.registeredViewIdentifiers().size(),
          sourceCatalogOptions.type.name(),
          targetCatalogOptions.type.name());
    }
    if (!result.failedToRegisterViewIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to {} {} views from {} catalog to {} catalog. "
              + "Please check the `catalog_migration.log` file for the failure reason. "
              + "Failed identifiers are written into `{}`. "
              + "Retry with that file using `--view-identifiers-from-file` option "
              + "if the failure is because of network/connection timeouts.",
          operate(),
          result.failedToRegisterViewIdentifiers().size(),
          sourceCatalogOptions.type.name(),
          targetCatalogOptions.type.name(),
          FAILED_VIEW_IDENTIFIERS_FILE);
    }
    if (!result.failedToDeleteViewIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to delete {} views from {} catalog. "
              + "Please check the `catalog_migration.log` file for the failure reason. "
              + "{}Failed to delete identifiers are written into `{}`.",
          result.failedToDeleteViewIdentifiers().size(),
          sourceCatalogOptions.type.name(),
          System.lineSeparator(),
          FAILED_TO_DELETE_VIEW_AT_SOURCE_FILE);
    }
  }

  private void printDetails(CatalogMigrationResult result) {
    consoleLog.info("Details: ");
    if (!result.registeredTableIdentifiers().isEmpty()) {
      consoleLog.info(
          "Successfully {} these tables:{}{}",
          operated(),
          System.lineSeparator(),
          result.registeredTableIdentifiers());
    }

    if (!result.failedToRegisterTableIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to {} these tables:{}{}",
          operate(),
          System.lineSeparator(),
          result.failedToRegisterTableIdentifiers());
    }

    if (!result.failedToDeleteTableIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to delete these tables from source catalog:{}{}",
          System.lineSeparator(),
          result.failedToDeleteTableIdentifiers());
    }

    if (!result.registeredViewIdentifiers().isEmpty()) {
      consoleLog.info(
          "Successfully {} these views:{}{}",
          operated(),
          System.lineSeparator(),
          result.registeredViewIdentifiers());
    }

    if (!result.failedToRegisterViewIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to {} these views:{}{}",
          operate(),
          System.lineSeparator(),
          result.failedToRegisterViewIdentifiers());
    }

    if (!result.failedToDeleteViewIdentifiers().isEmpty()) {
      consoleLog.error(
          "Failed to delete these views from source catalog:{}{}",
          System.lineSeparator(),
          result.failedToDeleteViewIdentifiers());
    }
  }

  private void printDryRunResult(Set<TableIdentifier> result) {
    consoleLog.info("Summary: ");
    consoleLog.info(
        "Identified {} tables for {} by dry-run. These identifiers are also written into {}. "
            + "This file can be used with `--identifiers-from-file` option for an actual run.",
        result.size(),
        operation(),
        DRY_RUN_FILE);
    consoleLog.info(
        "Details: {}Identified these tables for {} by dry-run:{}{}",
        System.lineSeparator(),
        operation(),
        System.lineSeparator(),
        result);
  }

  private void printDryRunViewResult(Set<TableIdentifier> result) {
    consoleLog.info("Summary: ");
    consoleLog.info(
        "Identified {} views for {} by dry-run. These identifiers are also written into {}. "
            + "This file can be used with `--view-identifiers-from-file` option for an actual run.",
        result.size(),
        operation(),
        DRY_RUN_VIEW_FILE);
    consoleLog.info(
        "Details: {}Identified these views for {} by dry-run:{}{}",
        System.lineSeparator(),
        operation(),
        System.lineSeparator(),
        result);
  }

  private static void writeToFile(Path filePath, Collection<TableIdentifier> identifiers) {
    List<String> identifiersString =
        identifiers.stream().map(TableIdentifier::toString).collect(Collectors.toList());
    try {
      Files.write(filePath, identifiersString);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to write the file:" + filePath, e);
    }
  }

  protected boolean proceed() {
    Console console = System.console();
    while (true) {
      consoleLog.info(
          "Are you certain that you wish to proceed, after reading the above warnings? (yes/no):");
      String input = console.readLine();

      if (input.equalsIgnoreCase("yes")) {
        consoleLog.info("Continuing...");
        return true;
      } else if (input.equalsIgnoreCase("no")) {
        consoleLog.info("Aborting...");
        return false;
      } else {
        consoleLog.info("Invalid input. Please enter 'yes' or 'no'.");
      }
    }
  }
}
