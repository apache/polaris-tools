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
import org.apache.polaris.benchmarks.parameters.{DatasetParameters, RbacParameters}
import org.apache.polaris.benchmarks.util.Mangler

import java.util.concurrent.atomic.AtomicReference

/**
 * Actions for RBAC (Role-Based Access Control) operations in Polaris benchmarks. This class
 * provides feeders and statements for managing principals, principal roles, catalog roles, and
 * grants.
 *
 * @param dp Dataset parameters controlling the dataset generation
 * @param rp RBAC parameters controlling the RBAC setup
 * @param accessToken Reference to the authentication token for API requests
 * @param maxRetries Maximum number of retry attempts for failed operations
 * @param retryableHttpCodes HTTP status codes that should trigger a retry
 */
case class RbacActions(
    dp: DatasetParameters,
    rp: RbacParameters,
    namespaceActions: NamespaceActions,
    tableActions: TableActions,
    viewActions: ViewActions,
    accessToken: AtomicReference[String],
    maxRetries: Int = 10,
    retryableHttpCodes: Set[Int] = Set(409, 500)
) {
  private val mangler = Mangler(dp.mangleNames)

  /** Helper to return 0 if RBAC is disabled, otherwise the given value. */
  private def ifRbacEnabled(value: => Int): Int = if (rp.enableRbac) value else 0

  // --------------------------------------------------------------------------------
  // Principal Feeders
  // --------------------------------------------------------------------------------

  /**
   * Creates a Gatling Feeder that generates principal data. Each principal will be named "P_n"
   * where n is a sequential number (optionally mangled for longer names).
   *
   * @return An iterator providing principal names
   */
  def principalFeeder(): Feeder[Any] = Iterator
    .from(0)
    .map { i =>
      Map(
        "principalName" -> mangler.maybeManglePrincipal(i),
        "principalOrdinal" -> i
      )
    }
    .take(rp.numPrincipals)

  /** Number of principals to create, or 0 if RBAC is disabled. */
  val numPrincipals: Int = ifRbacEnabled(rp.numPrincipals)

  // --------------------------------------------------------------------------------
  // Principal Role Feeders
  // --------------------------------------------------------------------------------

  /**
   * Creates a Gatling Feeder that generates principal role data. Principal roles are
   * catalog-independent and include:
   *   - One "service_administrator" role
   *   - Configured roles from principalRoleNames (e.g., owner, reader, contributor)
   *
   * @return An iterator providing principal role names and metadata
   */
  def principalRoleFeeder(): Feeder[Any] = {
    // First, the service_administrator role
    val serviceAdminRole = Iterator.single(
      Map("principalRoleName" -> mangler.maybeManglePrincipalRole("service_administrator"))
    )
    // Then, the configured principal roles
    val principalRoles = rp.principalRoleNames.map { roleName =>
      Map("principalRoleName" -> mangler.maybeManglePrincipalRole(roleName))
    }
    serviceAdminRole ++ principalRoles.iterator
  }

  /** Number of principal roles to create, or 0 if RBAC is disabled. */
  val numPrincipalRoles: Int = ifRbacEnabled(1 + rp.principalRoleNames.size)

  /**
   * Creates a Gatling Feeder that generates principal-to-principal-role assignments.
   *   - P_0 gets service_administrator
   *   - P_1 through P_N get assigned to principal roles in round-robin fashion (e.g., P_1 → owner,
   *     P_2 → reader, P_3 → contributor, P_4 → owner, ...)
   *
   * @return An iterator providing principal-to-role assignment data
   */
  def principalRoleAssignmentFeeder(): Feeder[Any] = {
    // P_0 always gets service_administrator
    val serviceAdminAssignment = Iterator.single(
      Map(
        "principalName" -> mangler.maybeManglePrincipal(0),
        "principalRoleName" -> "service_administrator"
      )
    )
    // Remaining principals get assigned to principal roles round-robin
    val roleAssignments = (1 until rp.numPrincipals).map { principalOrdinal =>
      val roleName = rp.principalRoleNames((principalOrdinal - 1) % rp.principalRoleNames.size)
      Map(
        "principalName" -> mangler.maybeManglePrincipal(principalOrdinal),
        "principalRoleName" -> mangler.maybeManglePrincipalRole(roleName)
      )
    }
    serviceAdminAssignment ++ roleAssignments.iterator
  }

  /** Number of principal role assignments, or 0 if RBAC is disabled. */
  val numPrincipalRoleAssignments: Int = ifRbacEnabled(rp.numPrincipals)

  // --------------------------------------------------------------------------------
  // Catalog Role Feeders
  // --------------------------------------------------------------------------------

  /**
   * Creates a Gatling Feeder that generates catalog role data. For each catalog, creates:
   *   - The implicit "catalog_administrator" role
   *   - Configured roles from catalogRoleNames (e.g., catalog_reader, catalog_contributor)
   *
   * @return An iterator providing catalog role names and metadata
   */
  def catalogRoleFeeder(): Feeder[Any] = (0 until dp.numCatalogs).flatMap { catalogOrdinal =>
    val catalogName = s"C_$catalogOrdinal"
    allCatalogRoleNames.map { roleName =>
      Map(
        "catalogRoleName" -> mangler.maybeMangleCatalogRole(roleName, catalogName),
        "catalogName" -> catalogName,
        "catalogOrdinal" -> catalogOrdinal
      )
    }
  }.iterator

  private val allCatalogRoleNames = "catalog_administrator" +: rp.catalogRoleNames

  /** Number of catalog roles to create, or 0 if RBAC is disabled. */
  val numCatalogRoles: Int = ifRbacEnabled(dp.numCatalogs * allCatalogRoleNames.size)

  /**
   * Creates a Gatling Feeder that generates catalog-role-to-principal-role assignments. Each
   * principal role is mapped to its corresponding catalog role across ALL catalogs. E.g.
   *   - service_administrator → catalog_administrator for all catalogs
   *   - data_engineer → catalog_reader for all catalogs
   *   - data_scientist → catalog_contributor for all catalogs
   *
   * @return An iterator providing catalog-role-to-principal-role assignment data
   */
  def catalogRoleAssignmentFeeder(): Feeder[Any] = {
    // service_administrator gets all catalog_administrator roles
    val serviceAdminAssignments = (0 until dp.numCatalogs).map { catalogOrdinal =>
      val catalogName = s"C_$catalogOrdinal"
      Map(
        "principalRoleName" -> "service_administrator",
        "catalogRoleName" -> mangler.maybeMangleCatalogRole("catalog_administrator", catalogName),
        "catalogName" -> s"C_$catalogOrdinal"
      )
    }
    // Each principal role gets its corresponding catalog role across all catalogs
    val principalRoleAssignments = (0 until dp.numCatalogs).flatMap { catalogOrdinal =>
      val catalogName = s"C_$catalogOrdinal"
      rp.catalogRoleNames.zip(rp.principalRoleNames).map {
        case (catalogRoleName, principalRoleName) =>
          Map(
            "principalRoleName" -> mangler.maybeManglePrincipalRole(principalRoleName),
            "catalogRoleName" -> mangler.maybeMangleCatalogRole(catalogRoleName, catalogName),
            "catalogName" -> catalogName
          )
      }
    }
    (serviceAdminAssignments ++ principalRoleAssignments).iterator
  }

  /** Number of catalog role assignments, or 0 if RBAC is disabled. */
  val numCatalogRoleAssignments: Int =
    ifRbacEnabled(dp.numCatalogs * (rp.catalogRoleNames.size + 1))

  // --------------------------------------------------------------------------------
  // Grant Feeders
  // --------------------------------------------------------------------------------

  /**
   * Mapping of catalog role types to their namespace privileges.
   *   - catalog_administrator: NAMESPACE_FULL_METADATA
   *   - all configured roles: NAMESPACE_LIST
   */
  private val namespacePrivilegesByRole: Map[String, Seq[String]] = {
    val adminPrivilegesMap = Map("catalog_administrator" -> Seq("NAMESPACE_FULL_METADATA"))
    val othersPrivilegesMap = rp.catalogRoleNames.map(_ -> Seq("NAMESPACE_LIST")).toMap
    adminPrivilegesMap ++ othersPrivilegesMap
  }

  /**
   * Creates a grant feeder for namespace privileges. For each namespace, generates grants for all
   * catalog roles with their respective privileges.
   *
   * @return An iterator providing grant data for namespace privileges
   */
  def namespaceGrantFeeder(): Feeder[Any] =
    namespaceActions.namespaceIdentityFeeder().flatMap { ns =>
      val catalogName = ns("catalogName").asInstanceOf[String]
      allCatalogRoleNames.flatMap { roleType =>
        val catalogRoleName = mangler.maybeMangleCatalogRole(roleType, catalogName)
        val privileges = namespacePrivilegesByRole(roleType)
        privileges.map { privilege =>
          Map(
            "catalogName" -> ns("catalogName"),
            "catalogRoleName" -> catalogRoleName,
            "namespaceJsonPath" -> ns("namespaceJsonPath"),
            "privilege" -> privilege
          )
        }
      }.iterator
    }

  /** Number of grants per namespace (across all roles), or 0 if RBAC is disabled. */
  val numGrantsPerNamespace: Int =
    ifRbacEnabled(namespacePrivilegesByRole.values.map(_.size).sum)

  /** Total number of namespace grants to create, or 0 if RBAC is disabled. */
  val numNamespaceGrants: Int = ifRbacEnabled(dp.nAryTree.numberOfNodes * numGrantsPerNamespace)

  /**
   * Mapping of catalog role types to their table privileges.
   *   - catalog_administrator: TABLE_FULL_METADATA, TABLE_READ_DATA, TABLE_WRITE_DATA
   *   - all configured roles: either TABLE_LIST, TABLE_READ_DATA or TABLE_LIST, TABLE_WRITE_DATA
   */
  private val tablePrivilegesByRole: Map[String, Seq[String]] = {
    val adminPrivilegesMap = Map(
      "catalog_administrator" -> Seq("TABLE_FULL_METADATA", "TABLE_READ_DATA", "TABLE_WRITE_DATA")
    )
    val othersPrivileges =
      Seq(Seq("TABLE_LIST", "TABLE_READ_DATA"), Seq("TABLE_LIST", "TABLE_WRITE_DATA"))
    val othersPrivilegesMap = rp.catalogRoleNames.zipWithIndex.map { case (roleName, ordinal) =>
      roleName -> othersPrivileges(ordinal % othersPrivileges.size)
    }.toMap
    adminPrivilegesMap ++ othersPrivilegesMap
  }

  /**
   * Creates a grant feeder for table privileges. For each table, generates grants for all catalog
   * roles with their respective privileges.
   *
   * @return An iterator providing grant data for table privileges
   */
  def tableGrantFeeder(): Feeder[Any] = tableActions.tableIdentityFeeder().flatMap { table =>
    val catalogName = table("catalogName").asInstanceOf[String]
    val namespaceJsonPath = table("namespaceJsonPath").asInstanceOf[String]
    val tableName = table("tableName").asInstanceOf[String]
    allCatalogRoleNames.flatMap { roleType =>
      val catalogRoleName = mangler.maybeMangleCatalogRole(roleType, catalogName)
      val privileges = tablePrivilegesByRole(roleType)
      privileges.map { privilege =>
        Map(
          "catalogName" -> catalogName,
          "catalogRoleName" -> catalogRoleName,
          "namespaceJsonPath" -> namespaceJsonPath,
          "tableName" -> tableName,
          "privilege" -> privilege
        )
      }
    }.iterator
  }

  /** Number of grants per table (across all roles), or 0 if RBAC is disabled. */
  val numGrantsPerTable: Int = ifRbacEnabled(tablePrivilegesByRole.values.map(_.size).sum)

  /** Total number of table grants to create, or 0 if RBAC is disabled. */
  val numTableGrants: Int = ifRbacEnabled(dp.numTables * numGrantsPerTable)

  /**
   * Mapping of catalog role types to their view privileges.
   *   - catalog_administrator: VIEW_FULL_METADATA
   *   - all configured roles: either VIEW_LIST, VIEW_READ_PROPERTIES or VIEW_LIST,
   *     VIEW_WRITE_PROPERTIES
   */
  private val viewPrivilegesByRole: Map[String, Seq[String]] = {
    val adminPrivilegesMap = Map("catalog_administrator" -> Seq("VIEW_FULL_METADATA"))
    val othersPrivileges =
      Seq(Seq("VIEW_LIST", "VIEW_READ_PROPERTIES"), Seq("VIEW_LIST", "VIEW_WRITE_PROPERTIES"))
    val othersPrivilegesMap = rp.catalogRoleNames.zipWithIndex.map { case (roleName, ordinal) =>
      roleName -> othersPrivileges(ordinal % othersPrivileges.size)
    }.toMap
    adminPrivilegesMap ++ othersPrivilegesMap
  }

  /**
   * Creates a grant feeder for view privileges. For each view, generates grants for all catalog
   * roles with their respective privileges.
   *
   * @return An iterator providing grant data for view privileges
   */
  def viewGrantFeeder(): Feeder[Any] = viewActions.viewIdentityFeeder().flatMap { view =>
    val catalogName = view("catalogName").asInstanceOf[String]
    val namespaceJsonPath = view("namespaceJsonPath").asInstanceOf[String]
    val viewName = view("viewName").asInstanceOf[String]
    allCatalogRoleNames.flatMap { roleType =>
      val catalogRoleName = mangler.maybeMangleCatalogRole(roleType, catalogName)
      val privileges = viewPrivilegesByRole(roleType)
      privileges.map { privilege =>
        Map(
          "catalogName" -> catalogName,
          "catalogRoleName" -> catalogRoleName,
          "namespaceJsonPath" -> namespaceJsonPath,
          "viewName" -> viewName,
          "privilege" -> privilege
        )
      }
    }.iterator
  }

  /** Number of grants per view (across all roles), or 0 if RBAC is disabled. */
  val numGrantsPerView: Int = ifRbacEnabled(viewPrivilegesByRole.values.map(_.size).sum)

  /** Total number of view grants to create, or 0 if RBAC is disabled. */
  val numViewGrants: Int = ifRbacEnabled(dp.numViews * numGrantsPerView)

  // --------------------------------------------------------------------------------
  // Principal Statements
  // --------------------------------------------------------------------------------

  /**
   * Creates a new principal. The principal name is defined in the [[RbacActions.principalFeeder]].
   */
  val createPrincipal: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Create principal")(
      http("Create Principal")
        .post("/api/management/v1/principals")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "principal": {
              |    "name": "#{principalName}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )

  // --------------------------------------------------------------------------------
  // Principal Role Statements
  // --------------------------------------------------------------------------------

  /**
   * Creates a new principal role. The role name is defined in the
   * [[RbacActions.principalRoleFeeder]].
   */
  val createPrincipalRole: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Create principal role")(
      http("Create Principal Role")
        .post("/api/management/v1/principal-roles")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "principalRole": {
              |    "name": "#{principalRoleName}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )

  /**
   * Assigns a principal role to a principal. The mapping is defined in the
   * [[RbacActions.principalRoleAssignmentFeeder]].
   */
  val assignPrincipalRoleToPrincipal: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Assign principal role to principal")(
      http("Assign Principal Role to Principal")
        .put("/api/management/v1/principals/#{principalName}/principal-roles")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "principalRole": {
              |    "name": "#{principalRoleName}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )

  // --------------------------------------------------------------------------------
  // Catalog Role Statements
  // --------------------------------------------------------------------------------

  /**
   * Creates a new catalog role within a catalog. The role details are defined in the
   * [[RbacActions.catalogRoleFeeder]].
   */
  val createCatalogRole: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Create catalog role")(
      http("Create Catalog Role")
        .post("/api/management/v1/catalogs/#{catalogName}/catalog-roles")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "catalogRole": {
              |    "name": "#{catalogRoleName}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )

  /**
   * Assigns a catalog role to a principal role. The mapping is defined in the
   * [[RbacActions.catalogRoleAssignmentFeeder]].
   */
  val assignCatalogRoleToPrincipalRole: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Assign catalog role to principal role")(
      http("Assign Catalog Role to Principal Role")
        .put("/api/management/v1/principal-roles/#{principalRoleName}/catalog-roles/#{catalogName}")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "catalogRole": {
              |    "name": "#{catalogRoleName}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )

  // --------------------------------------------------------------------------------
  // Grant Statements
  // --------------------------------------------------------------------------------

  /**
   * Grants a namespace privilege to a catalog role. The grant details are defined by calling
   * [[RbacActions.namespaceGrantFeeder]] with the appropriate parameters.
   */
  val grantNamespacePrivilege: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Grant namespace privilege")(
      http("Grant Namespace Privilege")
        .put("/api/management/v1/catalogs/#{catalogName}/catalog-roles/#{catalogRoleName}/grants")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "grant": {
              |    "type": "namespace",
              |    "namespace": #{namespaceJsonPath},
              |    "privilege": "#{privilege}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )

  /**
   * Grants a table privilege to a catalog role. The grant details are defined by calling
   * [[RbacActions.tableGrantFeeder]] with the appropriate parameters.
   */
  val grantTablePrivilege: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Grant table privilege")(
      http("Grant Table Privilege")
        .put("/api/management/v1/catalogs/#{catalogName}/catalog-roles/#{catalogRoleName}/grants")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "grant": {
              |    "type": "table",
              |    "namespace": #{namespaceJsonPath},
              |    "tableName": "#{tableName}",
              |    "privilege": "#{privilege}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )

  /**
   * Grants a view privilege to a catalog role. The grant details are defined by calling
   * [[RbacActions.viewGrantFeeder]] with the appropriate parameters.
   */
  val grantViewPrivilege: ChainBuilder =
    retryOnHttpStatus(maxRetries, retryableHttpCodes, "Grant view privilege")(
      http("Grant View Privilege")
        .put("/api/management/v1/catalogs/#{catalogName}/catalog-roles/#{catalogRoleName}/grants")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "grant": {
              |    "type": "view",
              |    "namespace": #{namespaceJsonPath},
              |    "viewName": "#{viewName}",
              |    "privilege": "#{privilege}"
              |  }
              |}""".stripMargin
          )
        )
        .saveHttpStatusCode()
        .check(status.is(201))
    )
}
