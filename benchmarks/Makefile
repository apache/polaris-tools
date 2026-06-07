#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.

# Configures the shell for recipes to use bash, enabling bash commands and ensuring
# that recipes exit on any command failure (including within pipes).
SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec

## Variables
APPLICATION_CONF_PATH ?= application.conf

## Version information
GIT_COMMIT := $(shell git rev-parse HEAD)

##@ General

.PHONY: help
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9\.-]+:.*?##/ { printf "  \033[36m%-40s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: version
version: ## Display version information
	@echo "Git commit: ${GIT_COMMIT}"

##@ Polaris Benchmark

.PHONY: benchmarks-pre-requisite
benchmarks-pre-requisite:
	@if [ ! -f "${APPLICATION_CONF_PATH}" ]; then \
		echo "ERROR: ${APPLICATION_CONF_PATH} is missing"; \
		exit 1; \
	fi

.PHONY: create-commits-simulation
create-commits-simulation: benchmarks-pre-requisite ## Run create commits simulation
	@echo "--- Running create commits simulation ---"
	@./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.CreateCommits \
      -Dconfig.file=${APPLICATION_CONF_PATH}
	@echo "--- Create commits simulation completed ---"

.PHONY: create-dataset-simulation
create-dataset-simulation: benchmarks-pre-requisite ## Run create dataset simulation
	@echo "--- Running create dataset simulation ---"
	@./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.CreateTreeDataset \
      -Dconfig.file=${APPLICATION_CONF_PATH}
	@echo "--- Create dataset simulation completed ---"

.PHONY: read-simulation
read-simulation: benchmarks-pre-requisite ## Run read simulation
	@echo "--- Running read simulation ---"
	@./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadTreeDataset \
      -Dconfig.file=${APPLICATION_CONF_PATH}
	@echo "--- Read simulation completed ---"

.PHONY: read-update-simulation
read-update-simulation: benchmarks-pre-requisite ## Run read/update simulation
	@echo "--- Running read/update simulation ---"
	@./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.ReadUpdateTreeDataset \
      -Dconfig.file=${APPLICATION_CONF_PATH}
	@echo "--- Read/Update simulation completed ---"

.PHONY: reports-clean
reports-clean: ## Clean benchmark reports
	@echo "--- Cleaning benchmark reports ---"
	@rm -rf build/reports/gatling/*/ 2>/dev/null || true
	@echo "--- Clean benchmark reports completed ---"

.PHONY: reports-list
reports-list: ## List benchmark reports
	@echo "--- Listing benchmark reports ---"
	@for report in $$(ls -d build/reports/gatling/*/ 2>/dev/null | sort -r); do \
		basename="$$(basename $$report)"; \
		name="$$(echo $$basename | sed 's/-[0-9]\{17\}$$//')"; \
		timestamp="$$(echo $$basename | grep -o '[0-9]\{17\}$$')"; \
		if [ -n "$$timestamp" ]; then \
			date="$$(echo $$timestamp | cut -c1-8)"; \
			time="$$(echo $$timestamp | cut -c9-14)"; \
			millis="$$(echo $$timestamp | cut -c15-17)"; \
			formatted_date="$$(echo $$date | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3/')"; \
			formatted_time="$$(echo $$time | sed 's/\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1:\2:\3/')"; \
			index_path="$${report}index.html"; \
			if [ -f "$$index_path" ]; then \
				echo "$$name | $$formatted_date $$formatted_time.$$millis | $$index_path"; \
			else \
				echo "$$name | $$formatted_date $$formatted_time.$$millis | ERROR"; \
			fi; \
		fi; \
	done
	@echo "--- List benchmark reports completed ---"

.PHONY: weighted-workload-simulation
weighted-workload-simulation: benchmarks-pre-requisite ## Run weighted workload simulation
	@echo "--- Running weighted workload simulation ---"
	@./gradlew gatlingRun --simulation org.apache.polaris.benchmarks.simulations.WeightedWorkloadOnTreeDataset \
      -Dconfig.file=${APPLICATION_CONF_PATH}
	@echo "--- Weighted workload simulation completed ---"
