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
 * Case class to hold the authentication parameters for the benchmark.
 *
 * @param clientId The client ID for authentication.
 * @param clientSecret The client secret for authentication.
 * @param refreshIntervalSeconds Refresh interval for the authentication token in seconds.
 * @param maxRetries Maximum number of retry attempts for authentication failures.
 * @param retryableHttpCodes HTTP status codes that should trigger a retry.
 */
case class AuthParameters(
    clientId: String,
    clientSecret: String,
    refreshIntervalSeconds: Int,
    maxRetries: Int,
    retryableHttpCodes: Set[Int]
) {
  require(clientId != null && clientId.nonEmpty, "Client ID cannot be null or empty")
  require(clientSecret != null && clientSecret.nonEmpty, "Client secret cannot be null or empty")
  require(refreshIntervalSeconds > 0, "Refresh interval must be positive")
  require(maxRetries >= 0, "Max retries cannot be negative")
  require(retryableHttpCodes != null, "Retryable HTTP codes cannot be null")
}
