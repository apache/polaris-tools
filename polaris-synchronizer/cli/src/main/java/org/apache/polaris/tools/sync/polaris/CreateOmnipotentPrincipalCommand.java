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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.polaris.core.admin.model.Catalog;
import org.apache.polaris.core.admin.model.PrincipalRole;
import org.apache.polaris.core.admin.model.PrincipalWithCredentials;
import org.apache.polaris.tools.sync.polaris.access.AccessControlService;
import org.apache.polaris.tools.sync.polaris.service.PolarisService;
import org.apache.polaris.tools.sync.polaris.service.impl.PolarisApiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;

/**
 * Command that creates the omnipotent principal to access entities internal to a catalog with the appropriate
 * grants.
 */
@CommandLine.Command(
    name = "create-omnipotent-principal",
    mixinStandardHelpOptions = true,
    sortOptions = false,
    description =
        "Creates a principal, associated principal role, and associated catalog role for each catalog "
            + "with appropriate access permissions.")
public class CreateOmnipotentPrincipalCommand implements Callable<Integer> {

  private final Logger consoleLog = LoggerFactory.getLogger("console-log");

  @CommandLine.Option(
          names = {"--polaris-api-connection-properties"},
          required = true,
          description = CLIUtil.API_SERVICE_PROPERTIES_DESCRIPTION
  )
  private Map<String, String> polarisApiConnectionProperties;

  @CommandLine.Option(
      names = {"--replace"},
      description = {
        "Optional flag to enable overwriting the existing omnipotent principal and associated entity if it exists."
      })
  private boolean replace;

  @CommandLine.Option(
      names = {"--write-access"},
      description = {
        "Optional flag to create the principal with write access to every catalog. This is required if "
            + "the Polaris instance is the target of a sync."
      })
  private boolean withWriteAccess;

  @CommandLine.Option(
      names = {"--concurrency"},
      defaultValue = "1",
      description = {
        "Optional flag to specify the number of concurrent threads to use to setup catalog roles."
      })
  private int concurrency;

  @Override
  public Integer call() throws Exception {
    polarisApiConnectionProperties.putIfAbsent(PolarisApiService.ICEBERG_WRITE_ACCESS_PROPERTY,
            String.valueOf(withWriteAccess));

    PolarisService polaris = PolarisServiceFactory.createPolarisService(
            PolarisServiceFactory.ServiceType.API, polarisApiConnectionProperties);

    AccessControlService accessControlService = new AccessControlService((PolarisApiService) polaris);

    PrincipalWithCredentials principalWithCredentials;

    try {
      principalWithCredentials = accessControlService.createOmnipotentPrincipal(replace);
    } catch (Exception e) {
      consoleLog.error("Failed to create omnipotent principal.", e);
      return 1;
    }

    consoleLog.info(
        "Created omnipotent principal {}.", principalWithCredentials.getPrincipal().getName());

    PrincipalRole principalRole;

    try {
      principalRole =
          accessControlService.createAndAssignPrincipalRole(principalWithCredentials, replace);
    } catch (Exception e) {
      consoleLog.error("Failed to create omnipotent principal role and assign it to principal.", e);
      return 1;
    }

    consoleLog.info(
        "Created omnipotent principal role {} and assigned it to omnipotent principal {}.",
        principalWithCredentials.getPrincipal().getName(),
        principalRole.getName());

    List<Catalog> catalogs = polaris.listCatalogs();

    consoleLog.info("Identified {} catalogs to create catalog roles for.", catalogs.size());

    final String permissionLevel = withWriteAccess ? "write" : "readonly";

    AtomicInteger completedCatalogSetups = new AtomicInteger(0);

    Queue<Catalog> failedCatalogs = new ConcurrentLinkedQueue<>();

    ExecutorService executor = Executors.newFixedThreadPool(concurrency);

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (Catalog catalog : catalogs) {
      CompletableFuture<Void> future =
          CompletableFuture.runAsync(
              () -> {
                try {
                  accessControlService.setupOmnipotentRoleForCatalog(
                      catalog.getName(), principalRole, replace, withWriteAccess);
                } catch (Exception e) {
                  failedCatalogs.add(catalog);
                  consoleLog.error(
                      "Failed to setup omnipotent catalog role for catalog {} with {} access. - {}/{}",
                      catalog.getName(),
                      permissionLevel,
                      completedCatalogSetups.incrementAndGet(),
                      catalogs.size(),
                      e);
                  return;
                }

                consoleLog.info(
                    "Finished omnipotent principal setup for catalog {} with {} access. - {}/{}",
                    catalog.getName(),
                    permissionLevel,
                    completedCatalogSetups.incrementAndGet(),
                    catalogs.size());
              },
              executor);

      futures.add(future);
    }

    futures.forEach(CompletableFuture::join);

    consoleLog.info(
        "Encountered issues creating catalog roles for the following catalogs: {}",
        failedCatalogs.stream().map(Catalog::getName).toList());

    consoleLog.info(
        "\n======================================================\n"
            + "Omnipotent Principal Credentials:\n"
            + "\tname = {}\n"
            + "\tclientId = {}\n"
            + "\tclientSecret = {}\n"
            + "======================================================",
        principalWithCredentials.getPrincipal().getName(),
        principalWithCredentials.getCredentials().getClientId(),
        principalWithCredentials.getCredentials().getClientSecret());

    return 0;
  }
}
