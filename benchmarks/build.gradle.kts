plugins {
    scala
    id("io.gatling.gradle") version "3.13.5.2"
    id("com.diffplug.spotless") version "7.0.2"
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
    }
}
