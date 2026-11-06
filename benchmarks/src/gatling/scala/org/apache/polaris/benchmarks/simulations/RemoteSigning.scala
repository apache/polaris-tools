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
  AuthParameters,
  ConnectionParameters,
  DatasetParameters,
  RemoteSigningParameters
}
import org.apache.polaris.benchmarks.util.CircularIterator

import java.util.concurrent.atomic.AtomicReference
import scala.concurrent.duration._

/**
 * This simulation tests S3 remote signing on an existing dataset. Each user loads a table with
 * remote signing access delegation, then signs requests for objects in that table, as a query
 * engine would when reading or writing data files.
 *
 * The ratio of read sign requests to write sign requests is controlled by the readWriteRatio
 * parameter in the RemoteSigningParameters. Users can be spread across several principals, and
 * injected with an open or a closed load model. The simulation does not depend on how the server
 * authorizes sign requests, and can be used to compare server configurations.
 */
class RemoteSigning extends Simulation {

  // --------------------------------------------------------------------------------
  // Load parameters
  // --------------------------------------------------------------------------------
  val cp: ConnectionParameters = config.connectionParameters
  val ap: AuthParameters = config.authParameters
  val dp: DatasetParameters = config.datasetParameters
  val rp: RemoteSigningParameters = config.workloadParameters.remoteSigning

  // --------------------------------------------------------------------------------
  // Helper values
  // --------------------------------------------------------------------------------
  private val principalsActions = PrincipalsActions(
    cp,
    ap,
    if (rp.principals.nonEmpty) rp.principals else Seq((ap.clientId, ap.clientSecret))
  )
  private val tblActions = TableActions(dp, new AtomicReference[String]())
  private val rsActions = RemoteSigningActions(rp)

  private val tblFeeder = new CircularIterator(tblActions.tableIdentityFeeder)

  // --------------------------------------------------------------------------------
  // Workload: Load a table, then sign read and write requests for its objects
  // --------------------------------------------------------------------------------
  val remoteSigningScenario: ScenarioBuilder =
    scenario("Load tables and sign requests using the Iceberg REST API")
      .exec(principalsActions.selectRandomPrincipal)
      .exec(principalsActions.restoreAccessTokenInSession)
      .feed(tblFeeder)
      .exec(rsActions.loadTable)
      .exitHereIfFailed
      .repeat(rp.signRequestsPerTableLoad)(
        exec(principalsActions.restoreAccessTokenInSession).randomSwitch(
          rp.gatlingReadRatio -> rsActions.signReadRequest,
          rp.gatlingWriteRatio -> rsActions.signWriteRequest
        )
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

  // Get the configured load model and duration
  private val duration = rp.durationInMinutes.minutes
  private val remoteSigningPopulation =
    if (rp.loadModel == "closed") {
      remoteSigningScenario.inject(constantConcurrentUsers(rp.concurrentUsers).during(duration))
    } else {
      remoteSigningScenario.inject(constantUsersPerSec(rp.throughput).during(duration).randomized)
    }

  setUp(
    principalsActions
      .continuouslyRefreshOauthTokens()
      .inject(atOnceUsers(1))
      .protocols(httpProtocol),
    principalsActions.waitForAuthentication
      .inject(atOnceUsers(1))
      .andThen(remoteSigningPopulation.protocols(httpProtocol))
      .andThen(
        principalsActions.stopRefreshingTokens.inject(atOnceUsers(1)).protocols(httpProtocol)
      )
  )
}
