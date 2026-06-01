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




##@ Helm

.PHONY: helm
helm: helm-schema-generate helm-lint helm-unittest ## Run most Helm targets (schema, unittest, and lint)

helm-install-plugins: DEPENDENCIES := helm
.PHONY: helm-install-plugins
helm-install-plugins: check-dependencies ## Install required Helm plugins (unittest, schema)
	@echo "--- Installing Helm plugins ---"
	@HELM_MAJOR_VERSION=$$(helm version --short | sed 's/^v//' | cut -d. -f1); \
	if [ "$$HELM_MAJOR_VERSION" -ge 4 ] 2>/dev/null; then \
		HELM_PLUGIN_FLAGS="--verify=false"; \
	else \
		HELM_PLUGIN_FLAGS=""; \
	fi; \
	if helm plugin list | grep -q "^unittest"; then \
		echo "Plugin 'unittest' is already installed."; \
	else \
		echo "Installing 'unittest' plugin..."; \
		helm plugin install $$HELM_PLUGIN_FLAGS https://github.com/helm-unittest/helm-unittest.git; \
	fi; \
	if helm plugin list | grep -q "^schema"; then \
		echo "Plugin 'schema' is already installed."; \
	else \
		echo "Installing 'schema' plugin..."; \
		helm plugin install $$HELM_PLUGIN_FLAGS https://github.com/losisin/helm-values-schema-json.git; \
	fi
	@echo "--- Helm plugins installed ---"

helm-lint: DEPENDENCIES := ct yamllint
.PHONY: helm-lint
helm-lint: check-dependencies ## Run Helm chart lint check
	@echo "--- Running Helm chart linting ---"
	@ct lint --charts helm/ --validate-maintainers=false
	@echo "--- Helm chart linting complete ---"

helm-schema-generate: DEPENDENCIES := helm
.PHONY: helm-schema-generate
helm-schema-generate: helm-install-plugins ## Generate Helm chart JSON schema from values.yaml
	@echo "--- Generating Helm values schema ---"
	@helm schema -f helm/values.yaml -o helm/values.schema.json --use-helm-docs --draft 7
	@echo "--- Helm values schema generated ---"

helm-schema-verify: DEPENDENCIES := helm git
.PHONY: helm-schema-verify
helm-schema-verify: helm-schema-generate ## Verify Helm chart JSON schema is up to date
	@echo "--- Verifying Helm values schema is up to date ---"
	@if ! git diff --exit-code helm/values.schema.json; then \
		echo "ERROR: Helm schema is out of date. Please run 'make helm-schema-generate' and commit the changes."; \
		exit 1; \
	fi
	@echo "--- Helm values schema is up to date ---"

helm-unittest: DEPENDENCIES := helm
.PHONY: helm-unittest
helm-unittest: helm-install-plugins ## Run Helm chart unittest
	@echo "--- Running Helm chart unittest ---"
	@helm unittest helm/
	@echo "--- Helm chart unittest complete ---"

##@ Dependencies

.PHONY: check-dependencies
check-dependencies: ## Check if all requested dependencies are present
	@echo "--- Checking for requested dependencies ---"
	@for dependency in $(DEPENDENCIES); do \
		echo "Checking for $$dependency..."; \
		if [ "$$dependency" = "java21" ]; then \
			if java --version | head -n1 | cut -d' ' -f2 | grep -q '^21\.'; then \
			echo "Java 21 is installed."; \
			else \
				echo "Java 21 is NOT installed."; \
				echo "--- ERROR: Dependency 'Java 21' is missing. Please install it to proceed. Exiting. ---"; \
				exit 1; \
			fi ; \
		elif command -v $$dependency >/dev/null 2>&1; then \
			echo "$$dependency is installed."; \
		else \
			echo "$$dependency is NOT installed."; \
			echo "--- ERROR: Dependency '$$dependency' is missing. Please install it to proceed. Exiting. ---"; \
			exit 1; \
		fi; \
	done
	@echo "--- All checks complete. ---"

.PHONY: check-brew
check-brew:
	@echo "--- Checking Homebrew installation ---"
	@if command -v brew >/dev/null 2>&1; then \
		echo "--- Homebrew is installed ---"; \
	else \
		echo "--- Homebrew is not installed. Aborting ---"; \
		exit 1; \
	fi

.PHONY: install-dependencies-brew
install-dependencies-brew: check-brew ## Install dependencies if not present via Brew
	@echo "--- Checking and installing dependencies for this target ---"
	@for dependency in $(DEPENDENCIES); do \
		case $$dependency in \
			java21) \
				if java -version 2>&1 | grep -q '21'; then \
					:; \
				else \
					echo "Java 21 is not installed. Installing openjdk@21 and jenv..."; \
					brew install openjdk@21 jenv; \
					$(shell brew --prefix jenv)/bin/jenv add $(shell brew --prefix openjdk@21); \
					jenv local 21; \
					echo "Java 21 installed."; \
				fi ;; \
			docker|podman) \
				if command -v $$dependency >/dev/null 2>&1; then \
					:; \
				else \
					echo "$$dependency is not installed. Manual installation required"; \
				fi ;; \
			ct) \
				if command -v ct >/dev/null 2>&1; then \
					:; \
				else \
					echo "ct is not installed. Installing with Homebrew..."; \
					brew install chart-testing; \
					echo "ct installed."; \
				fi ;; \
			*) \
				if command -v $$dependency >/dev/null 2>&1; then \
					:; \
				else \
					echo "$$dependency is not installed. Installing with Homebrew..."; \
					brew install $$dependency; \
					echo "$$dependency installed."; \
				fi ;; \
		esac; \
	done
	@echo "--- All requested dependencies checked/installed ---"

install-optional-dependencies-brew: DEPENDENCIES := $(OPTIONAL_DEPENDENCIES)
.PHONY: install-optional-dependencies-brew
install-optional-dependencies-brew: install-dependencies-brew ## Install optional dependencies if not present via Brew
