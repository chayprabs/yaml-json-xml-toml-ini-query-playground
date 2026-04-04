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

func main() {
	bridge := js.FuncOf(yqEvaluateBridge)
	js.Global().Set("__yqEvaluateBridge", bridge)

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
	js.Global().Set("yqEvaluate", wrapperFactory.Invoke(bridge))
	select {}
}
