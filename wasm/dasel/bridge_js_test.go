//go:build js && wasm

package main

import (
	"strings"
	"syscall/js"
	"testing"
)

func TestOptionsFromJSUndefinedUsesSafeDefaults(t *testing.T) {
	options := optionsFromJS(js.Undefined())
	if options.ReturnRoot {
		t.Fatal("expected returnRoot to default to false")
	}

	if options.Unstable {
		t.Fatal("expected unstable to default to false")
	}
}

func TestParseBridgeArgumentsRejectsUndefinedInput(t *testing.T) {
	_, err := parseBridgeArguments([]js.Value{
		js.Undefined(),
		js.ValueOf("foo.bar"),
		js.ValueOf("yaml"),
		js.ValueOf("yaml"),
	})
	if err == nil {
		t.Fatal("expected an error when input is undefined")
	}

	if !strings.Contains(err.Error(), "input must be a string") {
		t.Fatalf("expected an input-type error, got %v", err)
	}
}
