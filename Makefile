BINARY=venix
VERSION?=0.7.0-dev
LDFLAGS=-s -w -X main.version=$(VERSION)

.PHONY: fmt tidy test build install snapshot release clean
fmt:
	gofmt -w cmd internal

tidy:
	go mod tidy

test:
	go test ./...

build:
	go build -trimpath -ldflags "$(LDFLAGS)" -o dist/$(BINARY) ./cmd/venix

install:
	go install -trimpath -ldflags "$(LDFLAGS)" ./cmd/venix

snapshot:
	goreleaser release --snapshot --clean

release:
	goreleaser release --clean

clean:
	go clean
	rm -rf dist
