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

import org.apache.polaris.benchmarks.NAryTreeBuilder

/**
 * Case class to hold the dataset parameters for the benchmark.
 *
 * @param numCatalogs The number of catalogs to create.
 * @param defaultBaseLocation The default base location for the datasets.
 * @param nsWidth The width of the namespace n-ary tree.
 * @param nsDepth The depth of the namespace n-ary tree.
 * @param numNamespaceProperties The number of namespace properties to create.
 * @param numTablesPerNs The number of tables per namespace to create.
 * @param numTablesMax The maximum number of tables to create. If set to -1, all tables are created.
 * @param numColumnsPerTable The number of columns per table to create.
 * @param numTableProperties The number of table properties to create.
 * @param numViewsPerNs The number of views per namespace to create.
 * @param numViewsMax The maximum number of views to create. If set to -1, all views are created.
 * @param numColumnsPerView The number of columns per view to create.
 * @param numViewProperties The number of view properties to create.
 * @param storageConfigInfo The JSON to supply when creating a new StorageConfigInfo for a catalog.
 */
case class DatasetParameters(
    numCatalogs: Int,
    defaultBaseLocation: String,
    nsWidth: Int,
    nsDepth: Int,
    numNamespaceProperties: Int,
    numTablesPerNs: Int,
    numTablesMax: Int,
    numColumnsPerTable: Int,
    numTableProperties: Int,
    numViewsPerNs: Int,
    numViewsMax: Int,
    numColumnsPerView: Int,
    numViewProperties: Int,
    storageConfigInfo: String
) {
  val nAryTree: NAryTreeBuilder = NAryTreeBuilder(nsWidth, nsDepth)
  val maxPossibleTables: Int = nAryTree.numberOfLastLevelElements * numTablesPerNs
  private val maxPossibleViews = nAryTree.numberOfLastLevelElements * numViewsPerNs
  val numTables: Int = if (numTablesMax <= 0) maxPossibleTables else numTablesMax
  val numViews: Int = if (numViewsMax <= 0) maxPossibleViews else numViewsMax

  require(numCatalogs > 0, "Number of catalogs must be positive")
  require(defaultBaseLocation.nonEmpty, "Base location cannot be empty")
  require(nsWidth > 0, "Namespace width must be positive")
  require(nsDepth > 0, "Namespace depth must be positive")
  require(numNamespaceProperties >= 0, "Number of namespace properties cannot be negative")
  require(numTablesPerNs >= 0, "Number of tables per namespace cannot be negative")
  require(numColumnsPerTable > 0, "Number of columns per table must be positive")
  require(numTableProperties >= 0, "Number of table properties cannot be negative")
  require(numViewsPerNs >= 0, "Number of views per namespace cannot be negative")
  require(numColumnsPerView > 0, "Number of columns per view must be positive")
  require(numViewProperties >= 0, "Number of view properties cannot be negative")
  require(
    numTablesMax == -1 || numTablesMax <= maxPossibleTables,
    s"Maximum number of tables ($numTablesMax) cannot exceed computed total ($maxPossibleTables)"
  )
  require(
    numViewsMax == -1 || numViewsMax <= maxPossibleViews,
    s"Maximum number of views ($numViewsMax) cannot exceed computed total ($maxPossibleViews)"
  )
}
