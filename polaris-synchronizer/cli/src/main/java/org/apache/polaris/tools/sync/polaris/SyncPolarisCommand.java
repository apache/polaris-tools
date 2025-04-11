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

import java.io.Closeable;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.Callable;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.access.NoOpPrincipalCredentialCaptor;
import org.apache.polaris.tools.sync.polaris.access.PrincipalCredentialCaptor;
import org.apache.polaris.tools.sync.polaris.catalog.ETagService;
import org.apache.polaris.tools.sync.polaris.catalog.NoOpETagService;
import org.apache.polaris.tools.sync.polaris.options.SourceOmniPotentPrincipalOptions;
import org.apache.polaris.tools.sync.polaris.options.SourcePolarisOptions;
import org.apache.polaris.tools.sync.polaris.options.TargetOmnipotentPrincipal;
import org.apache.polaris.tools.sync.polaris.options.TargetPolarisOptions;
import org.apache.polaris.tools.sync.polaris.planning.AccessControlAwarePlanner;
import org.apache.polaris.tools.sync.polaris.planning.ModificationAwarePlanner;
import org.apache.polaris.tools.sync.polaris.planning.SourceParitySynchronizationPlanner;
import org.apache.polaris.tools.sync.polaris.planning.SynchronizationPlanner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;

@CommandLine.Command(
    name = "sync-polaris",
    mixinStandardHelpOptions = true,
    sortOptions = false,
    description =
        "Idempotent synchronization of one Polaris instance to another. Entities will not be removed from the source Polaris instance.")
public class SyncPolarisCommand implements Callable<Integer> {

  private final Logger consoleLog = LoggerFactory.getLogger("console-log");

  @CommandLine.ArgGroup(
      exclusive = false,
      multiplicity = "1",
      heading = "Source Polaris options: %n")
  private SourcePolarisOptions sourcePolarisOptions;

  @CommandLine.ArgGroup(
      exclusive = false,
      multiplicity = "1",
      heading = "Target Polaris options: %n")
  private TargetPolarisOptions targetPolarisOptions;

  @CommandLine.ArgGroup(
      exclusive = false,
      multiplicity = "1",
      heading = "Source Polaris Omnipotent Principal Options: %n")
  private SourceOmniPotentPrincipalOptions sourceOmniPotentPrincipalOptions;

  @CommandLine.ArgGroup(
      exclusive = false,
      multiplicity = "1",
      heading = "Target Polaris Omnipotent Principal Options: %n")
  private TargetOmnipotentPrincipal targetOmniPotentPrincipalOptions;

  @CommandLine.Option(
      names = {"--etag-file"},
      description = "The file path of the file to retrieve and store table ETags from.")
  private String etagFilePath;

  @CommandLine.Option(
          names = {"--sync-principals"},
          description = "Enable principal synchronization. WARNING: Principal client-id and client-secret will be " +
                  "reset on the target Polaris instance."
  )
  private boolean shouldSyncPrincipals;

  @CommandLine.Option(
          names = {"--target-principal-credentials-file"},
          description = "The file path of the file to write credentials for principals created/overwritten on the " +
                  "target to.")
  private String targetPrincipalCredentialsFilePath;

  @Override
  public Integer call() throws Exception {
    SynchronizationPlanner sourceParityPlanner = new SourceParitySynchronizationPlanner();
    SynchronizationPlanner modificationAwareSourceParityPlanner =
        new ModificationAwarePlanner(sourceParityPlanner);
    SynchronizationPlanner accessControlAwarePlanner =
        new AccessControlAwarePlanner(modificationAwareSourceParityPlanner);

    PolarisService source = sourcePolarisOptions.buildService();
    PolarisService target = targetPolarisOptions.buildService();

    PrincipalWithCredentials sourceOmnipotentPrincipal =
        sourceOmniPotentPrincipalOptions.buildPrincipalWithCredentials();
    PrincipalWithCredentials targetOmniPotentPrincipal =
        targetOmniPotentPrincipalOptions.buildPrincipalWithCredentials();

    ETagService etagService;

    if (etagFilePath != null) {
      File etagFile = new File(etagFilePath);
      etagService = new CsvETagService(etagFile);
    } else {
      etagService = new NoOpETagService();
    }

    PrincipalCredentialCaptor principalCredentialCaptor;

    if (shouldSyncPrincipals) {
      if (targetPrincipalCredentialsFilePath != null) {
        consoleLog.warn("Principal creation will reset credentials on the target Polaris instance. " +
                "Principal creation will produce a file {} with the collected Principal credentials on the target" +
                " Polaris instance. Please ensure this file is stored securely as it contains sensitive credentials.",
                targetPrincipalCredentialsFilePath);

        File targetCredentialFile = new File(targetPrincipalCredentialsFilePath);
        principalCredentialCaptor = new CsvPrincipalCredentialsCaptor(targetCredentialFile);
      } else {
        consoleLog.error("Principal synchronization requires specifying the --target-principal-credentials-file option " +
                "to store the reset Principal credentials on the target Polaris instance.");
        return 1;
      }
    } else {
      principalCredentialCaptor = new NoOpPrincipalCredentialCaptor();
    }

    Runtime.getRuntime()
        .addShutdownHook(
            new Thread(
                () -> {
                  if (etagService instanceof Closeable closableETagService) {
                    try {
                      closableETagService.close();
                    } catch (IOException e) {
                      throw new RuntimeException(e);
                    }
                  }

                  if (principalCredentialCaptor instanceof Closeable closablePrincipalCredentialCaptor) {
                      try {
                          closablePrincipalCredentialCaptor.close();
                      } catch (IOException e) {
                          throw new RuntimeException(e);
                      }
                  }
                }));

    PolarisSynchronizer synchronizer =
        new PolarisSynchronizer(
            consoleLog,
            accessControlAwarePlanner,
            sourceOmnipotentPrincipal,
            targetOmniPotentPrincipal,
            source,
            target,
            etagService,
            principalCredentialCaptor);

    if (shouldSyncPrincipals) {
      synchronizer.syncPrincipals();
    }
    synchronizer.syncPrincipalRoles();
    synchronizer.syncCatalogs();

    return 0;
  }
}
