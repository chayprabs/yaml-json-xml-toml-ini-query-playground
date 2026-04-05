//go:build js && wasm

package main

import (
	"strings"
	"syscall/js"
	"testing"
)

func TestOptionsFromJSUndefinedUsesSafeDefaults(t *testing.T) {
	options := optionsFromJS(js.Undefined(), "json")
	if !options.UnwrapScalar {
		t.Fatal("expected json output to default to unwrapScalar=true")
	}

	if options.NoDoc {
		t.Fatal("expected undefined JS options to keep noDoc=false")
	}
}

func TestParseBridgeArgumentsRejectsUndefinedInput(t *testing.T) {
	_, err := parseBridgeArguments([]js.Value{
		js.Undefined(),
		js.ValueOf("."),
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
