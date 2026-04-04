//go:build js && wasm

package main

import "syscall/js"

func makeBridgeResult(ok bool, value string, errMessage string) map[string]interface{} {
	return map[string]interface{}{
		"ok":    ok,
		"value": value,
		"error": errMessage,
	}
}

func yqEvaluateBridge(_ js.Value, args []js.Value) interface{} {
	if len(args) != 4 {
		return makeBridgeResult(false, "", "window.yqEvaluate expects exactly 4 arguments: input, expression, inputFormat, outputFormat")
	}

	result, err := evaluate(
		args[0].String(),
		args[1].String(),
		args[2].String(),
		args[3].String(),
	)
	if err != nil {
		return makeBridgeResult(false, "", err.Error())
	}

	return makeBridgeResult(true, result, "")
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

	return options
}

func yqEvaluateWithOptionsBridge(_ js.Value, args []js.Value) interface{} {
	if len(args) < 4 || len(args) > 5 {
		return makeBridgeResult(false, "", "window.yqEvaluateWithOptions expects 4 arguments plus an optional options object")
	}

	var optionsValue js.Value
	if len(args) == 5 {
		optionsValue = args[4]
	} else {
		optionsValue = js.Undefined()
	}

	result, err := evaluateWithOptions(
		args[0].String(),
		args[1].String(),
		args[2].String(),
		args[3].String(),
		optionsFromJS(optionsValue, args[3].String()),
	)
	if err != nil {
		return makeBridgeResult(false, "", err.Error())
	}

	return makeBridgeResult(true, result, "")
}

func main() {
	bridge := js.FuncOf(yqEvaluateBridge)
	bridgeWithOptions := js.FuncOf(yqEvaluateWithOptionsBridge)
	js.Global().Set("__yqEvaluateBridge", bridge)
	js.Global().Set("__yqEvaluateWithOptionsBridge", bridgeWithOptions)

	wrapperFactory := js.Global().Get("Function").New("bridge", `
		return function(input, expression, inputFormat, outputFormat) {
			const result = bridge(input, expression, inputFormat, outputFormat);
			if (!result || !result.ok) {
				const message = result && typeof result.error === "string" ? result.error : "Unknown yq evaluation error.";
				throw new Error(message);
			}
			return typeof result.value === "string" ? result.value : String(result.value ?? "");
		};
	`)
	wrapperFactoryWithOptions := js.Global().Get("Function").New("bridge", `
		return function(input, expression, inputFormat, outputFormat, options) {
			const result = bridge(input, expression, inputFormat, outputFormat, options ?? undefined);
			if (!result || !result.ok) {
				const message = result && typeof result.error === "string" ? result.error : "Unknown yq evaluation error.";
				throw new Error(message);
			}
			return typeof result.value === "string" ? result.value : String(result.value ?? "");
		};
	`)
	js.Global().Set("yqEvaluate", wrapperFactory.Invoke(bridge))
	js.Global().Set("yqEvaluateWithOptions", wrapperFactoryWithOptions.Invoke(bridgeWithOptions))
	select {}
}
