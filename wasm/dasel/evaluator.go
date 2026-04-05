package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/tomwright/dasel/v3/execution"
	"github.com/tomwright/dasel/v3/model"
	"github.com/tomwright/dasel/v3/parsing"
	_ "github.com/tomwright/dasel/v3/parsing/csv"
	_ "github.com/tomwright/dasel/v3/parsing/d"
	_ "github.com/tomwright/dasel/v3/parsing/hcl"
	_ "github.com/tomwright/dasel/v3/parsing/ini"
	_ "github.com/tomwright/dasel/v3/parsing/json"
	_ "github.com/tomwright/dasel/v3/parsing/toml"
	_ "github.com/tomwright/dasel/v3/parsing/xml"
	_ "github.com/tomwright/dasel/v3/parsing/yaml"
)

type inputFormat string
type outputFormat string

const (
	inputYAML inputFormat = "yaml"
	inputJSON inputFormat = "json"
	inputXML  inputFormat = "xml"
	inputCSV  inputFormat = "csv"
	inputTOML inputFormat = "toml"
	inputINI  inputFormat = "ini"
	inputHCL  inputFormat = "hcl"

	outputYAML outputFormat = "yaml"
	outputJSON outputFormat = "json"
	outputXML  outputFormat = "xml"
	outputCSV  outputFormat = "csv"
	outputTOML outputFormat = "toml"
	outputINI  outputFormat = "ini"
	outputHCL  outputFormat = "hcl"
)

type evaluationOptions struct {
	ReadFlags  map[string]string
	ReturnRoot bool
	Unstable   bool
	Variables  map[string]string
	WriteFlags map[string]string
	debugPanic bool
}

func normalizeFormat(format string) string {
	return strings.ToLower(strings.TrimSpace(format))
}

func validateInputFormat(format string) error {
	switch inputFormat(format) {
	case inputYAML, inputJSON, inputXML, inputCSV, inputTOML, inputINI, inputHCL:
		return nil
	default:
		return fmt.Errorf("unsupported input format %q", format)
	}
}

func validateOutputFormat(format string) error {
	switch outputFormat(format) {
	case outputYAML, outputJSON, outputXML, outputCSV, outputTOML, outputINI, outputHCL:
		return nil
	default:
		return fmt.Errorf("unsupported output format %q", format)
	}
}

func defaultEvaluationOptions() evaluationOptions {
	return evaluationOptions{
		ReadFlags:  map[string]string{},
		ReturnRoot: false,
		Unstable:   false,
		Variables:  map[string]string{},
		WriteFlags: map[string]string{},
	}
}

func newReaderOptions(options evaluationOptions) parsing.ReaderOptions {
	readerOptions := parsing.DefaultReaderOptions()
	for key, value := range options.ReadFlags {
		readerOptions.Ext[key] = value
	}
	return readerOptions
}

func newWriterOptions(options evaluationOptions) parsing.WriterOptions {
	writerOptions := parsing.DefaultWriterOptions()
	for key, value := range options.WriteFlags {
		writerOptions.Ext[key] = value
	}
	return writerOptions
}

func newVariableOptions(options evaluationOptions) ([]execution.ExecuteOptionFn, error) {
	var executeOptions []execution.ExecuteOptionFn

	for key, rawValue := range options.Variables {
		format := "dasel"
		valueRaw := rawValue

		firstSplit := strings.SplitN(valueRaw, ":", 2)
		if len(firstSplit) == 2 {
			format = firstSplit[0]
			valueRaw = firstSplit[1]
		}

		if strings.HasPrefix(valueRaw, "file:") {
			return nil, fmt.Errorf("file-backed dasel variables are not supported in the browser")
		}

		reader, err := parsing.Format(format).NewReader(parsing.DefaultReaderOptions())
		if err != nil {
			return nil, fmt.Errorf("failed to create variable reader for %s: %w", key, err)
		}

		value, err := reader.Read([]byte(valueRaw))
		if err != nil {
			return nil, fmt.Errorf("failed to read variable %s: %w", key, err)
		}

		executeOptions = append(executeOptions, execution.WithVariable(key, value))
	}

	return executeOptions, nil
}

func safeEvaluateWithOptions(
	input string,
	selector string,
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

	if strings.TrimSpace(selector) == "" {
		return "", fmt.Errorf("selector is required: enter a selector before running")
	}

	if err := validateInputFormat(inputFormatName); err != nil {
		return "", err
	}

	if err := validateOutputFormat(outputFormatName); err != nil {
		return "", err
	}

	reader, err := parsing.Format(inputFormatName).NewReader(newReaderOptions(options))
	if err != nil {
		return "", fmt.Errorf("failed to get input reader: %w", err)
	}

	writer, err := parsing.Format(outputFormatName).NewWriter(newWriterOptions(options))
	if err != nil {
		return "", fmt.Errorf("failed to get output writer: %w", err)
	}

	inputData := model.NewNullValue()
	if strings.TrimSpace(input) != "" {
		inputData, err = reader.Read([]byte(input))
		if err != nil {
			return "", fmt.Errorf("failed to read input: %w", err)
		}
	}

	executeOptions := []execution.ExecuteOptionFn{
		execution.WithVariable("root", inputData),
	}
	variableOptions, err := newVariableOptions(options)
	if err != nil {
		return "", err
	}
	executeOptions = append(executeOptions, variableOptions...)
	if options.Unstable {
		executeOptions = append(executeOptions, execution.WithUnstable())
	}

	out, err := execution.ExecuteSelector(
		context.Background(),
		selector,
		inputData,
		execution.NewOptions(executeOptions...),
	)
	if err != nil {
		return "", err
	}

	if options.ReturnRoot {
		out = inputData
	}

	outputBytes, err := writer.Write(out)
	if err != nil {
		return "", fmt.Errorf("failed to write output: %w", err)
	}

	return string(outputBytes), nil
}

func evaluateWithOptions(
	input string,
	selector string,
	inFormat string,
	outFormat string,
	options evaluationOptions,
) (string, error) {
	return safeEvaluateWithOptions(input, selector, inFormat, outFormat, options)
}

func evaluate(input string, selector string, inFormat string, outFormat string) (string, error) {
	return evaluateWithOptions(
		input,
		selector,
		inFormat,
		outFormat,
		defaultEvaluationOptions(),
	)
}
