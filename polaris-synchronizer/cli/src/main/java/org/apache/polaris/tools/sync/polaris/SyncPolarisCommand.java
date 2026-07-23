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

import java.util.Map;
import java.util.concurrent.Callable;
import org.apache.polaris.tools.sync.polaris.catalog.ETagManager;
import org.apache.polaris.tools.sync.polaris.planning.AccessControlAwarePlanner;
import org.apache.polaris.tools.sync.polaris.planning.CatalogNameFilterPlanner;
import org.apache.polaris.tools.sync.polaris.planning.ModificationAwarePlanner;
import org.apache.polaris.tools.sync.polaris.planning.BaseStrategyPlanner;
import org.apache.polaris.tools.sync.polaris.planning.SynchronizationPlanner;
import org.apache.polaris.tools.sync.polaris.service.PolarisService;
import org.apache.polaris.tools.sync.polaris.service.impl.PolarisApiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;

/**
 * Command to run the synchronization between a source and target Polaris instance.
 */
@CommandLine.Command(
    name = "sync-polaris",
    mixinStandardHelpOptions = true,
    sortOptions = false,
    description =
        "Idempotent synchronization of one Polaris instance to another. Entities will not be removed from the source Polaris instance.")
public class SyncPolarisCommand implements Callable<Integer> {

  private final Logger consoleLog = LoggerFactory.getLogger("console-log");

  @CommandLine.Option(
          names = {"--source-properties"},
          required = true,
          description = CLIUtil.API_SERVICE_PROPERTIES_DESCRIPTION + CLIUtil.OMNIPOTENT_PRINCIPAL_PROPERTIES_DESCRIPTION
  )
  private Map<String, String> sourceProperties;

  @CommandLine.Option(
          names = {"--target-properties"},
          required = true,
          description = CLIUtil.API_SERVICE_PROPERTIES_DESCRIPTION + CLIUtil.OMNIPOTENT_PRINCIPAL_PROPERTIES_DESCRIPTION
  )
  private Map<String, String> targetProperties;

  @CommandLine.Option(
          names = {"--etag-storage-type"},
          defaultValue = "NONE",
          description = "One of { NONE, FILE, CUSTOM }. Default: NONE. The storage manager to use for storing ETags."
  )
  private ETagManagerFactory.Type etagManagerType;

  @CommandLine.Option(
          names = {"--etag-storage-properties"},
          description = "Properties to initialize ETag storage." +
                  "\nFor type FILE:" +
                  "\n\t- " + CsvETagManager.CSV_FILE_PROPERTY + ": The CSV file to read ETags from and write ETags to." +
                  "\nFor type CUSTOM:" +
                  "\n\t- " + ETagManagerFactory.CUSTOM_CLASS_NAME_PROPERTY+ ": The classname for the custom ETagManager implementation."
  )
  private Map<String, String> etagManagerProperties;

  @CommandLine.Option(
          names = {"--sync-principals"},
          description = "Enable synchronization of principals across the source and target, and assign them to " +
                  "the appropriate principal roles. WARNING: Principal client-id and client-secret will be reset on " +
                  "the target Polaris instance, and the new credentials for the principals created on the target will " +
                  "be logged to stdout."
  )
  private boolean shouldSyncPrincipals;

  @CommandLine.Option(
          names = {"--halt-on-failure"},
          description = "Hard fail and stop the synchronization when an error occurs."
  )
  private boolean haltOnFailure;

  @CommandLine.Option(
          names = {"--catalog-name-regex"},
          description = "If specified, only catalogs with names that match the provided RegEx will be staged for " +
                  "synchronization. This applies to catalogs on both the source and target."
  )
  private String catalogNameRegex;

  @CommandLine.Option(
          names = {"--diff-only"},
          description = "Only synchronize the diff between the source and target Polaris."
  )
  private boolean diffOnly;

  @CommandLine.Option(
          names = {"--skip-iceberg-content"},
          description = "Skip synchronization of Iceberg namespaces and tables. Catalogs, catalog-roles, and " +
                  "grants will still be synchronized."
  )
  private boolean skipIcebergContent;

  @CommandLine.Option(
          names = {"--strategy"},
          defaultValue = "CREATE_ONLY",
          description = "The synchronization strategy to use. Options: " +
                  "\n\t- CREATE_ONLY: (default) Only create entities that exist on the source and do not exist on the " +
                    "target." +
                  "\n\t- CREATE_AND_OVERWRITE: Create entities that exist on the source and not on the target and " +
                    "overwrite entities that exist on both the source and the target." +
                  "\n\t- REPLICATE: Create entities that exist on the source and not on the target, " +
                    "overwrite entities that exist on both the source and the target, " +
                    "and remove entities from the target that do not exist on the source."
  )
  private BaseStrategyPlanner.Strategy strategy;

  @Override
  public Integer call() throws Exception {
    SynchronizationPlanner planner = SynchronizationPlanner.builder(new BaseStrategyPlanner(strategy))
            .conditionallyWrapBy(diffOnly, ModificationAwarePlanner::new)
            .conditionallyWrapBy(catalogNameRegex != null, p -> new CatalogNameFilterPlanner(catalogNameRegex, p))
            .wrapBy(AccessControlAwarePlanner::new)
            .build();

    // auto generate omnipotent principals with write access on the target, read only access on source
    sourceProperties.put(PolarisApiService.ICEBERG_WRITE_ACCESS_PROPERTY, Boolean.toString(false));
    targetProperties.put(PolarisApiService.ICEBERG_WRITE_ACCESS_PROPERTY, Boolean.toString(true));

    try (
            PolarisService source = PolarisServiceFactory.createPolarisService(
                    PolarisServiceFactory.ServiceType.API, sourceProperties);
            PolarisService target = PolarisServiceFactory.createPolarisService(
                    PolarisServiceFactory.ServiceType.API, targetProperties);
            ETagManager etagManager = ETagManagerFactory.createETagManager(etagManagerType, etagManagerProperties)
    ) {
      PolarisSynchronizer synchronizer =
              new PolarisSynchronizer(
                      consoleLog,
                      haltOnFailure,
                      planner,
                      source,
                      target,
                      etagManager,
                      diffOnly,
                      skipIcebergContent);
      synchronizer.syncPrincipalRoles();
      if (shouldSyncPrincipals) {
        consoleLog.warn("Principal migration will reset credentials on the target Polaris instance. " +
                "Principal migration will log the new target Principal credentials to stdout.");
        synchronizer.syncPrincipals();
      }
      synchronizer.syncCatalogs();
    }

    return 0;
  }
}
