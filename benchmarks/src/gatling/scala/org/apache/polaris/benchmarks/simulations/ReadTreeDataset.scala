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
import org.apache.polaris.benchmarks.parameters.WorkloadParameters
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.{AtomicBoolean, AtomicInteger, AtomicReference}
import scala.concurrent.duration.DurationInt

/**
 * This simulation is a 100% read workload that fetches a tree dataset in Polaris. It is intended to
 * be used against a Polaris instance with a pre-existing tree dataset. It has no side effect on the
 * dataset and therefore can be executed multiple times without any issue.
 */
class ReadTreeDataset extends Simulation {
  private val logger = LoggerFactory.getLogger(getClass)

  // --------------------------------------------------------------------------------
  // Load parameters
  // --------------------------------------------------------------------------------
  private val cp = config.connectionParameters
  private val dp = config.datasetParameters
  val wp: WorkloadParameters = config.workloadParameters

  // --------------------------------------------------------------------------------
  // Helper values
  // --------------------------------------------------------------------------------
  private val numNamespaces: Int = dp.nAryTree.numberOfNodes
  private val accessToken: AtomicReference[String] = new AtomicReference()
  private val shouldRefreshToken: AtomicBoolean = new AtomicBoolean(true)

  private val authenticationActions = AuthenticationActions(cp, accessToken)
  private val catalogActions = CatalogActions(dp, accessToken)
  private val namespaceActions = NamespaceActions(dp, wp, accessToken)
  private val tableActions = TableActions(dp, wp, accessToken)
  private val viewActions = ViewActions(dp, wp, accessToken)

  private val verifiedCatalogs = new AtomicInteger()
  private val verifiedNamespaces = new AtomicInteger()
  private val verifiedTables = new AtomicInteger()
  private val verifiedViews = new AtomicInteger()

  // --------------------------------------------------------------------------------
  // Authentication related workloads:
  // * Authenticate and store the access token for later use every minute
  // * Wait for an OAuth token to be available
  // * Stop the token refresh loop
  // --------------------------------------------------------------------------------
  val continuouslyRefreshOauthToken: ScenarioBuilder =
    scenario("Authenticate every minute using the Iceberg REST API")
      .asLongAs(_ => shouldRefreshToken.get())(
        feed(authenticationActions.feeder())
          .exec(authenticationActions.authenticateAndSaveAccessToken)
          .pause(1.minute)
      )

  val waitForAuthentication: ScenarioBuilder =
    scenario("Wait for the authentication token to be available")
      .asLongAs(_ => accessToken.get() == null)(
        pause(1.second)
      )

  val stopRefreshingToken: ScenarioBuilder =
    scenario("Stop refreshing the authentication token")
      .exec { session =>
        shouldRefreshToken.set(false)
        session
      }

  // --------------------------------------------------------------------------------
  // Workload: Verify each catalog
  // --------------------------------------------------------------------------------
  private val verifyCatalogs = scenario("Verify catalogs using the Polaris Management REST API")
    .exec(authenticationActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      verifiedCatalogs.getAndIncrement() < dp.numCatalogs && session.contains("accessToken")
    )(
      feed(catalogActions.feeder())
        .exec(catalogActions.fetchCatalog)
    )

  // --------------------------------------------------------------------------------
  // Workload: Verify namespaces
  // --------------------------------------------------------------------------------
  private val verifyNamespaces = scenario("Verify namespaces using the Iceberg REST API")
    .exec(authenticationActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      verifiedNamespaces.getAndIncrement() < numNamespaces && session.contains("accessToken")
    )(
      feed(namespaceActions.namespaceFetchFeeder())
        .exec(namespaceActions.fetchAllChildrenNamespaces)
        .exec(namespaceActions.checkNamespaceExists)
        .exec(namespaceActions.fetchNamespace)
    )

  // --------------------------------------------------------------------------------
  // Workload: Verify tables
  // --------------------------------------------------------------------------------
  private val verifyTables = scenario("Verify tables using the Iceberg REST API")
    .exec(authenticationActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      verifiedTables.getAndIncrement() < dp.numTables && session.contains("accessToken")
    )(
      feed(tableActions.tableFetchFeeder())
        .exec(tableActions.fetchAllTables)
        .exec(tableActions.checkTableExists)
        .exec(tableActions.fetchTable)
    )

  // --------------------------------------------------------------------------------
  // Workload: Verify views
  // --------------------------------------------------------------------------------
  private val verifyViews = scenario("Verify views using the Iceberg REST API")
    .exec(authenticationActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      verifiedViews.getAndIncrement() < dp.numViews && session.contains("accessToken")
    )(
      feed(viewActions.viewFetchFeeder())
        .exec(viewActions.fetchAllViews)
        .exec(viewActions.checkViewExists)
        .exec(viewActions.fetchView)
    )

  // --------------------------------------------------------------------------------
  // Build up the HTTP protocol configuration and set up the simulation
  // --------------------------------------------------------------------------------
  private val httpProtocol = http
    .baseUrl(cp.baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  // Get the configured throughput for tables and views
  private val tableThroughput = wp.readTreeDataset.tableThroughput
  private val viewThroughput = wp.readTreeDataset.viewThroughput

  setUp(
    continuouslyRefreshOauthToken.inject(atOnceUsers(1)).protocols(httpProtocol),
    waitForAuthentication
      .inject(atOnceUsers(1))
      .andThen(verifyCatalogs.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(verifyNamespaces.inject(atOnceUsers(dp.nsDepth)).protocols(httpProtocol))
      .andThen(verifyTables.inject(atOnceUsers(tableThroughput)).protocols(httpProtocol))
      .andThen(verifyViews.inject(atOnceUsers(viewThroughput)).protocols(httpProtocol))
      .andThen(stopRefreshingToken.inject(atOnceUsers(1)).protocols(httpProtocol))
  )
}
