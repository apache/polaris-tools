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
import com.github.jengelman.gradle.plugins.shadow.transformers.DeduplicatingResourceTransformer
import com.github.jengelman.gradle.plugins.shadow.transformers.PreserveFirstFoundResourceTransformer
import com.github.jengelman.gradle.plugins.shadow.transformers.PropertiesFileTransformer
import com.github.jengelman.gradle.plugins.shadow.transformers.PropertiesFileTransformer.MergeStrategy
import kotlin.jvm.java

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
    exclude("javax.servlet", "jsp-api")
    exclude("ant", "ant")
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

    // Includes _all_ duplicates
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
    // Ideally this should be set to `true`, but we have a bunch of dependency conflicts leading to
    // duplicate classes coming from different artifacts and as a surprise via uber-jars.
    failOnDuplicateEntries = false

    // Generally, preserve META-INF/maven/*/*/pom.* files for downstream tools that
    // can analyze dependency jars.
    //
    // There are quite a few _duplicated_ occurrences of failureaccess, guava,
    // listenablefuture, error_prone_annotations, j2objc-annotations, gson.
    // Leave those here so that dependency analyzing tools can pick those up.

    exclude(
      // Exclude Jandex indexes
      "META-INF/jandex.idx",

      // Exclude all LICENSE/NOTICE/DISCLAIMER files from dependencies
      "META-INF/**/*LICENSE*",
      "META-INF/**/*NOTICE*",
      "META-INF/**/DISCLAIMER",
      "LICENSE*",
      "NOTICE*",
      "DISCLAIMER",
      "META-INF/DISCLAIMER",
      "META-INF/ASL2.0",

      // Proguard configurations used during the Guava build (don't care about those)
      "META-INF/proguard/**",
      // irrelevant for the CLI
      "META-INF/README.txt",
      "META-INF/jersey-module-version",
      // JDO stuff :shrug:
      "plugin.xml",
      "about.html",

      // From Hive/Hadoop - exclude those to not confuse people.
      "META-INF/DEPENDENCIES",
    )

    // Note: transformers do NOT handle *.class files, only relocators do.

    transform(PreserveFirstFoundResourceTransformer::class.java) {
      include("javax/**/*.dtd", "javax/**/*.xsd")
    }

    // There are a few Java service files, let "Shadow" handle those
    mergeServiceFiles()

    // Merge properties files contents
    transform(PropertiesFileTransformer::class.java) {
      mergeStrategy = MergeStrategy.Append
      paths.addAll(
        "META-INF/maven/.+/pom[.]properties",
        "org/apache/tools/ant/.+/defaults.properties",
        "javax/servlet/.+[.]properties",
        "javax/jdo/Bundle.properties",
        "META-INF/io.netty.versions.properties",
        "com/sun/jersey/json/impl/impl.properties",
        "iceberg-build.properties",
      )
    }

    // This transformer deduplicates files. It will fail with an exception, for duplicate files with
    // non-identical content.
    transform(DeduplicatingResourceTransformer::class.java) {
      exclude(
        // Known duplicates (see above)
        "META-INF/maven/com.google.guava/failureaccess/pom.xml",
        "META-INF/maven/com.google.guava/listenablefuture/pom.xml",
        "META-INF/maven/com.google.guava/guava/pom.xml",
        "META-INF/maven/com.google.errorprone/error_prone_annotations/pom.xml",
        "META-INF/maven/com.google.j2objc/j2objc-annotations/pom.xml",
        "META-INF/maven/com.google.code.gson/gson/pom.xml",
      )
    }

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
