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
 * Case class to hold the parameters for the ReadUpdateTreeDataset simulation.
 *
 * @param readWriteRatio The ratio of read operations to write operations (0.0-1.0).
 * @param throughput The number of operations to perform per second.
 * @param durationInMinutes The duration of the simulation in minutes.
 */
case class ReadUpdateTreeDatasetParameters(
    readWriteRatio: Double,
    throughput: Int,
    durationInMinutes: Int
) {
  require(
    readWriteRatio >= 0.0 && readWriteRatio <= 1.0,
    "Read/write ratio must be between 0.0 and 1.0 inclusive"
  )
  require(throughput >= 0, "Throughput cannot be negative")
  require(durationInMinutes > 0, "Duration in minutes must be positive")

  val gatlingReadRatio: Double = readWriteRatio * 100
  val gatlingWriteRatio: Double = (1 - readWriteRatio) * 100
}
