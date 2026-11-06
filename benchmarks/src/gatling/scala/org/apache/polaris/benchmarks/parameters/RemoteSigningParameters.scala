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
 * Case class to hold the parameters for the RemoteSigning simulation.
 *
 * @param signRequestsPerTableLoad The number of sign requests issued after each table load.
 * @param readWriteRatio The ratio of read sign requests to write sign requests (0.0-1.0).
 * @param loadModel How users are injected: "open" (a fixed number of users starting per second) or
 *   "closed" (a fixed number of concurrent users).
 * @param throughput With the open load model, the number of table loads to perform per second.
 * @param concurrentUsers With the closed load model, the number of concurrent users.
 * @param durationInMinutes The duration of the simulation in minutes.
 * @param defaultRegion The region to sign requests for, when the server does not return one.
 * @param principals The client credentials (client ID and secret) of the principals that load
 *   tables and sign requests, each user using one of them at random. If empty, the principal of the
 *   authentication parameters is used.
 */
case class RemoteSigningParameters(
    signRequestsPerTableLoad: Int,
    readWriteRatio: Double,
    loadModel: String,
    throughput: Int,
    concurrentUsers: Int,
    durationInMinutes: Int,
    defaultRegion: String,
    principals: Seq[(String, String)]
) {
  require(signRequestsPerTableLoad > 0, "Sign requests per table load must be positive")
  require(
    readWriteRatio >= 0.0 && readWriteRatio <= 1.0,
    "Read/write ratio must be between 0.0 and 1.0 inclusive"
  )
  require(
    loadModel == "open" || loadModel == "closed",
    "Load model must be either \"open\" or \"closed\""
  )
  require(throughput >= 0, "Throughput cannot be negative")
  require(concurrentUsers >= 0, "Concurrent users cannot be negative")
  require(durationInMinutes > 0, "Duration in minutes must be positive")

  val gatlingReadRatio: Double = readWriteRatio * 100
  val gatlingWriteRatio: Double = (1 - readWriteRatio) * 100
}
