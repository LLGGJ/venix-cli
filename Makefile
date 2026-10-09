BINARY := venix
VERSION ?= $(shell git describe --tags --always 2>/dev/null | sed "s/^v//" || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: fmt tidy vet test check build install clean

fmt:
	gofmt -w cmd internal

tidy:
	go mod tidy

vet:
	go vet ./...

test:
	go test ./...

check: fmt tidy vet test

build:
	mkdir -p dist
	go build -trimpath -ldflags "$(LDFLAGS)" -o dist/$(BINARY) ./cmd/venix

install:
	go install -trimpath -ldflags "$(LDFLAGS)" ./cmd/venix

clean:
	go clean
	rm -rf dist
