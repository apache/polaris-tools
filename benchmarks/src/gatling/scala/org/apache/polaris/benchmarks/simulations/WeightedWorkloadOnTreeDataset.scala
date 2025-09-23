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
  Distribution,
  RandomNumberProvider,
  WorkloadParameters
}
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.AtomicReference
import scala.concurrent.duration._

/**
 * This simulation performs reads and writes based on distributions specified in the config. It
 * allows the simulation of workloads where e.g. a small fraction of tables get most writes. It is
 * intended to be used against a Polaris instance with a pre-existing tree dataset.
 */
class WeightedWorkloadOnTreeDataset extends Simulation {
  private val logger = LoggerFactory.getLogger(getClass)

  // --------------------------------------------------------------------------------
  // Load parameters
  // --------------------------------------------------------------------------------
  val cp: ConnectionParameters = config.connectionParameters
  val dp: DatasetParameters = config.datasetParameters
  val wp: WorkloadParameters = config.workloadParameters

  if (dp.numTablesMax > 0) {
    throw new RuntimeException(
      "This workload is not compatible with the dataset option `numTablesMax`."
    )
  }

  println("### Reader distributions ###")
  wp.weightedWorkloadOnTreeDataset.readers.foreach(_.printDescription(dp))

  println("### Writer distributions ###")
  wp.weightedWorkloadOnTreeDataset.writers.foreach(_.printDescription(dp))

  // --------------------------------------------------------------------------------
  // Helper values
  // --------------------------------------------------------------------------------
  private val accessToken: AtomicReference[String] = new AtomicReference()

  private val authActions = AuthenticationActions(cp, accessToken)
  private val tblActions = TableActions(dp, wp, accessToken)

  // --------------------------------------------------------------------------------
  // Authentication related workloads
  // --------------------------------------------------------------------------------
  val refreshOauthForDuration: ScenarioBuilder =
    scenario("Authenticate every 30s using the Iceberg REST API")
      .during(wp.weightedWorkloadOnTreeDataset.durationInMinutes.minutes) {
        feed(authActions.feeder())
          .exec(authActions.authenticateAndSaveAccessToken)
          .pause(30.seconds)
      }

  val waitForAuthentication: ScenarioBuilder =
    scenario("Wait for the authentication token to be available")
      .asLongAs(_ => accessToken.get() == null) {
        pause(1.second)
      }

  // --------------------------------------------------------------------------------
  // Build up the HTTP protocol configuration and set up the simulation
  // --------------------------------------------------------------------------------
  private val httpProtocol = http
    .baseUrl(cp.baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .disableCaching

  // --------------------------------------------------------------------------------
  // Create all reader/writer scenarios and prepare them for injection
  // --------------------------------------------------------------------------------
  private val readerScenarioBuilders: List[ScenarioBuilder] =
    wp.weightedWorkloadOnTreeDataset.readers.zipWithIndex.flatMap { case (dist, i) =>
      (0 until dist.count).map { threadId =>
        val rnp =
          RandomNumberProvider(wp.weightedWorkloadOnTreeDataset.seed, ((i + 1) * 1000) + threadId)
        scenario(s"Reader-$i-$threadId")
          .exec(authActions.restoreAccessTokenInSession)
          .during(wp.weightedWorkloadOnTreeDataset.durationInMinutes.minutes) {
            exec { session =>
              val tableIndex = dist.sample(dp.maxPossibleTables, rnp)
              val (catalog, namespace, table) =
                Distribution.tableIndexToIdentifier(tableIndex, dp)

              // Checked in `fetchTable`
              val expectedProperties: Map[String, String] = (0 until dp.numTableProperties)
                .map(id => s"InitialAttribute_$id" -> s"$id")
                .toMap
              val expectedLocation =
                s"${dp.defaultBaseLocation}/$catalog/${namespace.mkString("/")}/${table}"

              session
                .set("catalogName", catalog)
                .set("multipartNamespace", namespace.mkString(0x1f.toChar.toString))
                .set("tableName", table)
                .set("initialProperties", expectedProperties)
                .set("location", expectedLocation)
            }.exec(tblActions.fetchTable)
          }
      }
    }.toList

  private val writerScenarioBuilders: List[ScenarioBuilder] =
    wp.weightedWorkloadOnTreeDataset.writers.zipWithIndex.flatMap { case (dist, i) =>
      (0 until dist.count).map { threadId =>
        val rnp =
          RandomNumberProvider(wp.weightedWorkloadOnTreeDataset.seed, ((i + 1) * 2000) + threadId)
        scenario(s"Writer-$i-$threadId")
          .exec(authActions.restoreAccessTokenInSession)
          .during(wp.weightedWorkloadOnTreeDataset.durationInMinutes.minutes) {
            exec { session =>
              val tableIndex = dist.sample(dp.maxPossibleTables, rnp)
              val (catalog, namespace, table) =
                Distribution.tableIndexToIdentifier(tableIndex, dp)

              // Needed for `updateTable`
              val now = System.currentTimeMillis
              val newProperty = s"""{"last_updated": "${now}"}"""

              session
                .set("catalogName", catalog)
                .set("multipartNamespace", namespace.mkString(0x1f.toChar.toString))
                .set("tableName", table)
                .set("newProperty", newProperty)
            }.exec(tblActions.updateTable)
          }
      }
    }.toList

  // --------------------------------------------------------------------------------
  // Setup
  // --------------------------------------------------------------------------------
  setUp(
    refreshOauthForDuration.inject(atOnceUsers(1)).protocols(httpProtocol),
    waitForAuthentication
      .inject(atOnceUsers(1))
      .protocols(httpProtocol)
      .andThen(
        readerScenarioBuilders.map(_.inject(atOnceUsers(1)).protocols(httpProtocol)) ++
          writerScenarioBuilders.map(_.inject(atOnceUsers(1)).protocols(httpProtocol))
      )
  )
}
