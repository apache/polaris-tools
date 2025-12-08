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

import java.io.OutputStream

plugins {
  // Order of java-gradle-plugin + polaris-apprunner-java matters!
  `java-gradle-plugin`
  id("polaris-apprunner-java")
}

dependencies {
  compileOnly(libs.jakarta.annotation.api)
  implementation(project(":polaris-apprunner-common"))
}

gradlePlugin {
  plugins {
    register("polaris-apprunner") {
      // This ID becomes the Maven group ID of the Gradle plugin marker artifact.
      // The artifact ID of the Gradle plugin marker artifact is ID + ".gradle.plugin"
      // (the defined plugin marker suffix).
      id = project.group.toString()
      implementationClass = "org.apache.polaris.apprunner.plugin.PolarisRunnerPlugin"
      displayName = "Polaris Runner"
      description = "Start and stop a Polaris server for integration testing"
      tags.addAll("test", "integration", "quarkus", "polaris")
    }
  }
  website.set("https://polaris.apache.org")
  vcsUrl.set("https://github.com/apache/polaris")
}

tasks.named<Test>("test") {
  systemProperty("polaris-version", version)
  systemProperty("junit-version", libs.junit.bom.get().version.toString())
}

// Test to ensure that the plugin works from a local Maven repository publication.
val smokeTest by
  tasks.registering(Exec::class) {
    // GenerateMavenPom + publishing tasks are not cacheable, so we cannot this task at all.

    // polaris-apprunner parent pom
    dependsOn(":publishToMavenLocal")
    // polaris-apprunner-common pom + jar
    dependsOn(":polaris-apprunner-common:publishToMavenLocal")
    // polaris-apprunner-gradle-plugin pom + jar
    dependsOn("publishToMavenLocal")

    workingDir = projectDir.resolve("src/smoketest")
    // Listing the tasks is enough to "configure everything",
    // including the apprunner plugin configuration code.
    commandLine("./gradlew", "tasks", "--all", "--stacktrace")

    val logFile = layout.buildDirectory.file("reports/smoketest/smoketest.log")

    isIgnoreExitValue = true

    var outStream: OutputStream? = null
    doFirst {
      workingDir.resolve("gradle.properties").writeText("apprunnerVersion=$version\n")

      logFile.get().asFile.parentFile.mkdirs()
      outStream = logFile.get().asFile.outputStream()
      standardOutput = outStream
      errorOutput = outStream
    }

    doLast {
      outStream?.close()

      if (executionResult.get().exitValue != 0) {
        throw GradleException(
          """
                |Gradle plugin smoke test failed
                |
                |${logFile.get().asFile.readText()}
                """
            .trimMargin()
        )
      }
    }
  }

tasks.named("check") { dependsOn(smokeTest) }
