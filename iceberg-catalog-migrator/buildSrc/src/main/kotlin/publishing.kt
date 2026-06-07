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
import org.gradle.api.Project
import org.gradle.api.publish.PublishingExtension
import org.gradle.api.publish.maven.MavenPublication
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.create
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withType
import org.gradle.plugins.signing.SigningExtension
import org.gradle.plugins.signing.SigningPlugin

fun Project.configurePublishing() {
  // Skip publishing for the root project
  if (project == rootProject) {
    return
  }

  apply(plugin = "maven-publish")
  apply<SigningPlugin>()

  val isSigningEnabled = project.hasProperty("release") || project.hasProperty("signArtifacts")

  afterEvaluate {
    configure<PublishingExtension> {
      publications {
        create<MavenPublication>("maven") {
          val hasShadowJar = tasks.findByName("shadowJar") != null

          if (hasShadowJar) {
            // Publish shadow JAR instead of regular JAR
            // Note: applyShadowJar() already sets archiveClassifier to ""
            tasks.withType<ShadowJar>().configureEach { artifact(this) }
          } else {
            // Only add java component if shadow JAR doesn't exist
            pluginManager.withPlugin("java") { from(components["java"]) }
          }

          groupId = project.group.toString()
          artifactId = project.name
          version = project.version.toString()

          pom {
            name.set("Apache Polaris Tools - Iceberg Catalog Migrator")
            description.set("Iceberg Catalog Migrator from Apache Polaris Tools")
            url.set("https://polaris.apache.org/")
            inceptionYear.set("2024")

            licenses {
              license {
                name.set("Apache-2.0") // SPDX identifier
                url.set("https://www.apache.org/licenses/LICENSE-2.0.txt")
              }
            }

            mailingLists {
              mailingList {
                name.set("Dev Mailing List")
                post.set("dev@polaris.apache.org")
                subscribe.set("dev-subscribe@polaris.apache.org")
                unsubscribe.set("dev-unsubscribe@polaris.apache.org")
              }
            }

            issueManagement {
              system.set("Github")
              url.set("https://github.com/apache/polaris-tools/issues")
            }

            scm {
              connection.set("scm:git:https://github.com/apache/polaris-tools.git")
              developerConnection.set("scm:git:https://github.com/apache/polaris-tools.git")
              url.set("https://github.com/apache/polaris-tools")
            }
          }
        }
      }
    }

    // Configure signing following Apache Polaris pattern
    if (isSigningEnabled) {
      configure<SigningExtension> {
        val signingKey = project.findProperty("signingKey") as String?
        val signingPassword = project.findProperty("signingPassword") as String?
        useInMemoryPgpKeys(signingKey, signingPassword)

        val publishing = the<PublishingExtension>()
        sign(publishing.publications["maven"])

        // Support gpg-agent if useGpgAgent property is set
        if (project.hasProperty("useGpgAgent")) {
          useGpgCmd()
        }
      }
    }
  }
}
