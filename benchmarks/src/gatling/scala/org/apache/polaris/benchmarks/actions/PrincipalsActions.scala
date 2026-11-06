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
import org.apache.polaris.benchmarks.parameters.{AuthParameters, ConnectionParameters}

import java.util.concurrent.ThreadLocalRandom
import java.util.concurrent.atomic.{AtomicBoolean, AtomicReference}
import scala.concurrent.duration._

/**
 * Actions for managing the access tokens of several principals, so that requests can be spread
 * across them. This is the multi-principal counterpart of [[SetupActions]].
 *
 * @param cp Connection parameters containing the base URL
 * @param ap Authentication parameters containing the refresh interval and retry settings
 * @param principals Client ID and client secret of each principal
 */
case class PrincipalsActions(
    cp: ConnectionParameters,
    ap: AuthParameters,
    principals: Seq[(String, String)]
) {
  require(principals.nonEmpty, "At least one principal is required")

  private val accessTokens: IndexedSeq[AtomicReference[String]] =
    principals.map(_ => new AtomicReference[String]()).toIndexedSeq

  private val shouldRefreshTokens: AtomicBoolean = new AtomicBoolean(true)

  /** Authenticates each principal in turn, and stores its access token. */
  private val authenticateAll: ChainBuilder =
    principals
      .zip(accessTokens)
      .map { case ((clientId, clientSecret), accessToken) =>
        exec(_.setAll("clientId" -> clientId, "clientSecret" -> clientSecret))
          .exec(AuthenticationActions(cp, ap, accessToken).authenticateAndSaveAccessToken)
      }
      .reduce((a, b) => a.exec(b))

  /**
   * Continuously refreshes the OAuth tokens of all principals at the configured interval, until
   * [[stopRefreshingTokens]] is called. The wait between refreshes is checked every second, so that
   * the simulation ends promptly once stopped, and its duration (hence its throughput) is not
   * skewed.
   */
  def continuouslyRefreshOauthTokens(): ScenarioBuilder = {
    val interval = ap.refreshIntervalSeconds
    scenario(
      s"Authenticate ${principals.size} principal(s) every ${interval}s using the Iceberg REST API"
    )
      .asLongAs(_ => shouldRefreshTokens.get()) {
        exec(authenticateAll)
          .repeat(interval)(doIf(_ => shouldRefreshTokens.get())(pause(1.second)))
      }
  }

  /** Waits for the access tokens of all principals to be available. */
  val waitForAuthentication: ScenarioBuilder =
    scenario("Wait for the authentication tokens to be available")
      .asLongAs(_ => accessTokens.exists(_.get() == null)) {
        pause(1.second)
      }

  /** Stops the token refresh loop. */
  val stopRefreshingTokens: ScenarioBuilder =
    scenario("Stop refreshing the authentication tokens")
      .exec { session =>
        shouldRefreshTokens.set(false)
        session
      }

  /** Sets the access token of a randomly chosen principal in the Gatling session. */
  val restoreRandomAccessTokenInSession: ChainBuilder =
    exec(session =>
      session.set(
        "accessToken",
        accessTokens(ThreadLocalRandom.current().nextInt(accessTokens.size)).get()
      )
    )
}
