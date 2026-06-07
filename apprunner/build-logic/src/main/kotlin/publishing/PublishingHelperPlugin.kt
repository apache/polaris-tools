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

package publishing

import com.github.jengelman.gradle.plugins.shadow.ShadowPlugin
import javax.inject.Inject
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.component.AdhocComponentWithVariants
import org.gradle.api.component.SoftwareComponentFactory
import org.gradle.api.publish.PublishingExtension
import org.gradle.api.publish.maven.MavenPublication
import org.gradle.api.publish.maven.plugins.MavenPublishPlugin
import org.gradle.api.publish.maven.tasks.GenerateMavenPom
import org.gradle.api.publish.tasks.GenerateModuleMetadata
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.javadoc.Javadoc
import org.gradle.jvm.tasks.Jar
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.getValue
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.provideDelegate
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withType
import org.gradle.plugins.signing.SigningExtension
import org.gradle.plugins.signing.SigningPlugin

/**
 * Release-publishing helper plugin to generate publications that pass Sonatype validations,
 * generate Apache release source tarball.
 *
 * The `release` Gradle project property triggers: signed artifacts and jars with Git information.
 * The current Git HEAD must point to a Git tag.
 *
 * The `jarWithGitInfo` Gradle project property triggers: jars with Git information (not necessary
 * with `release`).
 *
 * The task `sourceTarball` (available on the root project) generates a source tarball using `git
 * archive`.
 *
 * The task `releaseEmailTemplate` generates the release-vote email subject + body. Outputs on the
 * console and in the `build/distributions/` directory.
 *
 * Signing tip: If you want to use `gpg-agent`, set the `useGpgAgent` Gradle project property
 *
 * The following command publishes the project artifacts to your local maven repository, generates
 * the source tarball - and uses `gpg-agent` to sign all artifacts and the tarball. Note that this
 * requires a Git tag!
 *
 * ```
 * ./gradlew publishToMavenLocal sourceTarball -Prelease -PuseGpgAgent
 * ```
 *
 * You can generate signed artifacts when using the `signArtifacts` project property:
 * ```
 * ./gradlew publishToMavenLocal sourceTarball -PsignArtifacts -PuseGpgAgent
 * ```
 */
@Suppress("unused")
class PublishingHelperPlugin
@Inject
constructor(private val softwareComponentFactory: SoftwareComponentFactory) : Plugin<Project> {
  override fun apply(project: Project): Unit =
    project.run {
      extensions.create("publishingHelper", PublishingHelperExtension::class.java)

      tasks.withType<Jar>().configureEach {
        manifest { MemoizedJarInfo.applyJarManifestAttributes(rootProject, attributes) }
      }

      apply(plugin = "maven-publish")

      // The Gradle plugin-plugin adds another publication for the Gradle plugin marker artifact,
      // which is needed to resolve Gradle plugins by their ID. It uses the name `pluginMaven` for
      // the "main" `MavenPublication`, but that publication is created _after_ this code runs,
      // if it does not already exist.
      // The Maven plugin-plugin uses the name `mavenJava` for the "main" `MavenPublication`, which
      // is created _before_ this code runs.
      val hasGradlePlugin = plugins.hasPlugin("java-gradle-plugin")
      val hasMavenPlugin = plugins.hasPlugin("io.freefair.maven-plugin")
      val publicationName =
        if (hasGradlePlugin) "pluginMaven" else if (hasMavenPlugin) "mavenJava" else "maven"

      if (isSigningEnabled()) {
        apply(plugin = "signing")
        plugins.withType<SigningPlugin>().configureEach {
          configure<SigningExtension> {
            val signingKey: String? by project
            val signingPassword: String? by project
            useInMemoryPgpKeys(signingKey, signingPassword)
            val publishing = project.extensions.getByType(PublishingExtension::class.java)
            afterEvaluate { publishing.publications.forEach { publication -> sign(publication) } }

            if (project.hasProperty("useGpgAgent")) {
              useGpgCmd()
            }
          }
        }
      }

      // Gradle complains when a Gradle module metadata ("pom on steroids") is generated with an
      // enforcedPlatform() dependency - but Quarkus requires enforcedPlatform(), so we have to
      // allow it.
      tasks.withType<GenerateModuleMetadata>().configureEach {
        suppressedValidationErrors.add("enforced-platform")
      }

      plugins.withType<MavenPublishPlugin>().configureEach {
        configure<PublishingExtension> {
          publications {
            // The maven plugin-plugin has already registered the 'mavenJava' publication.
            if (!hasMavenPlugin) {
              register<MavenPublication>(publicationName)
            }
            named<MavenPublication>(publicationName) {
              val mavenPublication = this
              afterEvaluate {
                // This MUST happen in an 'afterEvaluate' to ensure that the Shadow*Plugin has
                // been applied.
                if (project.plugins.hasPlugin(ShadowPlugin::class.java)) {
                  configureShadowPublishing(project, mavenPublication, softwareComponentFactory)
                } else {
                  val component =
                    components.firstOrNull { c -> c.name == "javaPlatform" || c.name == "java" }
                  if (component is AdhocComponentWithVariants) {
                    listOf("testFixturesApiElements", "testFixturesRuntimeElements").forEach { cfg
                      ->
                      configurations.findByName(cfg)?.apply {
                        component.addVariantsFromConfiguration(this) { skip() }
                      }
                    }
                  }
                  // The Gradle and Maven plugin-plugins unconditionally add the 'java' component.
                  // It's illegal to have more than one `SoftwareComponent` in a publication,
                  // even if it is the same.
                  if (!hasGradlePlugin && !hasMavenPlugin) {
                    from(component)
                  }
                }

                suppressPomMetadataWarningsFor("testFixturesApiElements")
                suppressPomMetadataWarningsFor("testFixturesRuntimeElements")
              }

              if (
                plugins.hasPlugin("java-test-fixtures") &&
                  project.layout.projectDirectory.dir("src/testFixtures").asFile.exists()
              ) {
                val testFixturesSourcesJar by
                  tasks.registering(org.gradle.api.tasks.bundling.Jar::class) {
                    val sourceSets: SourceSetContainer by project
                    from(sourceSets.named("testFixtures").get().allSource)
                    archiveClassifier.set("test-fixtures-sources")
                  }
                tasks.named<Javadoc>("testFixturesJavadoc") { isFailOnError = false }
                val testFixturesJavadocJar by
                  tasks.registering(org.gradle.api.tasks.bundling.Jar::class) {
                    from(tasks.named("testFixturesJavadoc"))
                    archiveClassifier.set("test-fixtures-javadoc")
                  }

                artifact(testFixturesSourcesJar)
                artifact(testFixturesJavadocJar)
              }

              // Have to configure all pom's (needed for the Gradle plugin-plugin)
              tasks.withType(GenerateMavenPom::class.java).configureEach {
                configurePom(project, this)
              }
            }
          }
        }
      }

      addAdditionalJarContent(this, publicationName)
    }
}
