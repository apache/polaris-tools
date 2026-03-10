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
DOCKER ?= docker
DOCKER_IMAGE_NAME ?= apache/polaris-console
DOCKER_IMAGE_TAG ?= latest

## Version information
BUILD_VERSION := $(shell grep version package.json | sed 's/.*"version": "\(.*\)".*/\1/')
GIT_COMMIT := $(shell git rev-parse HEAD)

##@ General

.PHONY: help
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9\.-]+:.*?##/ { printf "  \033[36m%-40s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: version
version: ## Display version information
	@echo "Build version: ${BUILD_VERSION}"
	@echo "Git commit: ${GIT_COMMIT}"

##@ Polaris Console

.PHONY: build
build: lint ## Build console project
	@echo "--- Building console project---"
	@npm run build
	@echo "--- Console project built ---"

.PHONY: build-docker
build-docker: install ## Build docker image for console project
	@echo "--- Building docker image for console project---"
	@$(DOCKER) build -f docker/Dockerfile -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) .
	@echo "--- Docker image for console project built ---"

.PHONY: dev
dev: install ## Run the console project in development mode
	@echo "--- Running console project in development mode ---"
	@npm run dev
	@echo "--- Console project in development mode completed ---"

.PHONY: format-check
format-check: install ## Check formatting in the console project
	@echo "--- Checking formatting in the console project ---"
	@npm run format:check
	@echo "--- Formatting in the console project checked ---"

.PHONY: format-fix
format-fix: install ## Fix linting issues in the console project
	@echo "--- Fixing formatting in the console project ---"
	@npm run format
	@echo "--- Formatting in the console project fixed ---"

.PHONY: install
install: ## Install dependencies for console project
	@echo "--- Install dependencies for console project ---"
	@npm install
	@echo "--- Dependencies for console project completed ---"

.PHONY: lint
lint: format-check ## Lint the console project
	@echo "--- Linting the console project ---"
	@npm run lint
	@echo "--- Console project linted ---"

.PHONY: lint-fix
lint-fix: format-fix ## Fix linting issues in the console project
	@echo "--- Fixing linting issues in the console project ---"
	@npm run lint -- --fix
	@echo "--- Linting issues in the console project fixed ---"
