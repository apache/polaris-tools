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

case class WorkloadParameters(
    readWriteRatio: Double,
    updatesPerNamespace: Int,
    updatesPerTable: Int,
    updatesPerView: Int,
    seed: Long
) {
  require(
    readWriteRatio >= 0.0 && readWriteRatio <= 1.0,
    "Read/write ratio must be between 0.0 and 1.0 inclusive"
  )

  require(
    updatesPerNamespace >= 0,
    "Updates per namespace must be non-negative"
  )

  require(
    updatesPerTable >= 0,
    "Updates per table must be non-negative"
  )

  require(
    updatesPerView >= 0,
    "Updates per view must be non-negative"
  )

  val gatlingReadRatio: Double = readWriteRatio * 100
  val gatlingWriteRatio: Double = (1 - readWriteRatio) * 100
}
