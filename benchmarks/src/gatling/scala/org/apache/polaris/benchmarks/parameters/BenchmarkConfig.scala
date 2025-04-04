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

import com.typesafe.config.{Config, ConfigFactory}

object BenchmarkConfig {
  val config: BenchmarkConfig = apply()

  def apply(): BenchmarkConfig = {
    val config: Config = ConfigFactory.load().withFallback(ConfigFactory.load("benchmark-defaults"))

    val http: Config = config.getConfig("http")
    val auth: Config = config.getConfig("auth")
    val dataset: Config = config.getConfig("dataset.tree")
    val workload: Config = config.getConfig("workload")

    val connectionParams = ConnectionParameters(
      auth.getString("client-id"),
      auth.getString("client-secret"),
      http.getString("base-url")
    )

    val workloadParams = {
      val rtdConfig = workload.getConfig("read-tree-dataset")
      val ctdConfig = workload.getConfig("create-tree-dataset")
      val rutdConfig = workload.getConfig("read-update-tree-dataset")

      WorkloadParameters(
        workload.getInt("updates-per-namespace"),
        workload.getInt("updates-per-table"),
        workload.getInt("updates-per-view"),
        workload.getLong("seed"),
        ReadTreeDatasetParameters(
          rtdConfig.getInt("table-throughput"),
          rtdConfig.getInt("view-throughput")
        ),
        CreateTreeDatasetParameters(
          ctdConfig.getInt("table-throughput"),
          ctdConfig.getInt("view-throughput")
        ),
        ReadUpdateTreeDatasetParameters(
          rutdConfig.getDouble("read-write-ratio"),
          rutdConfig.getInt("throughput"),
          rutdConfig.getInt("duration-in-minutes")
        )
      )
    }

    val datasetParams = DatasetParameters(
      dataset.getInt("num-catalogs"),
      dataset.getString("default-base-location"),
      dataset.getInt("namespace-width"),
      dataset.getInt("namespace-depth"),
      dataset.getInt("namespace-properties"),
      dataset.getInt("tables-per-namespace"),
      dataset.getInt("max-tables"),
      dataset.getInt("columns-per-table"),
      dataset.getInt("table-properties"),
      dataset.getInt("views-per-namespace"),
      dataset.getInt("max-views"),
      dataset.getInt("columns-per-view"),
      dataset.getInt("view-properties")
    )

    BenchmarkConfig(connectionParams, workloadParams, datasetParams)
  }
}

case class BenchmarkConfig(
    connectionParameters: ConnectionParameters,
    workloadParameters: WorkloadParameters,
    datasetParameters: DatasetParameters
) {}
