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
package org.apache.polaris.benchmarks.actions

import io.gatling.core.Predef._
import io.gatling.core.structure.{ChainBuilder, ScenarioBuilder}
import io.gatling.http.Predef._
import org.apache.polaris.benchmarks.parameters.ConnectionParameters

import java.util.concurrent.atomic.{AtomicBoolean, AtomicReference}
import scala.concurrent.duration._

/**
 * Actions for setting up authentication and managing shared state across benchmark simulations.
 * This class encapsulates the common authentication patterns used across all simulations,
 * eliminating code duplication and providing a consistent authentication mechanism.
 *
 * @param cp Connection parameters containing client credentials
 * @param maxRetries Maximum number of retry attempts for authentication failures
 * @param retryableHttpCodes HTTP status codes that should trigger a retry
 */
case class SetupActions(
    cp: ConnectionParameters,
    maxRetries: Int = 10,
    retryableHttpCodes: Set[Int] = Set(500)
) {

  /**
   * Shared access token reference that can be passed to all action classes. This token is
   * automatically updated by the authentication scenarios.
   */
  val accessToken: AtomicReference[String] = new AtomicReference()

  /**
   * Internal flag to control the token refresh loop. Set to false to stop continuous token refresh
   * scenarios.
   */
  private val shouldRefreshToken: AtomicBoolean = new AtomicBoolean(true)

  /**
   * Authentication actions instance that handles the actual OAuth token operations. This is private
   * as all necessary functionality is exposed through SetupActions methods.
   */
  private val authActions: AuthenticationActions =
    AuthenticationActions(cp, accessToken, maxRetries, retryableHttpCodes)

  /**
   * Continuously refreshes the OAuth token at a specified interval until stopped. This scenario
   * runs in a loop controlled by the shouldRefreshToken flag.
   *
   * @param refreshInterval Duration between token refresh attempts (default: 1 minute)
   * @return ScenarioBuilder that continuously refreshes the token
   */
  def continuouslyRefreshOauthToken(refreshInterval: FiniteDuration = 1.minute): ScenarioBuilder =
    scenario(s"Authenticate every ${refreshInterval.toSeconds}s using the Iceberg REST API")
      .asLongAs(_ => shouldRefreshToken.get()) {
        feed(authActions.feeder())
          .exec(authActions.authenticateAndSaveAccessToken)
          .pause(refreshInterval)
      }

  /**
   * Refreshes the OAuth token at a specified interval for a fixed duration. This scenario is useful
   * when the simulation has a predetermined runtime.
   *
   * @param duration Total duration to keep refreshing the token
   * @param refreshInterval Duration between token refresh attempts (default: 30 seconds)
   * @return ScenarioBuilder that refreshes the token for the specified duration
   */
  def refreshOauthForDuration(
      duration: FiniteDuration,
      refreshInterval: FiniteDuration = 30.seconds
  ): ScenarioBuilder =
    scenario(s"Authenticate every ${refreshInterval.toSeconds}s using the Iceberg REST API")
      .during(duration) {
        feed(authActions.feeder())
          .exec(authActions.authenticateAndSaveAccessToken)
          .pause(refreshInterval)
      }

  /**
   * Waits for the authentication token to become available. This scenario blocks until the
   * accessToken is populated by an authentication scenario. It should be used to ensure that
   * workload scenarios don't start before authentication completes.
   *
   * @return ScenarioBuilder that waits for token availability
   */
  val waitForAuthentication: ScenarioBuilder =
    scenario("Wait for the authentication token to be available")
      .asLongAs(_ => accessToken.get() == null) {
        pause(1.second)
      }

  /**
   * Stops the continuous token refresh loop by setting the shouldRefreshToken flag to false. This
   * scenario should be executed after all workload scenarios complete to gracefully terminate the
   * authentication refresh loop.
   *
   * @return ScenarioBuilder that stops the token refresh
   */
  val stopRefreshingToken: ScenarioBuilder =
    scenario("Stop refreshing the authentication token")
      .exec { session =>
        shouldRefreshToken.set(false)
        session
      }

  /**
   * Restores the current access token from the shared reference into the Gatling session. This
   * operation is useful when a scenario needs to reuse an authentication token from a previous
   * scenario.
   *
   * @return ChainBuilder that restores the token to the session
   */
  val restoreAccessTokenInSession: ChainBuilder =
    exec(session => session.set("accessToken", accessToken.get()))

  /**
   * Grants configured privileges to the configured catalog role for each catalog. This action
   * iterates through the privileges specified in the connection parameters and grants each one
   * to the catalog role if it's not already granted.
   *
   * The catalog name should be available in the session as "catalogName".
   *
   * @return ChainBuilder that grants all configured privileges
   */
  val grantPrivileges: ChainBuilder = {
    cp.privileges.foldLeft(exec(session => session)) { (chain, privilege) =>
      chain.exec(
        http(s"Check ${cp.catalogRole} privileges")
          .get(s"/api/management/v1/catalogs/#{catalogName}/catalog-roles/${cp.catalogRole}/grants")
          .header("Authorization", "Bearer #{accessToken}")
          .header("Content-Type", "application/json")
          .check(status.in(200, 404))
          .check(status.saveAs(s"privilegeCheckStatus_$privilege"))
          .check(
            jsonPath(s"$$.grants[?(@.privilege == '$privilege')]").optional.saveAs(s"existingPrivilege_$privilege")
          )
      )
        .doIf(session => {
          val status = session(s"privilegeCheckStatus_$privilege").as[Int]
          val hasPrivilege = session.attributes.get(s"existingPrivilege_$privilege").isDefined &&
            session(s"existingPrivilege_$privilege").asOption[String].isDefined
          status == 404 || !hasPrivilege
        }) {
          exec(
            http(s"Grant $privilege to ${cp.catalogRole}")
              .put(s"/api/management/v1/catalogs/#{catalogName}/catalog-roles/${cp.catalogRole}/grants")
              .header("Authorization", "Bearer #{accessToken}")
              .header("Content-Type", "application/json")
              .body(
                StringBody(
                  s"""{
                     |  "type": "catalog",
                     |  "privilege": "$privilege"
                     |}""".stripMargin
                )
              )
              .check(status.in(200, 201))
          )
        }
    }
  }
}
