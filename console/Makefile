
DOCKER ?= docker
DOCKER_IMAGE_NAME ?= apache/polaris-console
DOCKER_IMAGE_TAG ?= latest

.PHONY: build-docker
build-docker:
	@$(DOCKER) build -f docker/Dockerfile -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) .