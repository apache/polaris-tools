import com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar

plugins {
    `java-library`
    `maven-publish`
    signing
    `build-conventions`
}

applyShadowJar()

dependencies {
    implementation(project(":polaris-synchronizer-api"))

    implementation(libs.picocli)
    implementation(libs.slf4j)
    implementation(libs.iceberg.spark.runtime)
    implementation(libs.apache.commons.csv)
    runtimeOnly(libs.logback.classic)

    testImplementation(platform(libs.junit.bom))
    testImplementation("org.junit.jupiter:junit-jupiter-params")
    testImplementation("org.junit.jupiter:junit-jupiter-api")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

val mainClassName = "org.apache.polaris.tools.sync.polaris.PolarisSynchronizerCLI"

val shadowJar = tasks.named<ShadowJar>("shadowJar") { isZip64 = true }

shadowJar {
    manifest {
        attributes["Main-Class"] = mainClassName
    }
}

tasks.test {
    useJUnitPlatform()
}