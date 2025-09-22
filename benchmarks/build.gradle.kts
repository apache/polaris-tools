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

import org.nosphere.apache.rat.RatTask

plugins {
    scala
    id("io.gatling.gradle") version "3.13.5.2"
    id("com.diffplug.spotless") version "7.0.2"
    id("org.nosphere.apache.rat") version "0.8.1"
}

description = "Polaris Iceberg REST API performance tests"

tasks.withType<ScalaCompile> {
    scalaCompileOptions.forkOptions.apply {
        jvmArgs = listOf("-Xss100m") // Scala compiler may require a larger stack size when compiling Gatling simulations
    }
}

dependencies {
    gatling("com.typesafe.play:play-json_2.13:2.9.4")
    gatling("com.typesafe:config:1.4.3")
}

repositories {
    mavenCentral()
}

spotless {
    scala {
        // Use scalafmt for Scala formatting
        scalafmt("3.9.3").configFile(".scalafmt.conf")
        // Add license header to Scala files
        licenseHeaderFile(rootProject.file("codestyle/copyright-header-scala.txt"), "package ")
    }
}

tasks.named<RatTask>("rat").configure {
    // Gradle
    excludes.add("**/build/**")
    excludes.add("gradle/wrapper/gradle-wrapper*")
    excludes.add(".gradle")

    excludes.add("LICENSE")
    excludes.add("DISCLAIMER")
    excludes.add("NOTICE")

    // Git & GitHub
    excludes.add(".git")
    excludes.add(".github/pull_request_template.md")

    // Misc build artifacts
    excludes.add("**/.keep")
    excludes.add("logs/**")
    excludes.add("**/*.lock")

    // Configuration files that cannot have headers
    excludes.add("**/*.conf")  // Gatling and HOCON config files
    excludes.add("**/*.properties")  // Gradle wrapper properties

    // Binary files
    excludes.add("**/*.jar")
    excludes.add("**/*.zip")
    excludes.add("**/*.tar.gz")
    excludes.add("**/*.tgz")
    excludes.add("**/*.class")

    // IntelliJ
    excludes.add(".idea")
    excludes.add("**/*.iml")
    excludes.add("**/*.iws")

    // Rat can't scan binary images
    excludes.add("**/*.png")
    excludes.add("**/*.svg")
    excludes.add("**/*.puml")
}
