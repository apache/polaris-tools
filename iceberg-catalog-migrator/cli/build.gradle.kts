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
  alias(libs.plugins.nessie.run)
  `build-conventions`
}

java.sourceCompatibility = JavaVersion.VERSION_21

applyShadowJar()

dependencies {
  implementation(project(":iceberg-catalog-migrator-api"))
  implementation(libs.guava)
  implementation(libs.slf4j)
  runtimeOnly(libs.logback.classic)
  implementation(libs.picocli)
  implementation(platform(libs.iceberg.bom))
  implementation("org.apache.iceberg:iceberg-api")
  implementation("org.apache.iceberg:iceberg-core")
  implementation("org.apache.iceberg:iceberg-common")
  implementation("org.apache.iceberg:iceberg-aws")
  implementation("org.apache.iceberg:iceberg-azure")
  implementation("org.apache.iceberg:iceberg-gcp")
  implementation("org.apache.iceberg:iceberg-hive-metastore")
  implementation("org.apache.iceberg:iceberg-nessie")
  implementation("org.apache.iceberg:iceberg-dell")
  implementation(libs.hadoop.aws) { exclude(group = "software.amazon.awssdk") }

  // needed for Hive catalog
  runtimeOnly("org.apache.hive:hive-metastore:${libs.versions.hive.get()}") {
    // these are taken from iceberg repo configurations
    exclude("org.apache.avro", "avro")
    exclude("org.slf4j", "slf4j-log4j12")
    exclude("org.pentaho") // missing dependency
    exclude("org.apache.hbase")
    exclude("org.apache.logging.log4j")
    exclude("co.cask.tephra")
    exclude("com.google.code.findbugs", "jsr305")
    exclude("org.eclipse.jetty.aggregate", "jetty-all")
    exclude("org.eclipse.jetty.orbit", "javax.servlet")
    exclude("org.apache.parquet", "parquet-hadoop-bundle")
    exclude("com.tdunning", "json")
    exclude("javax.transaction", "transaction-api")
    exclude("com.zaxxer", "HikariCP")
  }
  runtimeOnly("org.apache.hive:hive-exec:${libs.versions.hive.get()}:core") {
    // these are taken from iceberg repo configurations
    exclude("org.apache.avro", "avro")
    exclude("org.slf4j", "slf4j-log4j12")
    exclude("org.pentaho") // missing dependency
    exclude("org.apache.hive", "hive-llap-tez")
    exclude("org.apache.logging.log4j")
    exclude("com.google.protobuf", "protobuf-java")
    exclude("org.apache.calcite")
    exclude("org.apache.calcite.avatica")
    exclude("org.apache.curator", "apache-curator") // this is just a pom, but referenced as a jar
    exclude("com.google.code.findbugs", "jsr305")
  }
  runtimeOnly("org.apache.hadoop:hadoop-mapreduce-client-core:${libs.versions.hadoop.get()}")

  testImplementation(platform(libs.junit.bom))
  testImplementation("org.junit.jupiter:junit-jupiter-params")
  testImplementation("org.junit.jupiter:junit-jupiter-api")
  testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
  testImplementation(libs.assertj)
  testImplementation(libs.logcaptor)

  testImplementation(project(":iceberg-catalog-migrator-api-test"))

  // for integration tests
  testImplementation(
    "org.apache.iceberg:iceberg-hive-metastore:${libs.versions.iceberg.get()}:tests"
  )
  // this junit4 dependency is needed for above Iceberg's TestHiveMetastore
  testRuntimeOnly("junit:junit:4.13.2")

  testImplementation("org.apache.hive:hive-metastore:${libs.versions.hive.get()}") {
    // these are taken from iceberg repo configurations
    exclude("org.apache.avro", "avro")
    exclude("org.slf4j", "slf4j-log4j12")
    exclude("org.pentaho") // missing dependency
    exclude("org.apache.hbase")
    exclude("org.apache.logging.log4j")
    exclude("co.cask.tephra")
    exclude("com.google.code.findbugs", "jsr305")
    exclude("org.eclipse.jetty.aggregate", "jetty-all")
    exclude("org.eclipse.jetty.orbit", "javax.servlet")
    exclude("org.apache.parquet", "parquet-hadoop-bundle")
    exclude("com.tdunning", "json")
    exclude("javax.transaction", "transaction-api")
    exclude("com.zaxxer", "HikariCP")
  }
  testImplementation("org.apache.hive:hive-exec:${libs.versions.hive.get()}:core") {
    // these are taken from iceberg repo configurations
    exclude("org.apache.avro", "avro")
    exclude("org.slf4j", "slf4j-log4j12")
    exclude("org.pentaho") // missing dependency
    exclude("org.apache.hive", "hive-llap-tez")
    exclude("org.apache.logging.log4j")
    exclude("com.google.protobuf", "protobuf-java")
    exclude("org.apache.calcite")
    exclude("org.apache.calcite.avatica")
    exclude("com.google.code.findbugs", "jsr305")
  }
  testImplementation("org.apache.hadoop:hadoop-mapreduce-client-core:${libs.versions.hadoop.get()}")

  testImplementation("org.testcontainers:testcontainers:${libs.versions.testcontainers.get()}")

  nessieQuarkusServer(
    "org.projectnessie.nessie:nessie-quarkus:${libs.versions.nessie.get()}:runner"
  )
}

