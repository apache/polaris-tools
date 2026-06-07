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

import java.net.URI
import org.nosphere.apache.rat.RatTask

plugins {
  `build-conventions`
  alias(libs.plugins.rat)
  alias(libs.plugins.nexus.publish.plugin)
}

spotless {
  kotlinGradle {
    // Must be repeated :( - there's no "addTarget" or so
    target("*.gradle.kts", "buildSrc/*.gradle.kts")
  }
}

tasks.named<RatTask>("rat").configure {
  // Gradle
  excludes.add("**/build/**")
  excludes.add("gradle/wrapper/gradle-wrapper*")
  excludes.add(".gradle")
  excludes.add("**/kotlin-compiler*")

  excludes.add("ide-name.txt")
  excludes.add("version.txt")

  excludes.add("**/LICENSE")
  excludes.add("**/BUNDLE-LICENSE")
  excludes.add("DISCLAIMER")
  excludes.add("**/NOTICE")
  excludes.add("**/BUNDLE-NOTICE")

  // Eclipse preference files cannot have comments
  excludes.add("**/*.prefs")

  // Git & GitHub
  excludes.add(".git")
  excludes.add(".github/pull_request_template.md")

  // Misc build artifacts
  excludes.add("**/.keep")
  excludes.add("**/logs/**")
  excludes.add("**/*.lock")
  excludes.add("**/.kotlin")

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
}

// Pass environment variables:
//    ORG_GRADLE_PROJECT_apacheUsername
//    ORG_GRADLE_PROJECT_apachePassword
// OR in ~/.gradle/gradle.properties set
//    apacheUsername
//    apachePassword
// Call targets:
//    publishToApache
//    closeApacheStagingRepository
//    releaseApacheStagingRepository
//       or closeAndReleaseApacheStagingRepository
//
// Username is your ASF ID
// Password: your ASF LDAP password - or better: a token generated via
// https://repository.apache.org/
nexusPublishing {
  transitionCheckOptions {
    // default==60 (10 minutes), wait up to 120 minutes
    maxRetries = 720
    // default 10s
    delayBetween = java.time.Duration.ofSeconds(10)
  }

  repositories {
    register("apache") {
      nexusUrl = URI.create("https://repository.apache.org/service/local/")
      snapshotRepositoryUrl =
        URI.create("https://repository.apache.org/content/repositories/snapshots/")
    }
  }
}

tasks.named<Wrapper>("wrapper") {
  actions.addLast {
    val script = scriptFile.readText()
    val scriptLines = script.lines().toMutableList()

    val insertAtLine =
      scriptLines.indexOf("# Use the maximum available, or set MAX_FD != -1 to use that value.")
    scriptLines.add(insertAtLine, "")
    scriptLines.add(insertAtLine, ". \"\${APP_HOME}/gradle/gradlew-include.sh\"")

    scriptFile.writeText(scriptLines.joinToString("\n"))
  }
}
