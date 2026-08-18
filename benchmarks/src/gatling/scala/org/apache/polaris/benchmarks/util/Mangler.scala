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
package org.apache.polaris.benchmarks.util

import java.security.MessageDigest

case class Mangler(enabled: Boolean) {
  val MD5: MessageDigest = MessageDigest.getInstance("MD5")

  def maybeMangle(s: String): String =
    if (enabled) {
      MD5.digest(s.getBytes()).map("%02x".format(_)).mkString
    } else {
      s
    }

  def maybeMangle(prefix: String, ordinal: Int): String =
    if (enabled) {
      MD5.digest((prefix + ordinal).getBytes()).map("%02x".format(_)).mkString
    } else {
      s"$prefix$ordinal"
    }

  def maybeMangleNs(ordinal: Int): String = maybeMangle("NS_", ordinal)
  def maybeMangleTable(ordinal: Int): String = maybeMangle("T_", ordinal)
  def maybeMangleView(ordinal: Int): String = maybeMangle("V_", ordinal)
  def maybeManglePrincipal(ordinal: Int): String = maybeMangle("P_", ordinal)
  def maybeManglePrincipalRole(name: String): String = maybeMangle(name)
  def maybeMangleCatalogRole(prefix: String, catalogName: String): String = maybeMangle(
    s"${prefix}_${catalogName}"
  )
}
