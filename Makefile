PACKAGES=$(shell go list ./...)
OUTPUT=build/themis-contract
VERSION=$(shell git describe --tags)
TIMESTAMP=$(shell date -u +%Y%m%d.%H%M%S)
BUILD_FLAGS=-mod=readonly -ldflags="-X main.version=$(VERSION)-$(TIMESTAMP)"
.DEFAULT_GOAL := build

THEMIS_INSTALL_DIR ?= /usr/local/bin/

all: build test

deps:
	go get github.com/rakyll/statik

build:
	cd pkg/themis-contract/ && statik -f -src=../../assets/
	go build $(BUILD_FLAGS) -o $(OUTPUT) cmd/themis-contract/*

test:
	go test $(PACKAGES)

install: build
	cp $(OUTPUT) $(THEMIS_INSTALL_DIR)

.PHONY: all build test install deps
