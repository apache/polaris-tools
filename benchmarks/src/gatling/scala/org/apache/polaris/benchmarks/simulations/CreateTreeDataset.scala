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
  RbacParameters,
  WorkloadParameters
}
import org.slf4j.LoggerFactory

import java.util.concurrent.atomic.AtomicInteger
import scala.concurrent.duration._

/**
 * This simulation is a 100% write workload that creates a tree dataset in Polaris. It is intended
 * to be used against an empty Polaris instance. When RBAC is enabled, it also creates principals,
 * roles, and grants alongside the dataset.
 */
class CreateTreeDataset extends Simulation {
  private val logger = LoggerFactory.getLogger(getClass)

  // --------------------------------------------------------------------------------
  // Load parameters
  // --------------------------------------------------------------------------------
  val cp: ConnectionParameters = config.connectionParameters
  val ap: AuthParameters = config.authParameters
  val dp: DatasetParameters = config.datasetParameters
  val wp: WorkloadParameters = config.workloadParameters
  val rp: RbacParameters = config.rbacParameters

  // --------------------------------------------------------------------------------
  // Helper values
  // --------------------------------------------------------------------------------
  private val numNamespaces: Int = dp.nAryTree.numberOfNodes
  private val setupActions = SetupActions(cp, ap)
  private val catalogActions = CatalogActions(dp, setupActions.accessToken, 0, Set())
  private val namespaceActions = NamespaceActions(dp, wp, setupActions.accessToken, 5, Set(500))
  private val tableActions = TableActions(dp, wp, setupActions.accessToken, 5, Set(500))
  private val viewActions = ViewActions(dp, wp, setupActions.accessToken, 5, Set(500))
  private val rbacActions = RbacActions(
    dp,
    rp,
    namespaceActions,
    tableActions,
    viewActions,
    setupActions.accessToken,
    5,
    Set(500)
  )

  private val createdPrincipals = new AtomicInteger()
  private val createdPrincipalRoles = new AtomicInteger()
  private val assignedPrincipalRoles = new AtomicInteger()
  private val createdCatalogs = new AtomicInteger()
  private val createdCatalogRoles = new AtomicInteger()
  private val assignedCatalogRoles = new AtomicInteger()
  private val createdNamespaces = new AtomicInteger()
  private val createdTables = new AtomicInteger()
  private val createdViews = new AtomicInteger()

