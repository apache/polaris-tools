.PHONY: create-dataset-simulation
create-dataset-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.CreateTreeDataset \
      -Dconfig.file=./application.conf

.PHONY: read-simulation
read-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadTreeDataset \
      -Dconfig.file=./application.conf

.PHONY: read-update-simulation
read-update-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadUpdateTreeDataset \
      -Dconfig.file=./application.conf

.PHONY: create-commits-simulation
create-commits-simulation:
	./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.CreateCommits \
      -Dconfig.file=./application.conf
