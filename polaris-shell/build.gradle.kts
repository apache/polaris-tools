
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
    id("java")
    alias(libs.plugins.shadow)
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

// Isolated configuration: ANTLR 4 tool jar, does not leak into compile/runtime
val antlrTool: Configuration by configurations.creating

val antlrOutputDir = layout.buildDirectory.dir("generated/antlr/main")
val antlrPackageDir = layout.buildDirectory.dir("generated/antlr/main/org/apache/polaris/tools/grammar")
val grammarFile    = file("src/main/antlr/IcebergSQL.g4")

val generateGrammarSource by tasks.registering(JavaExec::class) {
    description = "Generate Java sources from IcebergSQL.g4 using ANTLR 4"
    group       = "build"

    classpath  = antlrTool
    mainClass  = "org.antlr.v4.Tool"

    doFirst { antlrPackageDir.get().asFile.mkdirs() }

    args = listOf(
        "-visitor",
        "-no-listener",
        "-package", "org.apache.polaris.tools.grammar",
        "-o", antlrPackageDir.get().asFile.absolutePath,  // output into full package path
        grammarFile.absolutePath
    )

    inputs.file(grammarFile)
    outputs.dir(antlrOutputDir)  // declare root as output for incremental build tracking
}

sourceSets {
    main {
        java { srcDir(antlrOutputDir) }  // root — Java compiler walks subdirs automatically
    }
}

tasks.named<JavaCompile>("compileJava") {
    dependsOn(generateGrammarSource)
}

dependencies {
    antlrTool(libs.antlr4)                      // ANTLR 4 tool — code-gen only, not shipped
    implementation(libs.antlr4.engine.runtime)  // ANTLR 4 runtime — shipped in our jar

    implementation(platform(libs.iceberg.bom))
    implementation("org.apache.iceberg:iceberg-api")
    implementation("org.apache.iceberg:iceberg-core")
    implementation("org.apache.iceberg:iceberg-data")
    implementation("org.apache.iceberg:iceberg-parquet")
    implementation("org.apache.iceberg:iceberg-aws")
    implementation("org.apache.parquet:parquet-column:1.16.0")
    // iceberg-aws declares ALL AWS SDK deps as compileOnly — none appear in its
    // published metadata, so every module it references must be added explicitly
    // here to be bundled in the shadow jar.
    runtimeOnly(libs.awssdk.s3)
    runtimeOnly(libs.awssdk.sts)
    runtimeOnly(libs.awssdk.kms)
    runtimeOnly(libs.awssdk.dynamodb)
    runtimeOnly(libs.awssdk.glue)
    runtimeOnly(libs.awssdk.lakeformation)
    runtimeOnly(libs.awssdk.url.connection.client)

    implementation(libs.guava)
    implementation(libs.slf4j.api)
    runtimeOnly("org.slf4j:slf4j-simple:${libs.versions.slf4j.get()}")

    implementation(libs.hadoop.common)
    implementation(libs.hadoop.client.runtime)

    // ── Test dependencies ──────────────────────────────────────────────────────
    testImplementation(platform(libs.junit.bom))
    testImplementation("org.junit.jupiter:junit-jupiter-api")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    testImplementation(libs.assertj)
    testImplementation(libs.mockito.junit.jupiter)

    testImplementation(platform(libs.testcontainers.bom))
    testImplementation("org.testcontainers:testcontainers")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    // Provides org.apache.polaris.test.minio.MinioContainer
    testImplementation("org.apache.polaris:polaris-minio-testcontainer:1.4.1")
}

tasks.named<Test>("test") {
    useJUnitPlatform()
    // Integration tests require Docker + running Polaris/MinIO containers;
    // exclude them from the default test task so normal builds succeed.
    exclude("**/*IntegrationTest*")
}

tasks.register<Test>("integrationTest") {
    description = "Runs integration tests that require Docker (Polaris + MinIO)."
    group = "verification"
    useJUnitPlatform()
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    include("**/*IntegrationTest*")
}

// ── Demo fat jar ──────────────────────────────────────────────────────────────
tasks.named<ShadowJar>("shadowJar") {
    archiveClassifier.set("demo")
    mergeServiceFiles()
    isZip64 = true
    manifest {
        attributes("Main-Class" to "org.apache.polaris.tools.cli.PolarisShell")
    }
    // Exclude SLF4J 1.7.x bindings that leak in from Hadoop transitive deps;
    // we ship slf4j-simple 2.x as the provider instead.
    exclude("org/slf4j/impl/StaticLoggerBinder.class")
    exclude("org/slf4j/impl/StaticMDCBinder.class")
    exclude("org/slf4j/impl/StaticMarkerBinder.class")
}