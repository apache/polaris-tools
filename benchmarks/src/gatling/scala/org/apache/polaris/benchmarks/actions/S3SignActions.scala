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
import io.gatling.core.structure.ChainBuilder
import io.gatling.http.Predef._
import org.apache.polaris.benchmarks.parameters.{DatasetParameters, WorkloadParameters}
import org.slf4j.LoggerFactory
import play.api.libs.json.Json

import java.util.concurrent.atomic.AtomicReference

/**
 * Actions for performance testing S3 sign requests. This class provides methods to sign S3 requests
 * for table files.
 *
 * @param dp Dataset parameters controlling the dataset generation
 * @param wp Workload parameters controlling the workload configuration
 * @param accessToken Reference to the authentication token shared across actions
 */
case class S3SignActions(
    dp: DatasetParameters,
    wp: WorkloadParameters,
    accessToken: AtomicReference[String]
) {
  private val logger = LoggerFactory.getLogger(getClass)

  private val region: String =
    try {
      val json = Json.parse(dp.storageConfigInfo)
      (json \ "region").asOpt[String].getOrElse("us-east-1")
    } catch {
      case _: Exception => "us-east-1"
    }

  private val bucketName: String = dp.defaultBaseLocation.stripPrefix("s3://").split("/")(0)
  private val basePath: String = dp.defaultBaseLocation.stripPrefix(s"s3://$bucketName/")
  private val s3Domain: String = s"s3.$region.amazonaws.com"

  /**
   * Sends a request to sign an S3 request for a table file.
   */
  val signTableRequest: ChainBuilder = exec { session =>
    val catalogName = session("catalogName").as[String]
    val parentNamespacePath = session("parentNamespacePath").as[Seq[String]]
    val tableName = session("tableName").as[String]
    val namespacePath = parentNamespacePath.mkString("/")
    val fileUri =
      s"https://$bucketName.$s3Domain/$basePath/$catalogName/$namespacePath/$tableName/metadata/00000-example.metadata.json"

    session
      .set("region", region)
      .set("method", "GET")
      .set("uri", fileUri)
  }
    .exec { session =>
      val uri = session("uri").as[String]
      logger.info(s"Signing S3 request for $uri")
      session
    }
    .exec(
      http("Sign S3 Request")
        .post("/api/s3-sign/v1/#{catalogName}/namespaces/#{multipartNamespace}/tables/#{tableName}")
        .header("Authorization", "Bearer #{accessToken}")
        .header("Content-Type", "application/json")
        .body(
          StringBody(
            """{
              |  "region": "#{region}",
              |  "method": "#{method}",
              |  "uri": "#{uri}",
              |  "headers": {}
              |}""".stripMargin
          )
        )
        .check(status.is(200))
        .check(jsonPath("$.uri").exists)
        .check(jsonPath("$.headers").exists)
    )
}
