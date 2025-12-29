
DOCKER ?= docker
DOCKER_IMAGE_NAME ?= apache/polaris-console
DOCKER_IMAGE_TAG ?= latest

.PHONY: build-docker
build-docker:
	@$(DOCKER) build -f docker/Dockerfile -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) .


.PHONY: install
install:
	npm install

.PHONY: lint
lint:
	npm run lint

.PHONY: build
build: lint
	npm run build

.PHONY: dev
dev:
	npm run dev