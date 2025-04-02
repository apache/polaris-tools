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
import io.gatling.http.Predef.http
import org.apache.polaris.benchmarks.actions.{
  AuthenticationActions,
  NamespaceActions,
  TableActions,
  ViewActions
}
import org.apache.polaris.benchmarks.parameters.BenchmarkConfig.config
import org.apache.polaris.benchmarks.parameters.{
  ConnectionParameters,
  DatasetParameters,
  WorkloadParameters
}
import org.apache.polaris.benchmarks.util.{BufferedRandomIterator, CircularIterator}
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.AtomicReference
import scala.concurrent.duration._

class TableCommitsCreator extends Simulation {
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
  private val accessToken: AtomicReference[String] = new AtomicReference()

  private val authActions = AuthenticationActions(cp, accessToken)
  private val nsActions = NamespaceActions(dp, wp, accessToken)
  private val tblActions = TableActions(dp, wp, accessToken)
  private val viewActions = ViewActions(dp, wp, accessToken)

  private val nsListFeeder = new CircularIterator(nsActions.namespaceIdentityFeeder)
  private val nsExistsFeeder = new CircularIterator(nsActions.namespaceIdentityFeeder)
  private val nsFetchFeeder = new CircularIterator(nsActions.namespaceFetchFeeder)

  private val tblListFeeder = new CircularIterator(tblActions.tableIdentityFeeder)
  private val tblExistsFeeder = new CircularIterator(tblActions.tableIdentityFeeder)
  private val tblFetchFeeder = new CircularIterator(tblActions.tableFetchFeeder)
  private val tblUpdateFeeder = new BufferedRandomIterator(
    new CircularIterator(tblActions.propertyUpdateFeeder),
    100_000,
    wp.seed
  )

  private val viewListFeeder = new CircularIterator(viewActions.viewIdentityFeeder)
  private val viewExistsFeeder = new CircularIterator(viewActions.viewIdentityFeeder)
  private val viewFetchFeeder = new CircularIterator(viewActions.viewFetchFeeder)

  // --------------------------------------------------------------------------------
  // Workload: Authenticate and store the access token for later use
  // --------------------------------------------------------------------------------
  val authenticateScenario: ScenarioBuilder =
    scenario("Authenticate using the OAuth2 REST API endpoint")
      .feed(authActions.feeder())
      .tryMax(5) {
        exec(authActions.authenticateAndSaveAccessToken)
      }

  val refreshAccessTokenScenario: ScenarioBuilder = scenario("Refresh the access token")
    .feed(authActions.feeder())
    .tryMax(5) {
      exec(authActions.authenticateAndSaveAccessToken)
    }

  val tableUpdateScenario: ScenarioBuilder =
    scenario("Create table commits using the Iceberg REST API")
      .exec(authActions.restoreAccessTokenInSession)
      .group("Write")(
        exec(feed(tblUpdateFeeder).exec(tblActions.updateTable))
      )

  val readScenario: ScenarioBuilder =
    scenario("Read namespaces, tables and views using the Iceberg REST API")
      .exec(authActions.restoreAccessTokenInSession)
      .group("Read")(
        uniformRandomSwitch(
          exec(feed(nsListFeeder).exec(nsActions.fetchAllChildrenNamespaces)),
          exec(feed(nsExistsFeeder).exec(nsActions.checkNamespaceExists)),
          exec(feed(nsFetchFeeder).exec(nsActions.fetchNamespace)),
          exec(feed(tblListFeeder).exec(tblActions.fetchAllTables)),
          exec(feed(tblExistsFeeder).exec(tblActions.checkTableExists)),
          exec(feed(tblFetchFeeder).exec(tblActions.fetchTable)),
          exec(feed(viewListFeeder).exec(viewActions.fetchAllViews)),
          exec(feed(viewExistsFeeder).exec(viewActions.checkViewExists)),
          exec(feed(viewFetchFeeder).exec(viewActions.fetchView))
        )
      )

  private val httpProtocol = http
    .baseUrl(cp.baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  private val commitsPerSecond = sys.env.getOrElse("COMMITS_PER_SECOND", "10").toInt
  private val readsPerSecond = sys.env.getOrElse("READS_PER_SECOND", "100").toInt
  private val durationInMinutes = sys.env.getOrElse("DURATION_IN_MINUTES", "5").toInt
  setUp(
    authenticateScenario
      .inject(atOnceUsers(1))
      .andThen(
        tableUpdateScenario.inject(
          constantUsersPerSec(commitsPerSecond).during(durationInMinutes.minutes).randomized
        ),
        readScenario.inject(
          constantUsersPerSec(readsPerSecond).during(durationInMinutes.minutes).randomized
        ),
        // Refresh the access token every 30 minutes
        refreshAccessTokenScenario.inject(
          constantUsersPerSec(1d / (30 * 60)).during(durationInMinutes.minutes)
        )
      )
  ).protocols(httpProtocol)
}
