rootProject.name = "polaris-synchronizer"

fun polarisSynchronizerProject(name: String) {
    include("polaris-synchronizer-$name")
    project(":polaris-synchronizer-$name").projectDir = file(name)
}

polarisSynchronizerProject("api")

polarisSynchronizerProject("cli")