package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestEvaluateYAMLSelector(t *testing.T) {
	result, err := evaluate("foo:\n  bar: baz\n", "foo.bar", "yaml", "yaml")
	if err != nil {
		t.Fatalf("expected yaml selector to succeed: %v", err)
	}

	if result != "baz\n" {
		t.Fatalf("expected scalar output %q, got %q", "baz\n", result)
	}
}

func TestEvaluateINISelector(t *testing.T) {
	input := `app_mode = development

[server]
http_port = 9999
`

	result, err := evaluate(input, "server.http_port", "ini", "yaml")
	if err != nil {
		t.Fatalf("expected ini selector to succeed: %v", err)
	}

	if result != "9999\n" {
		t.Fatalf("expected ini selector output %q, got %q", "9999\n", result)
	}
}

func TestEvaluateTOMLToJSON(t *testing.T) {
	input := `[server]
ip = "127.0.0.1"
`

	result, err := evaluate(input, "server", "toml", "json")
	if err != nil {
		t.Fatalf("expected toml -> json evaluation to succeed: %v", err)
	}

	var parsed map[string]string
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid json output, got error: %v\noutput:\n%s", err, result)
	}

	if parsed["ip"] != "127.0.0.1" {
		t.Fatalf("expected parsed json to contain ip, got %#v", parsed)
	}
}

func TestEvaluateInvalidSelector(t *testing.T) {
	_, err := evaluate("foo: bar\n", "foo[", "yaml", "yaml")
	if err == nil {
		t.Fatal("expected an error for an invalid selector")
	}
}

func TestEvaluateWithOptionsReturnRoot(t *testing.T) {
	result, err := evaluateWithOptions(
		"foo: bar\n",
		`foo = "baz"`,
		"yaml",
		"json",
		evaluationOptions{
			ReturnRoot: true,
			WriteFlags: map[string]string{},
			ReadFlags:  map[string]string{},
		},
	)
	if err != nil {
		t.Fatalf("expected returnRoot mutation to succeed: %v", err)
	}

	if !strings.Contains(result, `"foo": "baz"`) {
		t.Fatalf("expected mutated root output, got %q", result)
	}
}

func TestSafeEvaluateWithOptionsRecoversPanics(t *testing.T) {
	_, err := safeEvaluateWithOptions(
		"foo: bar\n",
		"foo",
		"yaml",
		"yaml",
		evaluationOptions{
			ReadFlags:  map[string]string{},
			WriteFlags: map[string]string{},
			debugPanic: true,
		},
	)
	if err == nil {
		t.Fatal("expected a panic to be recovered as an error")
	}

	if !strings.Contains(err.Error(), "internal error occurred") {
		t.Fatalf("expected a friendly internal-error message, got %v", err)
	}
}
