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
	InputFormat  string
	OutputFormat string
	Selector     string
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

	selector, err := parseStringArgument(args, 1, "selector")
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
		InputFormat:  inputFormat,
		OutputFormat: outputFormat,
		Selector:     selector,
	}, nil
}

func parseStringMap(value js.Value) map[string]string {
	result := map[string]string{}
	if value.IsUndefined() || value.IsNull() || value.Type() != js.TypeObject {
		return result
	}

	keys := js.Global().Get("Object").Call("keys", value)
	for index := 0; index < keys.Length(); index++ {
		key := keys.Index(index).String()
		itemValue := value.Get(key)
		if itemValue.Type() == js.TypeString {
			result[key] = itemValue.String()
		}
	}

	return result
}

func optionsFromJS(value js.Value) evaluationOptions {
	options := defaultEvaluationOptions()
	if value.IsUndefined() || value.IsNull() || value.Type() != js.TypeObject {
		return options
	}

	if returnRoot := value.Get("returnRoot"); returnRoot.Type() == js.TypeBoolean {
		options.ReturnRoot = returnRoot.Bool()
	}

	if unstable := value.Get("unstable"); unstable.Type() == js.TypeBoolean {
		options.Unstable = unstable.Bool()
	}

	if debugPanic := value.Get("__debugPanic"); debugPanic.Type() == js.TypeBoolean {
		options.debugPanic = debugPanic.Bool()
	}

	options.ReadFlags = parseStringMap(value.Get("readFlags"))
	options.Variables = parseStringMap(value.Get("variables"))
	options.WriteFlags = parseStringMap(value.Get("writeFlags"))

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
		return makeBridgeResult(false, "", "window.daselEvaluate expects exactly 4 arguments: input, selector, inputFormat, outputFormat")
	}

	return runBridge(func() (string, error) {
		parsedArgs, err := parseBridgeArguments(args)
		if err != nil {
			return "", err
		}

		return evaluate(
			parsedArgs.Input,
			parsedArgs.Selector,
			parsedArgs.InputFormat,
			parsedArgs.OutputFormat,
		)
	})
}

func evaluateWithOptionsBridge(_ js.Value, args []js.Value) interface{} {
	if len(args) < 4 || len(args) > 5 {
		return makeBridgeResult(false, "", "window.daselEvaluateWithOptions expects 4 arguments plus an optional options object")
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
			parsedArgs.Selector,
			parsedArgs.InputFormat,
			parsedArgs.OutputFormat,
			optionsFromJS(optionsValue),
		)
	})
}

func main() {
	bridge := js.FuncOf(evaluateBridge)
	bridgeWithOptions := js.FuncOf(evaluateWithOptionsBridge)
	js.Global().Set("__daselEvaluateBridge", bridge)
	js.Global().Set("__daselEvaluateWithOptionsBridge", bridgeWithOptions)

	wrapperFactory := js.Global().Get("Function").New("bridge", `
		return function(input, selector, inputFormat, outputFormat) {
			const result = bridge(input, selector, inputFormat, outputFormat);
			if (!result || !result.ok) {
				const message = result && typeof result.error === "string" ? result.error : "Unknown evaluation error.";
				throw new Error(message);
			}
			return typeof result.value === "string" ? result.value : String(result.value ?? "");
		};
	`)
	wrapperFactoryWithOptions := js.Global().Get("Function").New("bridge", `
		return function(input, selector, inputFormat, outputFormat, options) {
			const result = bridge(input, selector, inputFormat, outputFormat, options ?? undefined);
			if (!result || !result.ok) {
				const message = result && typeof result.error === "string" ? result.error : "Unknown evaluation error.";
				throw new Error(message);
			}
			return typeof result.value === "string" ? result.value : String(result.value ?? "");
		};
	`)
	js.Global().Set("daselEvaluate", wrapperFactory.Invoke(bridge))
	js.Global().Set("daselEvaluateWithOptions", wrapperFactoryWithOptions.Invoke(bridgeWithOptions))

	done := make(chan struct{})
	<-done
}
