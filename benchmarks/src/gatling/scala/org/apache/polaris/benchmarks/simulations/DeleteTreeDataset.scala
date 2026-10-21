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
package org.apache.polaris.benchmarks.simulations

import io.gatling.core.Predef._
import io.gatling.core.structure.{PopulationBuilder, ScenarioBuilder}
import io.gatling.http.Predef._
import org.apache.polaris.benchmarks.actions._
import org.apache.polaris.benchmarks.parameters.BenchmarkConfig.config
import org.apache.polaris.benchmarks.parameters.{
  AuthParameters,
  ConnectionParameters,
  DatasetParameters,
  WorkloadParameters
}
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.AtomicInteger

/**
 * This simulation is a 100% delete workload that removes a tree dataset created by
 * [[CreateTreeDataset]] in Polaris. It must be run with the same dataset parameters as the ones
 * used to create the dataset.
 *
 * Tables and views are deleted first, then namespaces one tree level at a time starting from the
 * deepest level, then the catalogs. Entities that don't exist are ignored. Table and view deletion
 * is skipped when the dataset does not contain any (see `tables-per-namespace` and
 * `views-per-namespace`).
 *
 * Tables are dropped with purge as controlled by the `purge` configuration (default false). When
 * enabled, it removes their data and metadata files on drop and requires DROP_WITH_PURGE_ENABLED to
 * be enabled on the server side. Views are always dropped without purge; their metadata purging is
 * governed by the server-side PURGE_VIEW_METADATA_ON_DROP configuration.
 */
class DeleteTreeDataset extends Simulation {
  private val logger = LoggerFactory.getLogger(getClass)

  // --------------------------------------------------------------------------------
  // Load parameters
  // --------------------------------------------------------------------------------
  val cp: ConnectionParameters = config.connectionParameters
  val ap: AuthParameters = config.authParameters
  val dp: DatasetParameters = config.datasetParameters
  val wp: WorkloadParameters = config.workloadParameters

  // --------------------------------------------------------------------------------
  // Helper values
  // --------------------------------------------------------------------------------
  private val numNamespaces: Int = dp.nAryTree.numberOfNodes
  private val purge: Boolean = wp.deleteTreeDataset.purge
  private val setupActions = SetupActions(cp, ap)
  private val catalogActions = CatalogActions(dp, setupActions.accessToken, 0, Set())
  private val namespaceActions = NamespaceActions(dp, setupActions.accessToken, 5, Set(500))
  private val tableActions = TableActions(dp, setupActions.accessToken, 5, Set(500))
  private val viewActions = ViewActions(dp, setupActions.accessToken, 5, Set(500))

  private val deletedCatalogs = new AtomicInteger()
  private val deletedTables = new AtomicInteger()
  private val deletedViews = new AtomicInteger()

  // --------------------------------------------------------------------------------
  // Workload: Delete views
  // --------------------------------------------------------------------------------
  val deleteViews: ScenarioBuilder = scenario("Delete views using the Iceberg REST API")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      deletedViews.getAndIncrement() < dp.numViews && session.contains("accessToken")
    )(
      feed(viewActions.viewIdentityFeeder())
        .exec(viewActions.deleteView)
    )

  // --------------------------------------------------------------------------------
  // Workload: Delete tables
  // --------------------------------------------------------------------------------
  val deleteTables: ScenarioBuilder = scenario("Delete tables using the Iceberg REST API")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      deletedTables.getAndIncrement() < dp.numTables && session.contains("accessToken")
    )(
      feed(tableActions.tableIdentityFeeder())
        .exec(tableActions.deleteTable(purge))
    )

  // --------------------------------------------------------------------------------
  // Workload: Delete namespaces
  // --------------------------------------------------------------------------------
  private def deleteNamespacesAtDepth(depth: Int): ScenarioBuilder = {
    val numNamespacesAtDepth = dp.nAryTree.ordinalsAtDepth(depth).size
    val deletedNamespaces = new AtomicInteger()
    scenario(s"Delete namespaces at depth $depth using the Iceberg REST API")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        deletedNamespaces.getAndIncrement() < numNamespacesAtDepth && session
          .contains("accessToken")
      )(
        feed(namespaceActions.namespaceDeletionFeeder(depth))
          .exec(namespaceActions.deleteNamespace)
      )
  }

  // --------------------------------------------------------------------------------
  // Workload: Delete catalogs
  // --------------------------------------------------------------------------------
  val deleteCatalogs: ScenarioBuilder =
    scenario("Delete catalogs using the Polaris Management REST API")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        deletedCatalogs.getAndIncrement() < dp.numCatalogs && session.contains("accessToken")
      )(
        feed(catalogActions.feeder())
          .exec(catalogActions.deleteCatalog)
      )

  // --------------------------------------------------------------------------------
  // Build up the HTTP protocol configuration and set up the simulation
  // --------------------------------------------------------------------------------
  private val httpProtocol = http
    .baseUrl(cp.baseUrl)
    .headers(cp.headers)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .disableCaching

  // Get the configured throughput for namespace, tables and views
  private val namespaceThroughput = wp.deleteTreeDataset.namespaceThroughput
  private val tableThroughput = wp.deleteTreeDataset.tableThroughput
  private val viewThroughput = wp.deleteTreeDataset.viewThroughput

  private val waitForDeleteAuthentication: PopulationBuilder = setupActions.waitForAuthentication
    .inject(atOnceUsers(1))

  private val deleteViewsAndTables: PopulationBuilder = {
    val afterViews =
      if (dp.numViews > 0) {
        waitForDeleteAuthentication
          .andThen(deleteViews.inject(atOnceUsers(viewThroughput)).protocols(httpProtocol))
      } else {
        waitForDeleteAuthentication
      }
    if (dp.numTables > 0) {
      afterViews.andThen(deleteTables.inject(atOnceUsers(tableThroughput)).protocols(httpProtocol))
    } else {
      afterViews
    }
  }

  private val deleteViewsTablesAndNamespaces: PopulationBuilder =
    (dp.nsDepth - 1 to 0 by -1).foldLeft(deleteViewsAndTables) { (populationBuilder, depth) =>
      val users = math.min(namespaceThroughput, dp.nAryTree.ordinalsAtDepth(depth).size)
      populationBuilder.andThen(
        deleteNamespacesAtDepth(depth).inject(atOnceUsers(users)).protocols(httpProtocol)
      )
    }

  setUp(
    setupActions.continuouslyRefreshOauthToken().inject(atOnceUsers(1)).protocols(httpProtocol),
    deleteViewsTablesAndNamespaces
      .andThen(deleteCatalogs.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(setupActions.stopRefreshingToken.inject(atOnceUsers(1)).protocols(httpProtocol))
  ).assertions(
    (if (dp.numViews > 0) Seq(details("Delete View").successfulRequests.count.is(dp.numViews))
     else Seq.empty) ++
      (if (dp.numTables > 0) Seq(details("Delete Table").successfulRequests.count.is(dp.numTables))
       else Seq.empty) ++
      Seq(
        details("Delete Namespace").successfulRequests.count.is(numNamespaces),
        details("Delete Catalog").successfulRequests.count.is(dp.numCatalogs)
      ): _*
  )
}
