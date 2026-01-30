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

# Variables
IMAGE_NAME ?= polaris-console
POLARIS_HOST ?= http://host.docker.internal:8181

.PHONY: install
install:
	npm ci

.PHONY: build
build:
	npm run build

.PHONY: dev
dev:
	npm run dev

.PHONY: lint
lint:
	npm run lint

# Reproducible build targets using devbox
.PHONY: devbox-install
devbox-install:
	@command -v devbox >/dev/null 2>&1 || { echo "Installing devbox..."; curl -fsSL https://get.jetify.com/devbox | bash; }

.PHONY: build-reproducible
build-reproducible: devbox-install
	devbox run build

.PHONY: verify-reproducible
verify-reproducible: devbox-install
	@echo "Building twice and comparing checksums..."
	@devbox run build
	@tar --sort=name --mtime="1980-01-01 00:00:00 UTC" --owner=0 --group=0 --numeric-owner -cf a.tar dist/
	@rm -rf dist
	@devbox run build
	@tar --sort=name --mtime="1980-01-01 00:00:00 UTC" --owner=0 --group=0 --numeric-owner -cf b.tar dist/
	@echo "Build A checksum:"
	@sha256sum a.tar
	@echo "Build B checksum:"
	@sha256sum b.tar
	@if diff <(sha256sum a.tar | cut -d' ' -f1) <(sha256sum b.tar | cut -d' ' -f1) >/dev/null; then \
		echo "✅ Builds are reproducible!"; \
		rm -f a.tar b.tar; \
	else \
		echo "❌ Builds are NOT reproducible"; \
		rm -f a.tar b.tar; \
		exit 1; \
	fi

# Docker targets
.PHONY: docker-build
docker-build:
	docker build -t $(IMAGE_NAME) --build-arg POLARIS_HOST=$(POLARIS_HOST) -f docker/Dockerfile .

.PHONY: docker-run
docker-run:
	docker run -p 8080:8080 $(IMAGE_NAME)

.PHONY: clean
clean:
	rm -rf dist node_modules a.tar b.tar