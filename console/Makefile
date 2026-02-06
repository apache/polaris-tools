
DOCKER ?= docker
DOCKER_IMAGE_NAME ?= apache/polaris-console
DOCKER_IMAGE_TAG ?= latest

.PHONY: build-docker
build-docker:
	@$(DOCKER) build -f docker/Dockerfile -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) .


.PHONY: install
install:
	npm ci

.PHONY: lint
lint: format-check
	npm run lint

.PHONY: format-fix
format-fix:
	npm run format

.PHONE: lint-fix
lint-fix: format-fix
	npm run lint -- --fix

.PHONY: format-check
format-check:
	npm run format:check

.PHONY: build
build: lint
	npm run build

.PHONY: dev
dev:
	npm run dev