//go:build js && wasm

package main

import (
	"fmt"
	"syscall/js"
)

func makeBridgeResult(ok bool, value string, errMessage string) map[string]interface{} {
	return map[string]interface{}{
		"ok":    ok,
		"value": value,
		"error": errMessage,
	}
}

type bridgeArguments struct {
	Input        string
	Expression   string
	InputFormat  string
	OutputFormat string
}

func parseStringArgument(args []js.Value, index int, label string) (string, error) {
	if index >= len(args) {
		return "", fmt.Errorf("%s is required", label)
	}

	value := args[index]
	if value.IsUndefined() || value.IsNull() || value.Type() != js.TypeString {
		return "", fmt.Errorf("%s must be a string", label)
	}

	return value.String(), nil
}

func parseBridgeArguments(args []js.Value) (bridgeArguments, error) {
	input, err := parseStringArgument(args, 0, "input")
	if err != nil {
		return bridgeArguments{}, err
	}

	expression, err := parseStringArgument(args, 1, "expression")
	if err != nil {
		return bridgeArguments{}, err
	}

	inputFormat, err := parseStringArgument(args, 2, "inputFormat")
	if err != nil {
		return bridgeArguments{}, err
	}

	outputFormat, err := parseStringArgument(args, 3, "outputFormat")
	if err != nil {
		return bridgeArguments{}, err
	}

	return bridgeArguments{
		Input:        input,
		Expression:   expression,
		InputFormat:  inputFormat,
		OutputFormat: outputFormat,
	}, nil
}

func optionsFromJS(value js.Value, outFormat string) evaluationOptions {
	options := defaultEvaluationOptions(normalizeFormat(outFormat))
	if value.IsUndefined() || value.IsNull() || value.Type() != js.TypeObject {
		return options
	}

	if noDoc := value.Get("noDoc"); noDoc.Type() == js.TypeBoolean {
		options.NoDoc = noDoc.Bool()
	}

	if prettyPrint := value.Get("prettyPrint"); prettyPrint.Type() == js.TypeBoolean {
		options.PrettyPrint = prettyPrint.Bool()
	}

	if unwrapScalar := value.Get("unwrapScalar"); unwrapScalar.Type() == js.TypeBoolean {
		options.UnwrapScalar = unwrapScalar.Bool()
	}

	if debugPanic := value.Get("__debugPanic"); debugPanic.Type() == js.TypeBoolean {
		options.debugPanic = debugPanic.Bool()
	}

	return options
}

func runBridge(
	evaluator func() (string, error),
) (result map[string]interface{}) {
	defer func() {
		if recover() != nil {
			result = makeBridgeResult(false, "", "An internal error occurred.")
		}
	}()

	value, err := evaluator()
	if err != nil {
		return makeBridgeResult(false, "", err.Error())
	}

	return makeBridgeResult(true, value, "")
}

func evaluateBridge(_ js.Value, args []js.Value) interface{} {
	if len(args) != 4 {
		return makeBridgeResult(false, "", "window.engineEvaluate expects exactly 4 arguments: input, expression, inputFormat, outputFormat")
	}

	return runBridge(func() (string, error) {
		parsedArgs, err := parseBridgeArguments(args)
		if err != nil {
			return "", err
		}

		return evaluate(
			parsedArgs.Input,
			parsedArgs.Expression,
			parsedArgs.InputFormat,
			parsedArgs.OutputFormat,
		)
	})
}

func evaluateWithOptionsBridge(_ js.Value, args []js.Value) interface{} {
	if len(args) < 4 || len(args) > 5 {
		return makeBridgeResult(false, "", "window.engineEvaluateWithOptions expects 4 arguments plus an optional options object")
	}

	var optionsValue js.Value
	if len(args) == 5 {
		optionsValue = args[4]
	} else {
		optionsValue = js.Undefined()
	}

	return runBridge(func() (string, error) {
		parsedArgs, err := parseBridgeArguments(args)
		if err != nil {
			return "", err
		}

		return evaluateWithOptions(
			parsedArgs.Input,
			parsedArgs.Expression,
			parsedArgs.InputFormat,
			parsedArgs.OutputFormat,
			optionsFromJS(optionsValue, parsedArgs.OutputFormat),
		)
	})
}

func main() {
	bridge := js.FuncOf(evaluateBridge)
	bridgeWithOptions := js.FuncOf(evaluateWithOptionsBridge)
	js.Global().Set("__engineEvaluateBridge", bridge)
	js.Global().Set("__engineEvaluateWithOptionsBridge", bridgeWithOptions)

	wrapperFactory := js.Global().Get("Function").New("bridge", `
		return function(input, expression, inputFormat, outputFormat) {
			const result = bridge(input, expression, inputFormat, outputFormat);
			if (!result || !result.ok) {
				const message = result && typeof result.error === "string" ? result.error : "Unknown evaluation error.";
				throw new Error(message);
			}
			return typeof result.value === "string" ? result.value : String(result.value ?? "");
		};
	`)
	wrapperFactoryWithOptions := js.Global().Get("Function").New("bridge", `
		return function(input, expression, inputFormat, outputFormat, options) {
			const result = bridge(input, expression, inputFormat, outputFormat, options ?? undefined);
			if (!result || !result.ok) {
				const message = result && typeof result.error === "string" ? result.error : "Unknown evaluation error.";
				throw new Error(message);
			}
			return typeof result.value === "string" ? result.value : String(result.value ?? "");
		};
	`)
	js.Global().Set("engineEvaluate", wrapperFactory.Invoke(bridge))
	js.Global().Set("engineEvaluateWithOptions", wrapperFactoryWithOptions.Invoke(bridgeWithOptions))

	done := make(chan struct{})
	<-done
}
