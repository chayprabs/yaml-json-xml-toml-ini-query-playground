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

	if result != "\"9999\"\n" {
		t.Fatalf("expected ini selector output %q, got %q", "\"9999\"\n", result)
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

func TestEvaluateHCLToJSON(t *testing.T) {
	input := `resource "aws_s3_bucket" "assets" {
  bucket = "pluck-assets"
  acl    = "private"
}
`

	result, err := evaluate(input, "$this", "hcl", "json")
	if err != nil {
		t.Fatalf("expected hcl -> json evaluation to succeed: %v", err)
	}

	var parsed map[string]map[string]map[string]map[string]string
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid json output, got error: %v\noutput:\n%s", err, result)
	}

	if parsed["resource"]["aws_s3_bucket"]["assets"]["acl"] != "private" {
		t.Fatalf("expected parsed json to contain resource.aws_s3_bucket.assets, got %#v", parsed)
	}
}

func TestEvaluateXMLToJSON(t *testing.T) {
	result, err := evaluate(
		`<root><service><name>worker</name></service></root>`,
		"$this",
		"xml",
		"json",
	)
	if err != nil {
		t.Fatalf("expected xml -> json evaluation to succeed: %v", err)
	}

	var parsed map[string]map[string]map[string]string
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid json output, got error: %v\noutput:\n%s", err, result)
	}

	if parsed["root"]["service"]["name"] != "worker" {
		t.Fatalf("expected parsed json to contain root.service.name=worker, got %#v", parsed)
	}
}

func TestEvaluateCSVSearchSelector(t *testing.T) {
	input := `name,role
api,web
worker,queue
cron,scheduler
`

	result, err := evaluate(input, `search(name == "worker")`, "csv", "json")
	if err != nil {
		t.Fatalf("expected csv search selector to succeed: %v", err)
	}

	var parsed []map[string]string
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid json output, got error: %v\noutput:\n%s", err, result)
	}

	if len(parsed) != 1 || parsed[0]["role"] != "queue" {
		t.Fatalf("expected one matching row with role=queue, got %#v", parsed)
	}
}

func TestEvaluateRecursiveDescentSelector(t *testing.T) {
	input := `{
  "services": [
    {"name": "api"},
    {"name": "worker"}
  ],
  "jobs": [
    {"name": "cron"}
  ]
}`

	result, err := evaluate(input, "..name", "json", "json")
	if err != nil {
		t.Fatalf("expected recursive descent selector to succeed: %v", err)
	}

	var parsed []string
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid json output, got error: %v\noutput:\n%s", err, result)
	}

	if len(parsed) != 3 || parsed[0] != "api" || parsed[1] != "worker" || parsed[2] != "cron" {
		t.Fatalf("expected recursive descent names, got %#v", parsed)
	}
}

func TestEvaluateSortBySelector(t *testing.T) {
	result, err := evaluate(`[3,1,2]`, `sortBy($this, desc)`, "json", "json")
	if err != nil {
		t.Fatalf("expected sortBy selector to succeed: %v", err)
	}

	var parsed []int
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Fatalf("expected valid json output, got error: %v\noutput:\n%s", err, result)
	}

	if len(parsed) != 3 || parsed[0] != 3 || parsed[1] != 2 || parsed[2] != 1 {
		t.Fatalf("expected descending sort result, got %#v", parsed)
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

func TestEvaluateWithVariables(t *testing.T) {
	result, err := evaluateWithOptions(
		"",
		"$cfg.region",
		"yaml",
		"yaml",
		evaluationOptions{
			ReadFlags:  map[string]string{},
			Variables:  map[string]string{"cfg": `json:{"region":"ap-south-1"}`},
			WriteFlags: map[string]string{},
		},
	)
	if err != nil {
		t.Fatalf("expected variable-backed selector to succeed: %v", err)
	}

	if result != "ap-south-1\n" {
		t.Fatalf("expected variable-backed output %q, got %q", "ap-south-1\n", result)
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
