package main

import (
	"fmt"
	"strings"
	"sync"

	core "enginecore"
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
	PrettyPrint  bool
	UnwrapScalar bool
	debugPanic   bool
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
		UnwrapScalar: format == string(outputYAML) || format == string(outputJSON) || format == string(outputProps),
	}
}

func initExpressionParser() {
	expressionParserOnce.Do(core.InitExpressionParser)
}

func newDecoder(format string) (core.Decoder, error) {
	switch inputFormat(format) {
	case inputYAML:
		yamlPreferences := core.NewDefaultYamlPreferences()
		return core.NewYamlDecoder(yamlPreferences), nil
	case inputJSON:
		return core.NewJSONDecoder(), nil
	case inputXML:
		xmlPreferences := core.NewDefaultXmlPreferences()
		return core.NewXMLDecoder(xmlPreferences), nil
	case inputCSV:
		csvPreferences := core.NewDefaultCsvPreferences()
		return core.NewCSVObjectDecoder(csvPreferences), nil
	case inputTOML:
		return core.NewTomlDecoder(), nil
	default:
		return nil, fmt.Errorf("unsupported input format %q", format)
	}
}

func newEncoder(format string, options evaluationOptions) (core.Encoder, error) {
	switch outputFormat(format) {
	case outputYAML:
		yamlPreferences := core.NewDefaultYamlPreferences()
		yamlPreferences.Indent = 2
		yamlPreferences.ColorsEnabled = false
		yamlPreferences.PrintDocSeparators = !options.NoDoc
		yamlPreferences.UnwrapScalar = options.UnwrapScalar
		return core.NewYamlEncoder(yamlPreferences), nil
	case outputJSON:
		jsonPreferences := core.NewDefaultJsonPreferences()
		jsonPreferences.Indent = 2
		jsonPreferences.ColorsEnabled = false
		jsonPreferences.UnwrapScalar = options.UnwrapScalar
		return core.NewJSONEncoder(jsonPreferences), nil
	case outputXML:
		xmlPreferences := core.NewDefaultXmlPreferences()
		xmlPreferences.Indent = 2
		return core.NewXMLEncoder(xmlPreferences), nil
	case outputCSV:
		csvPreferences := core.NewDefaultCsvPreferences()
		return core.NewCsvEncoder(csvPreferences), nil
	case outputTOML:
		tomlPreferences := core.NewDefaultTomlPreferences()
		tomlPreferences.ColorsEnabled = false
		return core.NewTomlEncoderWithPrefs(tomlPreferences), nil
	case outputProps:
		propertiesPreferences := core.NewDefaultPropertiesPreferences()
		propertiesPreferences.UnwrapScalar = options.UnwrapScalar
		return core.NewPropertiesEncoder(propertiesPreferences), nil
	default:
		return nil, fmt.Errorf("unsupported output format %q", format)
	}
}

func safeEvaluateWithOptions(
	input string,
	expression string,
	inFormat string,
	outFormat string,
	options evaluationOptions,
) (result string, err error) {
	defer func() {
		if recover() != nil {
			err = fmt.Errorf("an internal error occurred")
		}
	}()

	if options.debugPanic {
		panic("debug panic requested")
	}

	inputFormatName := normalizeFormat(inFormat)
	outputFormatName := normalizeFormat(outFormat)

	if strings.TrimSpace(expression) == "" {
		return "", fmt.Errorf("expression is required: enter an expression before running")
	}

	if strings.TrimSpace(input) == "" {
		return "", fmt.Errorf("input is required: paste a document before running")
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

	expressionToEvaluate := expression
	if options.PrettyPrint {
		expressionToEvaluate = fmt.Sprintf("%s | %s", expression, core.PrettyPrintExp)
	}

	return core.NewStringEvaluator().Evaluate(expressionToEvaluate, input, encoder, decoder)
}

func evaluateWithOptions(
	input string,
	expression string,
	inFormat string,
	outFormat string,
	options evaluationOptions,
) (string, error) {
	return safeEvaluateWithOptions(input, expression, inFormat, outFormat, options)
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
