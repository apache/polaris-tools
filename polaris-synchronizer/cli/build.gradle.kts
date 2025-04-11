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
  id("com.github.johnrengelman.shadow") version "8.1.1"
}

repositories {
  mavenCentral()
}

dependencies {
  implementation(project(":polaris-synchronizer-api"))

  implementation("info.picocli:picocli:4.7.6")
  implementation("org.slf4j:log4j-over-slf4j:2.0.17")
  implementation("org.apache.iceberg:iceberg-spark-runtime-3.3_2.12:1.7.1")
  implementation("org.apache.commons:commons-csv:1.13.0")
  runtimeOnly("ch.qos.logback:logback-classic:1.5.17")

  testImplementation("org.junit.jupiter:junit-jupiter-params:5.10.0")
  testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.0")
  testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.10.0")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.10.0")
}

tasks.withType<Test>().configureEach { useJUnitPlatform() }

val mainClassName = "org.apache.polaris.tools.sync.polaris.PolarisSynchronizerCLI"

tasks.named<ShadowJar>("shadowJar") {
  manifest {
    attributes["Main-Class"] = mainClassName
  }
  outputs.cacheIf { false }
  archiveClassifier.set("") // no `-all`
  archiveVersion.set("")    // optional
  isZip64 = true
}

tasks.named("build") {
  dependsOn("shadowJar")
}

// Optionally disable raw JAR
tasks.named<Jar>("jar") {
  enabled = false
}
