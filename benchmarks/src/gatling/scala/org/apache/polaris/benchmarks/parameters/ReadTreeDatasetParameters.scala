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
 * Case class to hold the parameters for the ReadTreeDataset simulation.
 *
 * @param tableThroughput The number of table operations to perform per second.
 * @param viewThroughput The number of view operations to perform per second.
 */
case class ReadTreeDatasetParameters(
    tableThroughput: Int,
    viewThroughput: Int
) {
  require(tableThroughput >= 0, "Table throughput cannot be negative")
  require(viewThroughput >= 0, "View throughput cannot be negative")
}
