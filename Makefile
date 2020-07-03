PACKAGES=$(shell go list ./...)
OUTPUT=build/themis-contract
BUILD_FLAGS=-mod=readonly
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
