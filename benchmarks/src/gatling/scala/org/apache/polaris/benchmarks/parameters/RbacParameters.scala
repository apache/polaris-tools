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
package org.apache.polaris.benchmarks.parameters

/**
 * Case class to hold the RBAC parameters for the benchmark.
 *
 * @param enableRbac Whether to enable RBAC in the CreateTreeDataset simulation.
 * @param numPrincipals The number of principals to create.
 * @param catalogRoleNames The names of the catalog roles to create per catalog. These are the roles
 *   that hold privileges on catalog objects. Note: "catalog_administrator" is created implicitly
 *   for each catalog and should not be included in this list.
 * @param principalRoleNames The names of the principal roles to create. These are the roles that
 *   can be assigned to principals and mapped to catalog roles. Note: "service_administrator" is
 *   created implicitly and mapped to "catalog_administrator" for all catalogs.
 */
case class RbacParameters(
    enableRbac: Boolean,
    numPrincipals: Int,
    catalogRoleNames: Seq[String],
    principalRoleNames: Seq[String]
) {
  require(numPrincipals > 0, "Number of principals must be positive")
  require(catalogRoleNames.nonEmpty, "At least one catalog role name must be provided")
  require(principalRoleNames.nonEmpty, "At least one principal role name must be provided")
  require(
    catalogRoleNames.size == principalRoleNames.size,
    "Number of catalog roles must match number of principal roles"
  )
}
