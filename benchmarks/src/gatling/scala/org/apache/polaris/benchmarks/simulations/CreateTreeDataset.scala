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
import io.gatling.core.structure.ScenarioBuilder
import io.gatling.http.Predef._
import org.apache.polaris.benchmarks.actions._
import org.apache.polaris.benchmarks.parameters.BenchmarkConfig.config
import org.apache.polaris.benchmarks.parameters.{
  ConnectionParameters,
  DatasetParameters,
  WorkloadParameters
}
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.{AtomicBoolean, AtomicInteger, AtomicReference}
import scala.concurrent.duration._

/**
 * This simulation is a 100% write workload that creates a tree dataset in Polaris. It is intended
 * to be used against an empty Polaris instance.
 */
class CreateTreeDataset extends Simulation {
  private val logger = LoggerFactory.getLogger(getClass)

  // --------------------------------------------------------------------------------
  // Load parameters
  // --------------------------------------------------------------------------------
  val cp: ConnectionParameters = config.connectionParameters
  val dp: DatasetParameters = config.datasetParameters
  val wp: WorkloadParameters = config.workloadParameters

  // --------------------------------------------------------------------------------
  // Helper values
  // --------------------------------------------------------------------------------
  private val numNamespaces: Int = dp.nAryTree.numberOfNodes
  private val accessToken: AtomicReference[String] = new AtomicReference()
  private val shouldRefreshToken: AtomicBoolean = new AtomicBoolean(true)

  private val authenticationActions = AuthenticationActions(cp, accessToken, 5, Set(500))
  private val catalogActions = CatalogActions(dp, accessToken, 0, Set())
  private val namespaceActions = NamespaceActions(dp, wp, accessToken, 5, Set(500))
  private val tableActions = TableActions(dp, wp, accessToken, 0, Set())
  private val viewActions = ViewActions(dp, wp, accessToken, 0, Set())

  private val createdCatalogs = new AtomicInteger()
  private val createdNamespaces = new AtomicInteger()
  private val createdTables = new AtomicInteger()
  private val createdViews = new AtomicInteger()

  // --------------------------------------------------------------------------------
  // Authentication related workloads:
  // * Authenticate and store the access token for later use every minute
  // * Wait for an OAuth token to be available
  // * Stop the token refresh loop
  // --------------------------------------------------------------------------------
  val continuouslyRefreshOauthToken: ScenarioBuilder =
    scenario("Authenticate every minute using the Iceberg REST API")
      .asLongAs(_ => shouldRefreshToken.get()) {
        feed(authenticationActions.feeder())
          .exec(authenticationActions.authenticateAndSaveAccessToken)
          .pause(1.minute)
      }

  val waitForAuthentication: ScenarioBuilder =
    scenario("Wait for the authentication token to be available")
      .asLongAs(_ => accessToken.get() == null) {
        pause(1.second)
      }

  val stopRefreshingToken: ScenarioBuilder =
    scenario("Stop refreshing the authentication token")
      .exec { session =>
        shouldRefreshToken.set(false)
        session
      }

  // --------------------------------------------------------------------------------
  // Workload: Create catalogs
  // --------------------------------------------------------------------------------
  val createCatalogs: ScenarioBuilder =
    scenario("Create catalogs using the Polaris Management REST API")
      .exec(authenticationActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        createdCatalogs.getAndIncrement() < dp.numCatalogs && session.contains("accessToken")
      )(
        feed(catalogActions.feeder())
          .exec(catalogActions.createCatalog)
      )

  // --------------------------------------------------------------------------------
  // Workload: Create namespaces
  // --------------------------------------------------------------------------------
  val createNamespaces: ScenarioBuilder = scenario("Create namespaces using the Iceberg REST API")
    .exec(authenticationActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      createdNamespaces.getAndIncrement() < numNamespaces && session.contains("accessToken")
    )(
      feed(namespaceActions.namespaceCreationFeeder())
        .exec(namespaceActions.createNamespace)
    )

  // --------------------------------------------------------------------------------
  // Workload: Create tables
  // --------------------------------------------------------------------------------
  val createTables: ScenarioBuilder = scenario("Create tables using the Iceberg REST API")
    .exec(authenticationActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      createdTables.getAndIncrement() < dp.numTables && session.contains("accessToken")
    )(
      feed(tableActions.tableCreationFeeder())
        .exec(tableActions.createTable)
    )

  // --------------------------------------------------------------------------------
  // Workload: Create views
  // --------------------------------------------------------------------------------
  val createViews: ScenarioBuilder = scenario("Create views using the Iceberg REST API")
    .exec(authenticationActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      createdViews.getAndIncrement() < dp.numViews && session.contains("accessToken")
    )(
      feed(viewActions.viewCreationFeeder())
        .exec(viewActions.createView)
    )

  // --------------------------------------------------------------------------------
  // Build up the HTTP protocol configuration and set up the simulation
  // --------------------------------------------------------------------------------
  private val httpProtocol = http
    .baseUrl(cp.baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .disableCaching

  // Get the configured throughput for tables and views
  private val tableThroughput = wp.createTreeDataset.tableThroughput
  private val viewThroughput = wp.createTreeDataset.viewThroughput

  setUp(
    continuouslyRefreshOauthToken.inject(atOnceUsers(1)).protocols(httpProtocol),
    waitForAuthentication
      .inject(atOnceUsers(1))
      .andThen(createCatalogs.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(
        createNamespaces
          .inject(
            constantUsersPerSec(1).during(1.seconds),
            constantUsersPerSec(dp.nsWidth - 1).during(dp.nsDepth.seconds)
          )
          .protocols(httpProtocol)
      )
      .andThen(createTables.inject(atOnceUsers(tableThroughput)).protocols(httpProtocol))
      .andThen(createViews.inject(atOnceUsers(viewThroughput)).protocols(httpProtocol))
      .andThen(stopRefreshingToken.inject(atOnceUsers(1)).protocols(httpProtocol))
  )
}
