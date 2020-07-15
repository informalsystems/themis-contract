PACKAGES=$(shell go list ./...)
OUTPUT=build/themis-contract
VERSION?=$(shell git describe --abbrev=0)
TIMESTAMP=$(shell date -u +%Y%m%d.%H%M%S)
BUILD_FLAGS=-mod=readonly -ldflags="-X main.version=$(VERSION)-$(TIMESTAMP)"
.DEFAULT_GOAL := build

all: build test

build:
	cd pkg/themis-contract/ && statik -src=../../assets/
	go build $(BUILD_FLAGS) -o $(OUTPUT) cmd/themis-contract/*

test:
	go test $(PACKAGES)

install: build
	cp $(OUTPUT) /usr/local/bin/

.PHONY: all build test install
