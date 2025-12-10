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
import org.apache.polaris.benchmarks.actions.{SetupActions, TableActions, ViewActions}
import org.apache.polaris.benchmarks.parameters.BenchmarkConfig.config
import org.apache.polaris.benchmarks.parameters.{
  AuthParameters,
  ConnectionParameters,
  DatasetParameters,
  WorkloadParameters
}
import org.apache.polaris.benchmarks.util.CircularIterator
import org.slf4j.LoggerFactory

import scala.concurrent.duration._

class CreateCommits extends Simulation {
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
  private val setupActions = SetupActions(cp, ap)
  private val tableActions = TableActions(dp, wp, setupActions.accessToken)
  private val viewActions = ViewActions(dp, wp, setupActions.accessToken)

  // --------------------------------------------------------------------------------
  // Read and write workloads:
  // * Create table commits by updating table properties
  // * Read namespaces, tables and views
  // --------------------------------------------------------------------------------
  val tableUpdateScenario: ScenarioBuilder =
    scenario("Create table commits by updating properties")
      .exec(setupActions.restoreAccessTokenInSession)
      .feed(tableActions.propertyUpdateFeeder())
      .exec(tableActions.updateTable)

  // --------------------------------------------------------------------------------
  // Read and write workloads:
  // * Create table commits by updating table properties
  // * Read namespaces, tables and views
  // --------------------------------------------------------------------------------
  val viewUpdateScenario: ScenarioBuilder =
    scenario("Create view commits by updating properties")
      .exec(setupActions.restoreAccessTokenInSession)
      .feed(viewActions.propertyUpdateFeeder())
      .exec(viewActions.updateView)

  private val httpProtocol = http
    .baseUrl(cp.baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  private val tableCommitsThroughput = wp.createCommits.tableCommitsThroughput
  private val viewCommitsThroughput = wp.createCommits.viewCommitsThroughput
  private val durationInMinutes = wp.createCommits.durationInMinutes
  setUp(
    setupActions.continuouslyRefreshOauthToken().inject(atOnceUsers(1)).protocols(httpProtocol),
    setupActions.waitForAuthentication
      .inject(atOnceUsers(1))
      .andThen(
        tableUpdateScenario
          .inject(
            constantUsersPerSec(tableCommitsThroughput).during(durationInMinutes.minutes)
          )
          .protocols(httpProtocol),
        viewUpdateScenario
          .inject(
            constantUsersPerSec(viewCommitsThroughput).during(durationInMinutes.minutes)
          )
          .protocols(httpProtocol)
      )
      .andThen(setupActions.stopRefreshingToken.inject(atOnceUsers(1)).protocols(httpProtocol))
  )
}
