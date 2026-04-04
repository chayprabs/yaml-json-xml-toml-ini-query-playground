//go:build js && wasm

package main

import "syscall/js"

func jsError(message string) js.Error {
	return js.Error{Value: js.Global().Get("Error").New(message)}
}

func yqEvaluate(_ js.Value, args []js.Value) any {
	if len(args) != 4 {
		panic(jsError("window.yqEvaluate expects exactly 4 arguments: input, expression, inputFormat, outputFormat"))
	}

	result, err := evaluate(
		args[0].String(),
		args[1].String(),
		args[2].String(),
		args[3].String(),
	)
	if err != nil {
		panic(jsError(err.Error()))
	}

	return result
}

func main() {
	js.Global().Set("yqEvaluate", js.FuncOf(yqEvaluate))
	select {}
}
