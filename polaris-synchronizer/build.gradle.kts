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
    id("java")
    id("org.nosphere.apache.rat") version "0.8.1"
}

group = "org.apache.polaris.tools"
version = "0.1-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(platform("org.junit:junit-bom:5.10.0"))
    testImplementation("org.junit.jupiter:junit-jupiter")
}

// don't build jar in the root project
tasks.named<Jar>("jar").configure {
    enabled = false
}

tasks.test {
    useJUnitPlatform()
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