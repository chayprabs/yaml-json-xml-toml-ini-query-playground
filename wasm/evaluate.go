package main

import (
	"fmt"
	"strings"
	"sync"

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

type evaluationOptions struct {
	NoDoc        bool
	UnwrapScalar bool
}

var expressionParserOnce sync.Once

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

func defaultEvaluationOptions(format string) evaluationOptions {
	return evaluationOptions{
		NoDoc:        false,
		UnwrapScalar: format == string(outputYAML) || format == string(outputProps),
	}
}

func initExpressionParser() {
	expressionParserOnce.Do(yqlib.InitExpressionParser)
}

func newDecoder(format string) (yqlib.Decoder, error) {
	switch inputFormat(format) {
	case inputYAML:
		yamlPreferences := yqlib.NewDefaultYamlPreferences()
		return yqlib.NewYamlDecoder(yamlPreferences), nil
	case inputJSON:
		return yqlib.NewJSONDecoder(), nil
	case inputXML:
		xmlPreferences := yqlib.NewDefaultXmlPreferences()
		return yqlib.NewXMLDecoder(xmlPreferences), nil
	case inputCSV:
		csvPreferences := yqlib.NewDefaultCsvPreferences()
		return yqlib.NewCSVObjectDecoder(csvPreferences), nil
	case inputTOML:
		return yqlib.NewTomlDecoder(), nil
	default:
		return nil, fmt.Errorf("unsupported input format %q", format)
	}
}

func newEncoder(format string, options evaluationOptions) (yqlib.Encoder, error) {
	switch outputFormat(format) {
	case outputYAML:
		yamlPreferences := yqlib.NewDefaultYamlPreferences()
		yamlPreferences.Indent = 2
		yamlPreferences.ColorsEnabled = false
		yamlPreferences.PrintDocSeparators = !options.NoDoc
		yamlPreferences.UnwrapScalar = options.UnwrapScalar
		return yqlib.NewYamlEncoder(yamlPreferences), nil
	case outputJSON:
		jsonPreferences := yqlib.NewDefaultJsonPreferences()
		jsonPreferences.Indent = 2
		jsonPreferences.ColorsEnabled = false
		jsonPreferences.UnwrapScalar = options.UnwrapScalar
		return yqlib.NewJSONEncoder(jsonPreferences), nil
	case outputXML:
		xmlPreferences := yqlib.NewDefaultXmlPreferences()
		xmlPreferences.Indent = 2
		return yqlib.NewXMLEncoder(xmlPreferences), nil
	case outputCSV:
		csvPreferences := yqlib.NewDefaultCsvPreferences()
		return yqlib.NewCsvEncoder(csvPreferences), nil
	case outputTOML:
		tomlPreferences := yqlib.NewDefaultTomlPreferences()
		tomlPreferences.ColorsEnabled = false
		return yqlib.NewTomlEncoderWithPrefs(tomlPreferences), nil
	case outputProps:
		propertiesPreferences := yqlib.NewDefaultPropertiesPreferences()
		propertiesPreferences.UnwrapScalar = options.UnwrapScalar
		return yqlib.NewPropertiesEncoder(propertiesPreferences), nil
	default:
		return nil, fmt.Errorf("unsupported output format %q", format)
	}
}

func evaluateWithOptions(
	input string,
	expression string,
	inFormat string,
	outFormat string,
	options evaluationOptions,
) (string, error) {
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

	decoder, err := newDecoder(inputFormatName)
	if err != nil {
		return "", err
	}

	encoder, err := newEncoder(outputFormatName, options)
	if err != nil {
		return "", err
	}

	initExpressionParser()

	return yqlib.NewStringEvaluator().Evaluate(expression, input, encoder, decoder)
}

func evaluate(input string, expression string, inFormat string, outFormat string) (string, error) {
	return evaluateWithOptions(
		input,
		expression,
		inFormat,
		outFormat,
		defaultEvaluationOptions(normalizeFormat(outFormat)),
	)
}
