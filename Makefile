.PHONY: all build build-frontend test clean run

TAGS ?= desktop,production,webkit2_41

all: build

build-frontend:
	cd frontend && npm install && npm run build

test:
	go test -v ./...

build: build-frontend
	mkdir -p build/bin
	go build -tags "$(TAGS)" -o build/bin/koda .
	ln -sf koda build/bin/astrocode

run: build
	./build/bin/koda

clean:
	rm -rf build/bin frontend/dist
