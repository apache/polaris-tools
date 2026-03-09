#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec

## Variables
PYTHON ?= python3
VENV_DIR := .venv
ACTIVATE = source $(VENV_DIR)/bin/activate

## Version information
GIT_COMMIT := $(shell git rev-parse HEAD)
UV_VERSION := $(shell cat pyproject.toml | grep -A1 tool.uv | grep -v tool.uv | grep required-version | sed 's/required-version *= *"\([^"]*\)".*/\1/')

##@ General

.PHONY: help
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9\.-]+:.*?##/ { printf "  \033[36m%-40s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: version
version: ## Display version information
	@echo "Git commit: ${GIT_COMMIT}"
	@echo "UV version: ${UV_VERSION}"

##@ MCP Server

# Target to create the virtual environment directory
$(VENV_DIR):
	@echo "Setting up Python virtual environment at $(VENV_DIR)..."
	@$(PYTHON) -m venv $(VENV_DIR)
	@echo "Virtual environment created."

.PHONY: install-dependencies
install-dependencies: $(VENV_DIR)
	@echo "Installing UV and project dependencies into $(VENV_DIR) for MCP project..."
	@$(VENV_DIR)/bin/pip install --upgrade pip
	@if [ ! -f "$(VENV_DIR)/bin/uv" ]; then \
		$(VENV_DIR)/bin/pip install --upgrade "uv$(UV_VERSION)"; \
	fi
	@$(ACTIVATE) && uv lock && uv sync --active --all-extras
	@echo "uv and dependencies installed for MCP project."

.PHONY: setup-env
setup-env: $(VENV_DIR) install-dependencies

.PHONY: build
build: setup-env ## Build the distribution files (sdist and wheel) for MCP project
	@echo "--- Building distribution for MCP project ---"
	@$(ACTIVATE) && uv build
	@echo "--- Distribution build complete for MCP project ---"

.PHONY: cleanup
cleanup: ## Cleanup virtual environment and build artifacts for MCP project
	@echo "--- Cleaning up virtual environment and build artifacts for MCP project ---"
	@rm -rf "$(VENV_DIR)" build/ dist/ .pytest_cache/ apache_polaris_mcp.egg-info/
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo "--- Cleanup complete for MCP project ---"

.PHONY: lint
lint: setup-env ## Lint the MCP project
	@echo "--- Running linting checks for MCP project ---"
	@$(ACTIVATE) && uv run pre-commit run --all-files
	@echo "--- Linting checks complete for MCP project ---"

.PHONY: run
run: setup-env ## Start MCP server (stdin/stdout transport)
	@echo "--- Starting MCP server ---"
	@$(ACTIVATE) && uv run polaris-mcp
	@echo "--- MCP server finished ---"

.PHONY: test
test: setup-env ## Run unit tests for MCP project
	@echo "--- Running unit tests for MCP project ---"
	@$(ACTIVATE) && uv run pytest tests/
	@echo "--- Unit tests complete for MCP project---"
