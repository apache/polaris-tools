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
 * Case class to hold the parameters for the CreateCommits simulation.
 *
 * @param tableCommitsThroughput The number of table commits to create per second.
 * @param viewCommitsThroughput The number of view commits to create per second.
 * @param durationInMinutes The duration of the simulation in minutes.
 */
case class CreateCommitsParameters(
    tableCommitsThroughput: Int,
    viewCommitsThroughput: Int,
    durationInMinutes: Int
) {
  require(tableCommitsThroughput >= 0, "Table commits throughput cannot be negative")
  require(viewCommitsThroughput >= 0, "View commits throughput cannot be negative")
  require(durationInMinutes > 0, "Duration in minutes must be positive")
}
