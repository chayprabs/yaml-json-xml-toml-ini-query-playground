package main

import (
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
