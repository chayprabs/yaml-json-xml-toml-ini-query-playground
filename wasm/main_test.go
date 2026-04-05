package main

import (
	"encoding/json"
	"strings"
	"testing"

	yaml "go.yaml.in/yaml/v4"
)

func TestEvaluateYAMLScalar(t *testing.T) {
	result, err := evaluate("foo: bar\n", ".foo", "yaml", "yaml")
	if err != nil {
		t.Fatalf("expected yaml evaluation to succeed: %v", err)
	}

	if result != "bar\n" {
		t.Fatalf("expected scalar output %q, got %q", "bar\n", result)
	}
}

func TestEvaluateJSONToYAML(t *testing.T) {
	result, err := evaluate(`{"foo":{"bar":2}}`, ".foo", "json", "yaml")
	if err != nil {
		t.Fatalf("expected json -> yaml conversion to succeed: %v", err)
	}

	var parsed map[string]int
	if err := yaml.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid yaml output, got error: %v\noutput:\n%s", err, result)
	}

	if parsed["bar"] != 2 {
		t.Fatalf("expected parsed yaml to contain bar=2, got %#v", parsed)
	}
}

func TestEvaluateInvalidExpression(t *testing.T) {
	_, err := evaluate("foo: bar\n", ".foo | |", "yaml", "yaml")
	if err == nil {
		t.Fatal("expected an error for an invalid expression")
	}
}

func TestEvaluateEmptyInput(t *testing.T) {
	_, err := evaluate("", ".foo", "yaml", "yaml")
	if err == nil || !strings.Contains(err.Error(), "input is required") {
		t.Fatalf("expected a friendly empty-input error, got %v", err)
	}
}

func TestEvaluateEmptyExpression(t *testing.T) {
	_, err := evaluate("foo: bar\n", "", "yaml", "yaml")
	if err == nil || !strings.Contains(err.Error(), "expression is required") {
		t.Fatalf("expected a friendly empty-expression error, got %v", err)
	}
}

func TestEvaluateMultiDocumentYAML(t *testing.T) {
	input := "foo: first\n---\nfoo: second\n"
	result, err := evaluate(input, ".foo", "yaml", "yaml")
	if err != nil {
		t.Fatalf("expected multi-document yaml evaluation to succeed: %v", err)
	}

	expected := "first\n---\nsecond\n"
	if result != expected {
		t.Fatalf("expected %q, got %q", expected, result)
	}
}

func TestEvaluateXMLRoundTrip(t *testing.T) {
	input := "<cat><name>Fifi</name></cat>"
	result, err := evaluate(input, ".", "xml", "xml")
	if err != nil {
		t.Fatalf("expected xml round-trip to succeed: %v", err)
	}

	if !strings.Contains(result, "<cat>") || !strings.Contains(result, "<name>Fifi</name>") {
		t.Fatalf("expected xml output to include the original structure, got %q", result)
	}
}

func TestEvaluateWithOptionsNoDoc(t *testing.T) {
	input := "foo: first\n---\nfoo: second\n"
	result, err := evaluateWithOptions(input, ".foo", "yaml", "yaml", evaluationOptions{
		NoDoc:        true,
		UnwrapScalar: true,
	})
	if err != nil {
		t.Fatalf("expected multi-document yaml evaluation without doc separators to succeed: %v", err)
	}

	expected := "first\nsecond\n"
	if result != expected {
		t.Fatalf("expected %q, got %q", expected, result)
	}
}

func TestEvaluateWithOptionsUnwrapScalarFalse(t *testing.T) {
	result, err := evaluateWithOptions("foo: \"yes\"\n", ".foo", "yaml", "json", evaluationOptions{
		UnwrapScalar: false,
	})
	if err != nil {
		t.Fatalf("expected wrapped json scalar evaluation to succeed: %v", err)
	}

	if result != "\"yes\"\n" {
		t.Fatalf("expected quoted json scalar output, got %q", result)
	}
}

func TestEvaluateWithOptionsPrettyPrint(t *testing.T) {
	result, err := evaluateWithOptions("foo: {bar: baz}\n", ".", "yaml", "yaml", evaluationOptions{
		PrettyPrint:  true,
		UnwrapScalar: true,
	})
	if err != nil {
		t.Fatalf("expected pretty print evaluation to succeed: %v", err)
	}

	if strings.Contains(result, "{bar: baz}") {
		t.Fatalf("expected pretty print to expand flow style, got %q", result)
	}
}

func TestEvaluateWithOptionsXMLToJSON(t *testing.T) {
	result, err := evaluateWithOptions("<root><name>engine</name></root>", ".", "xml", "json", evaluationOptions{
		UnwrapScalar: false,
	})
	if err != nil {
		t.Fatalf("expected xml -> json evaluation to succeed: %v", err)
	}

	var parsed map[string]map[string]string
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid json output, got error: %v\noutput:\n%s", err, result)
	}

	if parsed["root"]["name"] != "engine" {
		t.Fatalf("expected parsed json to contain root.name=engine, got %#v", parsed)
	}
}

func TestSafeEvaluateWithOptionsRecoversPanics(t *testing.T) {
	_, err := safeEvaluateWithOptions("foo: bar\n", ".", "yaml", "yaml", evaluationOptions{
		UnwrapScalar: true,
		debugPanic:   true,
	})
	if err == nil {
		t.Fatal("expected a panic to be recovered as an error")
	}

	if !strings.Contains(err.Error(), "internal error occurred") {
		t.Fatalf("expected a friendly internal-error message, got %v", err)
	}
}
