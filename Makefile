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

##@ General

.PHONY: help
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9\.-]+:.*?##/ { printf "  \033[36m%-40s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Benchmarks

.PHONY: benchmarks-pre-requisite
benchmarks-pre-requisite:
	@if [ ! -f "benchmarks/application.conf" ]; then \
		echo "ERROR: benchmarks/application.conf is missing"; \
		exit 1; \
	fi

.PHONY: benchmarks-create-dataset-simulation
benchmarks-create-dataset-simulation: benchmarks-pre-requisite ## Run create dataset simulation
	@echo "--- Running create dataset simulation ---"
	@$(MAKE) -C benchmarks create-dataset-simulation
	@echo "--- Create dataset simulation completed ---"

.PHONY: benchmarks-read-simulation
benchmarks-read-simulation: benchmarks-pre-requisite ## Run read simulation
	@echo "--- Running read simulation ---"
	@$(MAKE) -C benchmarks read-simulation
	@echo "--- Read simulation completed ---"

.PHONY: benchmarks-read-update-simulation
benchmarks-read-update-simulation: benchmarks-pre-requisite ## Run read/update simulation
	@echo "--- Running read/update simulation ---"
	@$(MAKE) -C benchmarks read-update-simulation
	@echo "--- Read/Update simulation completed ---"

.PHONY: benchmarks-create-commits-simulation
benchmarks-create-commits-simulation: benchmarks-pre-requisite ## Run create commits simulation
	@echo "--- Running create commits simulation ---"
	@$(MAKE) -C benchmarks create-commits-simulation
	@echo "--- Create commits simulation completed ---"

.PHONY: benchmarks-weighted-workload-simulation
benchmarks-weighted-workload-simulation: benchmarks-pre-requisite ## Run weighted workload simulation
	@echo "--- Running weighted workload simulation ---"
	@$(MAKE) -C benchmarks weighted-workload-simulation
	@echo "--- Weighted workload simulation completed ---"

.PHONY: benchmarks-reports-list
benchmarks-reports-list: ## List benchmark reports
	@echo "--- Listing benchmark reports ---"
	@$(MAKE) -C benchmarks reports-list
	@echo "--- List benchmark reports completed ---"

.PHONY: benchmarks-reports-clean
benchmarks-reports-clean: ## Clean benchmark reports
	@echo "--- Cleaning benchmark reports ---"
	@$(MAKE) -C benchmarks reports-clean
	@echo "--- Clean benchmark reports completed ---"


##@ Console

.PHONY: console-build-docker
console-build-docker: ## Build docker image for console project
	@echo "--- Building docker image for console project---"
	@$(MAKE) -C console build-docker
	@echo "--- Docker image for console project built ---"

.PHONY: console-install
console-install: ## Install dependencies for console project
	@echo "--- Install dependencies for console project ---"
	@$(MAKE) -C console install
	@echo "--- Dependencies for console project completed ---"

.PHONY: console-build
console-build: console-install ## Build console project
	@echo "--- Building console project---"
	@$(MAKE) -C console build
	@echo "--- Console project built ---"

.PHONY: console-lint
console-lint: console-install ## Lint the console project
	@echo "--- Linting the console project ---"
	@$(MAKE) -C console lint
	@echo "--- Console project linted ---"

.PHONY: console-lint-fix
console-lint-fix: console-install ## Fix linting issues in the console project
	@echo "--- Fixing linting issues in the console project ---"
	@$(MAKE) -C console lint-fix
	@echo "--- Linting issues in the console project fixed ---"

.PHONY: console-format-check
console-format-check: console-install ## Check formatting in the console project
	@echo "--- Checking formatting in the console project ---"
	@$(MAKE) -C console format-check
	@echo "--- Formatting in the console project checked ---"

.PHONY: console-format-fix
console-format-fix: console-install ## Fix formatting in the console project
	@echo "--- Fixing formatting in the console project ---"
	@$(MAKE) -C console format-fix
	@echo "--- Formatting in the console project fixed ---"

.PHONY: console-dev
console-dev: console-install ## Run the console project in development mode
	@echo "--- Running console project in development mode ---"
	@$(MAKE) -C console dev
	@echo "--- Console project in development mode completed ---"

