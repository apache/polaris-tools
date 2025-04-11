plugins {
    id("java")
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