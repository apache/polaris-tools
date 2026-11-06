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
import org.apache.polaris.benchmarks.parameters.RemoteSigningParameters
import play.api.libs.json.{JsObject, JsValue, Json}

import java.net.URI
import java.util.UUID

/**
 * Actions for performance testing S3 remote signing. This class provides methods to load tables
 * with remote signing access delegation, and to sign requests for objects in those tables.
 *
 * The actions behave like an Iceberg client: the remote signing properties returned by the table
 * load, if any, are sent back with every sign request. They therefore work regardless of how the
 * server authorizes sign requests.
 *
 * @param rp Remote signing parameters
 */
case class RemoteSigningActions(rp: RemoteSigningParameters) {

  /**
   * Loads a table with remote signing access delegation, and saves in the session the information
   * needed to sign requests for objects in the table: the region (`signRegion`), the URI prefix of
   * the objects (`objectUriPrefix`) and the remote signing properties (`signProperties`).
   */
  val loadTable: ChainBuilder = exec(
    http("Load Table with Remote Signing")
      .get("/api/catalog/v1/#{catalogName}/namespaces/#{multipartNamespace}/tables/#{tableName}")
      .header("Authorization", "Bearer #{accessToken}")
      .header("X-Iceberg-Access-Delegation", "remote-signing")
      .check(status.is(200))
      .check(
        bodyString
          .transform(body =>
            RemoteSigningActions.signingContext(Json.parse(body), rp.defaultRegion)
          )
          .saveAs("signingContext")
      )
  ).exec { session =>
    session("signingContext").asOption[Map[String, String]] match {
      case Some(context) => session.setAll(context).remove("signingContext")
      case None          => session
    }
  }

  /** Signs a ranged GET request for a random data file of the table. */
  val signReadRequest: ChainBuilder = signRequest(
    "Sign Read Request",
    "GET",
    """{
      |    "Range": ["bytes=0-1048575"],
      |    "x-amz-content-sha256": ["UNSIGNED-PAYLOAD"]
      |  }""".stripMargin
  )

  /** Signs a PUT request for a random data file of the table. */
  val signWriteRequest: ChainBuilder = signRequest(
    "Sign Write Request",
    "PUT",
    """{
      |    "Content-Type": ["application/octet-stream"],
      |    "Content-Length": ["1048576"],
      |    "x-amz-content-sha256": ["UNSIGNED-PAYLOAD"]
      |  }""".stripMargin
  )

  private def signRequest(name: String, method: String, headers: String): ChainBuilder =
    exec(_.set("objectName", s"${UUID.randomUUID()}.parquet"))
      .exec(
        http(name)
          .post(
            "/api/catalog/v1/#{catalogName}/namespaces/#{multipartNamespace}/tables/#{tableName}/sign"
          )
          .header("Authorization", "Bearer #{accessToken}")
          .header("Content-Type", "application/json")
          .body(
            StringBody(
              s"""{
                 |  "region": "#{signRegion}",
                 |  "uri": "#{objectUriPrefix}/data/#{objectName}",
                 |  "method": "$method",
                 |  "headers": $headers,
                 |  "properties": #{signProperties},
                 |  "provider": "s3"
                 |}""".stripMargin
            )
          )
          .check(status.is(200))
          .check(jsonPath("$.uri").exists)
      )
}

object RemoteSigningActions {

  /**
   * Extracts from a table load response the information needed to sign requests for objects in the
   * table. Object URIs use path-style or virtual-hosted-style access, and the custom S3 endpoint if
   * any, as advertised by the server.
   */
  def signingContext(response: JsValue, defaultRegion: String): Map[String, String] = {
    val config = (response \ "config").asOpt[Map[String, String]].getOrElse(Map.empty)
    val region = config.getOrElse("client.region", defaultRegion)
    val pathStyleAccess = config.get("s3.path-style-access").exists(_.toBoolean)
    val endpoint = config.get("s3.endpoint").map(URI.create)

    // s3://bucket/path/to/table -> ("bucket", "/path/to/table")
    val location = (response \ "metadata" \ "location").as[String]
    val bucketAndKey = location.substring(location.indexOf("://") + 3).stripSuffix("/")
    val (bucket, key) = bucketAndKey.indexOf('/') match {
      case -1 => (bucketAndKey, "")
      case i  => (bucketAndKey.substring(0, i), bucketAndKey.substring(i))
    }

    val objectUriPrefix = (endpoint, pathStyleAccess) match {
      case (Some(e), true)  => s"${e.toString.stripSuffix("/")}/$bucket$key"
      case (None, true)     => s"https://s3.$region.amazonaws.com/$bucket$key"
      case (Some(e), false) => s"${e.getScheme}://$bucket.${e.getRawAuthority}$key"
      case (None, false)    => s"https://$bucket.s3.$region.amazonaws.com$key"
    }

    val signProperties = (response \ "remote-signing-config" \ "properties")
      .asOpt[JsObject]
      .getOrElse(Json.obj())

    Map(
      "signRegion" -> region,
      "objectUriPrefix" -> objectUriPrefix,
      "signProperties" -> Json.stringify(signProperties)
    )
  }
}
