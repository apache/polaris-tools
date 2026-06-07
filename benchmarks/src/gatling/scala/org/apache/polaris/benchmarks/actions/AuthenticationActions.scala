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
import io.gatling.core.feeder.Feeder
import io.gatling.core.structure.ChainBuilder
import io.gatling.http.Predef._
import org.apache.polaris.benchmarks.RetryOnHttpCodes.{
  retryOnHttpStatus,
  HttpRequestBuilderWithStatusSave
}
import org.apache.polaris.benchmarks.parameters.{AuthParameters, ConnectionParameters}
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.AtomicReference

/**
 * Actions for performance testing authentication operations. This class provides methods to
 * authenticate and manage access tokens for API requests.
 *
 * @param cp Connection parameters containing the base URL
 * @param ap Authentication parameters
 * @param accessToken Reference to the authentication token shared across actions
 */
case class AuthenticationActions(
    cp: ConnectionParameters,
    ap: AuthParameters,
    accessToken: AtomicReference[String]
) {
  private val logger = LoggerFactory.getLogger(getClass)

  /**
   * Creates a Gatling Feeder that provides authentication credentials. The feeder continuously
   * supplies client ID and client secret from the authentication parameters for use in
   * authentication requests.
   *
   * @return An iterator providing client credentials
   */
  def feeder(): Feeder[String] = Iterator.continually(
    Map(
      "clientId" -> ap.clientId,
      "clientSecret" -> ap.clientSecret
    )
  )

  /**
   * Authenticates using client credentials and saves the access token as a session attribute. The
   * credentials are defined in the [[AuthenticationActions.feeder]]. This operation performs an
   * OAuth2 client credentials flow, requesting full principal roles, and stores the received access
   * token in both the Gatling session and the shared AtomicReference.
   *
   * There is no limit to the maximum number of users that can authenticate concurrently.
   */
  val authenticateAndSaveAccessToken: ChainBuilder =
    retryOnHttpStatus(ap.maxRetries, ap.retryableHttpCodes, "Authenticate")(
      http("Authenticate")
        .post("/api/catalog/v1/oauth/tokens")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .formParam("grant_type", "client_credentials")
        .formParam("client_id", "#{clientId}")
        .formParam("client_secret", "#{clientSecret}")
        .formParam("scope", "PRINCIPAL_ROLE:ALL")
        .saveHttpStatusCode()
        .check(status.is(200))
        .check(jsonPath("$.access_token").saveAs("accessToken"))
    )
      .exec { session =>
        if (session.contains("accessToken")) {
          accessToken.set(session("accessToken").as[String])
        }
        session
      }
}
