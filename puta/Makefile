BINARY := venix
VERSION ?= 0.7.3
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: fmt tidy vet test check build install snapshot release clean

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

snapshot:
	goreleaser release --snapshot --clean

release:
	goreleaser release --clean

clean:
	go clean
	rm -rf dist
