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
import io.gatling.http.Predef._
import org.apache.polaris.benchmarks.actions._
import org.apache.polaris.benchmarks.parameters.BenchmarkConfig.config
import org.apache.polaris.benchmarks.parameters.WorkloadParameters
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.AtomicInteger

/**
 * This simulation signs S3 requests for table files in a pre-existing tree dataset. It is intended
 * to be used against a Polaris instance with a pre-existing tree dataset. It has no side effect on
 * the dataset and therefore can be executed multiple times without any issue. It signs each table
 * file exactly once.
 */
class S3SignRequest extends Simulation {
  private val logger = LoggerFactory.getLogger(getClass)

  private val cp = config.connectionParameters
  private val ap = config.authParameters
  private val dp = config.datasetParameters
  val wp: WorkloadParameters = config.workloadParameters

  private val numNamespaces: Int = dp.nAryTree.numberOfNodes
  private val setupActions = SetupActions(cp, ap)
  private val catalogActions = CatalogActions(dp, setupActions.accessToken)
  private val namespaceActions = NamespaceActions(dp, wp, setupActions.accessToken)
  private val tableActions = TableActions(dp, wp, setupActions.accessToken)
  private val s3SignActions = S3SignActions(dp, wp, setupActions.accessToken)

  private val grantedCatalogs = new AtomicInteger()
  private val verifiedPrivileges = new AtomicInteger()
  private val verifiedCatalogs = new AtomicInteger()
  private val verifiedNamespaces = new AtomicInteger()
  private val signedTables = new AtomicInteger()

  private val grantCatalogPrivileges = scenario("Grant privileges to catalog role")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      grantedCatalogs.getAndIncrement() < dp.numCatalogs && session.contains("accessToken")
    )(
      feed(catalogActions.feeder())
        .exec { session =>
          session.set("catalogRoleName", ap.catalogRole)
        }
        .foreach(ap.privileges, "privilege") {
          exec(catalogActions.grantCatalogPrivilege)
        }
    )

  private val verifyCatalogPrivileges = scenario("Verify catalog privileges are granted")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      verifiedPrivileges.getAndIncrement() < dp.numCatalogs && session.contains("accessToken")
    )(
      feed(catalogActions.feeder())
        .exec { session =>
          session.set("catalogRoleName", ap.catalogRole)
        }
        .foreach(ap.privileges, "privilege") {
          exec(catalogActions.checkCatalogPrivilegeGranted)
        }
    )

  private val verifyCatalogs = scenario("Verify catalogs using the Polaris Management REST API")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      verifiedCatalogs.getAndIncrement() < dp.numCatalogs && session.contains("accessToken")
    )(
      feed(catalogActions.feeder())
        .exec(catalogActions.fetchCatalog)
    )

  private val verifyNamespaces = scenario("Verify namespaces using the Iceberg REST API")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      verifiedNamespaces.getAndIncrement() < numNamespaces && session.contains("accessToken")
    )(
      feed(namespaceActions.namespaceFetchFeeder())
        .exec(namespaceActions.fetchAllChildrenNamespaces)
        .exec(namespaceActions.checkNamespaceExists)
        .exec(namespaceActions.fetchNamespace)
    )

  private val signTables = scenario("Sign S3 requests for table files")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      signedTables.getAndIncrement() < dp.numTables && session.contains("accessToken")
    )(
      feed(tableActions.tableFetchFeeder())
        .exec(tableActions.fetchAllTables)
        .exec(tableActions.checkTableExists)
        .exec(s3SignActions.signTableRequest)
    )

  private val httpProtocol = http
    .baseUrl(cp.baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .disableCaching

  private val tableThroughput = wp.s3SignRequest.tableThroughput

  setUp(
    setupActions.continuouslyRefreshOauthToken().inject(atOnceUsers(1)).protocols(httpProtocol),
    setupActions.waitForAuthentication
      .inject(atOnceUsers(1))
      .andThen(verifyCatalogs.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(grantCatalogPrivileges.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(verifyCatalogPrivileges.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(verifyNamespaces.inject(atOnceUsers(dp.nsDepth)).protocols(httpProtocol))
      .andThen(
        signTables.inject(atOnceUsers(tableThroughput)).protocols(httpProtocol)
      )
      .andThen(setupActions.stopRefreshingToken.inject(atOnceUsers(1)).protocols(httpProtocol))
  )
}
