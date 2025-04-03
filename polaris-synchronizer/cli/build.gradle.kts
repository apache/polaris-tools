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

import com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar

plugins {
  `java-library`
  `maven-publish`
  signing
  `build-conventions`
}

applyShadowJar()

dependencies {
  implementation(project(":polaris-synchronizer-api"))

  implementation(libs.picocli)
  implementation(libs.slf4j)
  implementation(libs.iceberg.spark.runtime)
  implementation(libs.apache.commons.csv)
  runtimeOnly(libs.logback.classic)

  testImplementation(platform(libs.junit.bom))
  testImplementation("org.junit.jupiter:junit-jupiter-params")
  testImplementation("org.junit.jupiter:junit-jupiter-api")
  testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

val mainClassName = "org.apache.polaris.tools.sync.polaris.PolarisSynchronizerCLI"

val shadowJar = tasks.named<ShadowJar>("shadowJar") { isZip64 = true }

shadowJar { manifest { attributes["Main-Class"] = mainClassName } }