  // --------------------------------------------------------------------------------
  // Workload: Create principals
  // --------------------------------------------------------------------------------
  val createPrincipals: ScenarioBuilder =
    scenario("Create principals")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        createdPrincipals.getAndIncrement() < rbacActions.numPrincipals && session
          .contains("accessToken")
      )(
        feed(rbacActions.principalFeeder())
          .exec(rbacActions.createPrincipal)
      )

  // --------------------------------------------------------------------------------
  // Workload: Create principal roles
  // --------------------------------------------------------------------------------
  val createPrincipalRoles: ScenarioBuilder =
    scenario("Create principal roles")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        createdPrincipalRoles.getAndIncrement() < rbacActions.numPrincipalRoles &&
          session.contains("accessToken")
      )(
        feed(rbacActions.principalRoleFeeder())
          .exec(rbacActions.createPrincipalRole)
      )

  // --------------------------------------------------------------------------------
  // Workload: Assign principal roles to principals
  // --------------------------------------------------------------------------------
  val assignPrincipalRoles: ScenarioBuilder =
    scenario("Assign principal roles to principals")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        assignedPrincipalRoles
          .getAndIncrement() < rbacActions.numPrincipalRoleAssignments && session
          .contains("accessToken")
      )(
        feed(rbacActions.principalRoleAssignmentFeeder())
          .exec(rbacActions.assignPrincipalRoleToPrincipal)
      )

  // --------------------------------------------------------------------------------
  // Workload: Create catalogs
  // --------------------------------------------------------------------------------
  val createCatalogs: ScenarioBuilder =
    scenario("Create catalogs")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        createdCatalogs.getAndIncrement() < dp.numCatalogs && session.contains("accessToken")
      )(
        feed(catalogActions.feeder())
          .exec(catalogActions.createCatalog)
      )

  // --------------------------------------------------------------------------------
  // Workload: Create catalog roles
  // --------------------------------------------------------------------------------
  val createCatalogRoles: ScenarioBuilder =
    scenario("Create catalog roles")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        createdCatalogRoles.getAndIncrement() < rbacActions.numCatalogRoles &&
          session.contains("accessToken")
      )(
        feed(rbacActions.catalogRoleFeeder())
          .exec(rbacActions.createCatalogRole)
      )

  // --------------------------------------------------------------------------------
  // Workload: Assign catalog roles to principal roles
  // --------------------------------------------------------------------------------
  val assignCatalogRoles: ScenarioBuilder =
    scenario("Assign catalog roles to principal roles")
      .exec(setupActions.restoreAccessTokenInSession)
      .asLongAs(session =>
        assignedCatalogRoles.getAndIncrement() < rbacActions.numCatalogRoleAssignments &&
          session.contains("accessToken")
      )(
        feed(rbacActions.catalogRoleAssignmentFeeder())
          .exec(rbacActions.assignCatalogRoleToPrincipalRole)
      )

  // --------------------------------------------------------------------------------
  // Workload: Create namespaces
  // --------------------------------------------------------------------------------
  val createNamespaces: ScenarioBuilder = scenario("Create namespaces using the Iceberg REST API")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      createdNamespaces.getAndIncrement() < numNamespaces && session.contains("accessToken")
    )(
      feed(namespaceActions.namespaceCreationFeeder())
        .exec(namespaceActions.createNamespace)
        .repeat(rbacActions.numGrantsPerNamespace) {
          feed(rbacActions.namespaceGrantFeeder())
            .exec(rbacActions.grantNamespacePrivilege)
        }
    )

  // --------------------------------------------------------------------------------
  // Workload: Create tables
  // --------------------------------------------------------------------------------
  val createTables: ScenarioBuilder = scenario("Create tables using the Iceberg REST API")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      createdTables.getAndIncrement() < dp.numTables && session.contains("accessToken")
    )(
      feed(tableActions.tableCreationFeeder())
        .exec(tableActions.createTable)
        .repeat(rbacActions.numGrantsPerTable) {
          feed(rbacActions.tableGrantFeeder())
            .exec(rbacActions.grantTablePrivilege)
        }
    )

  // --------------------------------------------------------------------------------
  // Workload: Create views
  // --------------------------------------------------------------------------------
  val createViews: ScenarioBuilder = scenario("Create views using the Iceberg REST API")
    .exec(setupActions.restoreAccessTokenInSession)
    .asLongAs(session =>
      createdViews.getAndIncrement() < dp.numViews && session.contains("accessToken")
    )(
      feed(viewActions.viewCreationFeeder())
        .exec(viewActions.createView)
        .repeat(rbacActions.numGrantsPerView) {
          feed(rbacActions.viewGrantFeeder())
            .exec(rbacActions.grantViewPrivilege)
        }
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

  // Build assertions separately based on whether RBAC is enabled
  // This is necessary because an assertion requires at least one query to be executed, and that may not be the case if rbac is disabled.
  private val baseAssertions = Seq(
    details("Create Namespace").successfulRequests.count.is(numNamespaces),
    details("Create Table").successfulRequests.count.is(dp.numTables),
    details("Create View").successfulRequests.count.is(dp.numViews)
  )

  private val rbacAssertions = if (rp.enableRbac) {
    Seq(
      details("Create Principal").successfulRequests.count.is(rp.numPrincipals),
      details("Create Principal Role").successfulRequests.count.is(rbacActions.numPrincipalRoles),
      details("Assign Principal Role to Principal").successfulRequests.count
        .is(rbacActions.numPrincipalRoleAssignments),
      details("Create Catalog Role").successfulRequests.count.is(rbacActions.numCatalogRoles),
      details("Assign Catalog Role to Principal Role").successfulRequests.count
        .is(rbacActions.numCatalogRoleAssignments),
      details("Grant Namespace Privilege").successfulRequests.count
        .is(rbacActions.numNamespaceGrants),
      details("Grant Table Privilege").successfulRequests.count.is(rbacActions.numTableGrants),
      details("Grant View Privilege").successfulRequests.count.is(rbacActions.numViewGrants)
    )
  } else {
    Seq.empty
  }

  setUp(
    setupActions.continuouslyRefreshOauthToken().inject(atOnceUsers(1)).protocols(httpProtocol),
    setupActions.waitForAuthentication
      .inject(atOnceUsers(1))
      .andThen(createPrincipals.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(createPrincipalRoles.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(assignPrincipalRoles.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(createCatalogs.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(createCatalogRoles.inject(atOnceUsers(1)).protocols(httpProtocol))
      .andThen(assignCatalogRoles.inject(atOnceUsers(1)).protocols(httpProtocol))
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
      .andThen(setupActions.stopRefreshingToken.inject(atOnceUsers(1)).protocols(httpProtocol))
  ).assertions(baseAssertions ++ rbacAssertions)
}
