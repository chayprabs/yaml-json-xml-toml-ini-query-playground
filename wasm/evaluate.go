package main

import (
	"fmt"
	"strings"

	"github.com/mikefarah/yq/v4/pkg/yqlib"
)

type inputFormat string
type outputFormat string

const (
	inputYAML inputFormat = "yaml"
	inputJSON inputFormat = "json"
	inputXML  inputFormat = "xml"
	inputCSV  inputFormat = "csv"
	inputTOML inputFormat = "toml"

	outputYAML  outputFormat = "yaml"
	outputJSON  outputFormat = "json"
	outputXML   outputFormat = "xml"
	outputCSV   outputFormat = "csv"
	outputTOML  outputFormat = "toml"
	outputProps outputFormat = "props"
)

func normalizeFormat(format string) string {
	return strings.ToLower(strings.TrimSpace(format))
}

func validateInputFormat(format string) error {
	switch inputFormat(format) {
	case inputYAML, inputJSON, inputXML, inputCSV, inputTOML:
		return nil
	default:
		return fmt.Errorf("unsupported input format %q", format)
	}
}

func validateOutputFormat(format string) error {
	switch outputFormat(format) {
	case outputYAML, outputJSON, outputXML, outputCSV, outputTOML, outputProps:
		return nil
	default:
		return fmt.Errorf("unsupported output format %q", format)
	}
}

func configureYqPreferences(format string) {
	yqlib.ConfiguredYamlPreferences.Indent = 2
	yqlib.ConfiguredYamlPreferences.UnwrapScalar = format == string(outputYAML)
	yqlib.ConfiguredYamlPreferences.ColorsEnabled = false
	yqlib.ConfiguredYamlPreferences.PrintDocSeparators = true

	yqlib.ConfiguredJSONPreferences.Indent = 2
	yqlib.ConfiguredJSONPreferences.UnwrapScalar = false
	yqlib.ConfiguredJSONPreferences.ColorsEnabled = false

	yqlib.ConfiguredXMLPreferences.Indent = 2
	yqlib.ConfiguredXMLPreferences.StrictMode = false

	yqlib.ConfiguredCsvPreferences.AutoParse = true
	yqlib.ConfiguredPropertiesPreferences.UnwrapScalar = format == string(outputProps)
	yqlib.ConfiguredTomlPreferences.ColorsEnabled = false
	yqlib.ConfiguredKYamlPreferences.Indent = 2
	yqlib.ConfiguredKYamlPreferences.UnwrapScalar = false
	yqlib.ConfiguredKYamlPreferences.ColorsEnabled = false
	yqlib.ConfiguredKYamlPreferences.PrintDocSeparators = true
}

func evaluate(input string, expression string, inFormat string, outFormat string) (string, error) {
	inputFormatName := normalizeFormat(inFormat)
	outputFormatName := normalizeFormat(outFormat)

	if strings.TrimSpace(expression) == "" {
		return "", fmt.Errorf("Expression is required. Enter a yq expression before running.")
	}

	if strings.TrimSpace(input) == "" {
		return "", fmt.Errorf("Input is required. Paste a document before running yq.")
	}

	if err := validateInputFormat(inputFormatName); err != nil {
		return "", err
	}

	if err := validateOutputFormat(outputFormatName); err != nil {
		return "", err
	}

	configureYqPreferences(outputFormatName)
	yqlib.InitExpressionParser()

	decoderFormat, err := yqlib.FormatFromString(inputFormatName)
	if err != nil {
		return "", err
	}
	if decoderFormat.DecoderFactory == nil {
		return "", fmt.Errorf("no support for %s input format", inputFormatName)
	}

	encoderFormat, err := yqlib.FormatFromString(outputFormatName)
	if err != nil {
		return "", err
	}
	if encoderFormat.EncoderFactory == nil {
		return "", fmt.Errorf("no support for %s output format", outputFormatName)
	}

	decoder := decoderFormat.DecoderFactory()
	encoder := encoderFormat.EncoderFactory()
	if decoder == nil {
		return "", fmt.Errorf("no support for %s input format", inputFormatName)
	}
	if encoder == nil {
		return "", fmt.Errorf("no support for %s output format", outputFormatName)
	}

	return yqlib.NewStringEvaluator().Evaluate(expression, input, encoder, decoder)
}