nessieQuarkusApp { includeTask(tasks.named<Test>("intTest")) }

tasks.named<Test>("test") { systemProperty("expectedCLIVersion", project.version) }

val processResources =
  tasks.named<ProcessResources>("processResources") {
    inputs.property("projectVersion", project.version)
    filter(
      org.apache.tools.ant.filters.ReplaceTokens::class,
      mapOf("tokens" to mapOf("projectVersion" to project.version)),
    )
  }

val mainClassName = "org.apache.polaris.iceberg.catalog.migrator.cli.CatalogMigrationCLI"

val shadowJar =
  tasks.named<ShadowJar>("shadowJar") {
    isZip64 = true

    // Exclude non-reproducible jandex indexes
    exclude("META-INF/jandex.idx")
    exclude("**/jandex.idx")

    // Exclude dependency metadata files
    exclude("META-INF/DEPENDENCIES")
    exclude("META-INF/groovy/DISCLAIMER")

    // Exclude all LICENSE/NOTICE/DISCLAIMER files from dependencies
    exclude("META-INF/**/*LICENSE*")
    exclude("META-INF/**/*NOTICE*")
    exclude("LICENSE*")
    exclude("NOTICE*")
    exclude("DISCLAIMER")
    exclude("META-INF/DISCLAIMER")

    // Exclude build metadata to avoid duplicates
    exclude("iceberg-build.properties")
    exclude("META-INF/maven/**/pom.xml")
    exclude("META-INF/maven/**/pom.properties")
    exclude("META-INF/proguard/**")
    exclude("META-INF/README.txt")
    exclude("plugin.xml")
    exclude("about.html")
    exclude("META-INF/ASL2.0")

    // Take first occurrence for duplicates (handles version conflicts silently)
    duplicatesStrategy = org.gradle.api.file.DuplicatesStrategy.INCLUDE

    // Add customized LICENSE and NOTICE (renamed from BUNDLE-* to avoid exclusion above)
    from("${projectDir}/BUNDLE-LICENSE") {
      into("META-INF")
      rename { "LICENSE" }
      filePermissions { unix("0644") }
    }
    from("${projectDir}/BUNDLE-NOTICE") {
      into("META-INF")
      rename { "NOTICE" }
      filePermissions { unix("0644") }
    }
  }

shadowJar { manifest { attributes["Main-Class"] = mainClassName } }

tasks.withType<Test>().configureEach { systemProperty("java.security.manager", "allow") }
