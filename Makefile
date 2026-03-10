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

# Note: APPLICATION_CONF_PATH can be passed to specify a custom config file path.
# Can be an absolute path or relative to the benchmarks/ directory.

.PHONY: benchmarks-create-commits-simulation
benchmarks-create-commits-simulation: ## Run create commits simulation
	@$(MAKE) -C benchmarks create-commits-simulation

.PHONY: benchmarks-create-dataset-simulation
benchmarks-create-dataset-simulation: ## Run create dataset simulation
	@$(MAKE) -C benchmarks create-dataset-simulation

.PHONY: benchmarks-read-simulation
benchmarks-read-simulation: ## Run read simulation
	@$(MAKE) -C benchmarks read-simulation

.PHONY: benchmarks-read-update-simulation
benchmarks-read-update-simulation: ## Run read/update simulation
	@$(MAKE) -C benchmarks read-update-simulation

.PHONY: benchmarks-reports-clean
benchmarks-reports-clean: ## Clean benchmark reports
	@$(MAKE) -C benchmarks reports-clean

.PHONY: benchmarks-reports-list
benchmarks-reports-list: ## List benchmark reports
	@$(MAKE) -C benchmarks reports-list

.PHONY: benchmarks-weighted-workload-simulation
benchmarks-weighted-workload-simulation: ## Run weighted workload simulation
	@$(MAKE) -C benchmarks weighted-workload-simulation

.PHONY: benchmarks-version
benchmarks-version: ## Display version for benchmarks project
	@$(MAKE) -C benchmarks version

##@ Console

.PHONY: console-build
console-build: ## Build console project
	@$(MAKE) -C console build

.PHONY: console-build-docker
console-build-docker: ## Build docker image for console project
	@$(MAKE) -C console build-docker

.PHONY: console-dev
console-dev: ## Run the console project in development mode
	@$(MAKE) -C console dev

.PHONY: console-format-check
console-format-check: ## Check formatting in the console project
	@$(MAKE) -C console format-check

.PHONY: console-format-fix
console-format-fix: ## Fix formatting in the console project
	@$(MAKE) -C console format-fix

.PHONY: console-install
console-install: ## Install dependencies for console project
	@$(MAKE) -C console install

.PHONY: console-lint
console-lint: ## Lint the console project
	@$(MAKE) -C console lint

.PHONY: console-lint-fix
console-lint-fix: ## Fix linting issues in the console project
	@$(MAKE) -C console lint-fix

.PHONY: console-version
console-version: ## Display version for console project
	@$(MAKE) -C console version
