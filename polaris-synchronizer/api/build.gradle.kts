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

plugins {
  `java-library`
  `maven-publish`
  signing
  id("org.openapi.generator") version "7.11.0"
}

repositories {
  mavenCentral()
}

java {
  toolchain {
    languageVersion.set(JavaLanguageVersion.of(21)) // Set the compilation JDK to 21
  }
}

dependencies {
  // implementation(libs.openapi.generator)
  implementation("jakarta.annotation:jakarta.annotation-api:2.1.1")
  implementation("org.apache.iceberg:iceberg-spark-runtime-3.3_2.12:1.7.1")
  implementation("com.fasterxml.jackson.core:jackson-databind:2.18.3")
  implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.18.3")
  implementation("org.slf4j:log4j-over-slf4j:2.0.17")

  implementation("org.apache.hadoop:hadoop-common:2.7.3") {
    exclude("org.apache.avro", "avro")
    exclude("org.slf4j", "slf4j-log4j12")
    exclude("javax.servlet", "servlet-api")
    exclude("com.google.code.gson", "gson")
    exclude("commons-beanutils")
  }

  testImplementation("org.junit.jupiter:junit-jupiter-params:5.10.0")
  testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.0")
  testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.10.0")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.10.0")
}

tasks.withType<Test>().configureEach { useJUnitPlatform() }

tasks.register<org.openapitools.generator.gradle.plugin.tasks.GenerateTask>(
  "generatePolarisManagementClient"
) {
  inputSpec.set("$projectDir/src/main/resources/polaris-management-service.yml")
  generatorName.set("java")
  outputDir.set("${layout.buildDirectory.get()}/generated")
  apiPackage.set("org.apache.polaris.management.client")
  modelPackage.set("org.apache.polaris.core.admin.model")
  removeOperationIdPrefix.set(true)

  globalProperties.set(
    mapOf(
      "apis" to "",
      "models" to "",
      "supportingFiles" to "",
      "apiDocs" to "false",
      "modelTests" to "false",
    )
  )

  additionalProperties.set(
    mapOf(
      "apiNamePrefix" to "PolarisManagement",
      "apiNameSuffix" to "Api",
      "metricsPrefix" to "polaris.management",
    )
  )

  configOptions.set(
    mapOf(
      "library" to "native",
      "sourceFolder" to "src/main/java",
      "useJakartaEe" to "true",
      "useBeanValidation" to "false",
      "openApiNullable" to "false",
      "useRuntimeException" to "true",
      "supportUrlQuery" to "false",
    )
  )

  importMappings.set(
    mapOf(
      "AbstractOpenApiSchema" to "org.apache.polaris.core.admin.model.AbstractOpenApiSchema",
      "AddGrantRequest" to "org.apache.polaris.core.admin.model.AddGrantRequest",
      "AwsStorageConfigInfo" to "org.apache.polaris.core.admin.model.AwsStorageConfigInfo",
      "AzureStorageConfigInfo" to "org.apache.polaris.core.admin.model.AzureStorageConfigInfo",
      "Catalog" to "org.apache.polaris.core.admin.model.Catalog",
      "CatalogGrant" to "org.apache.polaris.core.admin.model.CatalogGrant",
      "CatalogPrivilege" to "org.apache.polaris.core.admin.model.CatalogPrivilege",
      "CatalogProperties" to "org.apache.polaris.core.admin.model.CatalogProperties",
      "CatalogRole" to "org.apache.polaris.core.admin.model.CatalogRole",
      "CatalogRoles" to "org.apache.polaris.core.admin.model.CatalogRoles",
      "Catalogs" to "org.apache.polaris.core.admin.model.Catalogs",
      "CreateCatalogRequest" to "org.apache.polaris.core.admin.model.CreateCatalogRequest",
      "CreateCatalogRoleRequest" to "org.apache.polaris.core.admin.model.CreateCatalogRoleRequest",
      "CreatePrincipalRequest" to "org.apache.polaris.core.admin.model.CreatePrincipalRequest",
      "CreatePrincipalRoleRequest" to
        "org.apache.polaris.core.admin.model.CreatePrincipalRoleRequest",
      "ExternalCatalog" to "org.apache.polaris.core.admin.model.ExternalCatalog",
      "FileStorageConfigInfo" to "org.apache.polaris.core.admin.model.FileStorageConfigInfo",
      "GcpStorageConfigInfo" to "org.apache.polaris.core.admin.model.GcpStorageConfigInfo",
      "GrantCatalogRoleRequest" to "org.apache.polaris.core.admin.model.GrantCatalogRoleRequest",
      "GrantPrincipalRoleRequest" to
        "org.apache.polaris.core.admin.model.GrantPrincipalRoleRequest",
      "GrantResource" to "org.apache.polaris.core.admin.model.GrantResource",
      "GrantResources" to "org.apache.polaris.core.admin.model.GrantResources",
      "NamespaceGrant" to "org.apache.polaris.core.admin.model.NamespaceGrant",
      "NamespacePrivilege" to "org.apache.polaris.core.admin.model.NamespacePrivilege",
      "PolarisCatalog" to "org.apache.polaris.core.admin.model.PolarisCatalog",
      "Principal" to "org.apache.polaris.core.admin.model.Principal",
      "PrincipalRole" to "org.apache.polaris.core.admin.model.PrincipalRole",
      "PrincipalRoles" to "org.apache.polaris.core.admin.model.PrincipalRoles",
      "PrincipalWithCredentials" to "org.apache.polaris.core.admin.model.PrincipalWithCredentials",
      "PrincipalWithCredentialsCredentials" to
        "org.apache.polaris.core.admin.model.PrincipalWithCredentialsCredentials",
      "Principals" to "org.apache.polaris.core.admin.model.Principals",
      "RevokeGrantRequest" to "org.apache.polaris.core.admin.model.RevokeGrantRequest",
      "StorageConfigInfo" to "org.apache.polaris.core.admin.model.StorageConfigInfo",
      "TableGrant" to "org.apache.polaris.core.admin.model.TableGrant",
      "TablePrivilege" to "org.apache.polaris.core.admin.model.TablePrivilege",
      "UpdateCatalogRequest" to "org.apache.polaris.core.admin.model.UpdateCatalogRequest",
      "UpdateCatalogRoleRequest" to "org.apache.polaris.core.admin.model.UpdateCatalogRoleRequest",
      "UpdatePrincipalRequest" to "org.apache.polaris.core.admin.model.UpdatePrincipalRequest",
      "UpdatePrincipalRoleRequest" to
        "org.apache.polaris.core.admin.model.UpdatePrincipalRoleRequest",
      "ViewGrant" to "org.apache.polaris.core.admin.model.ViewGrant",
      "ViewPrivilege" to "org.apache.polaris.core.admin.model.ViewPrivilege",
    )
  )
}

tasks.named("compileJava") { dependsOn("generatePolarisManagementClient") }

sourceSets.main { java.srcDir("${layout.buildDirectory.get()}/generated/src/main/java") }
