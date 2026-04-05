import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetEngineStateForTest,
  evaluate,
  getEngineInitSnapshot,
  initEngine,
  type EngineType,
} from "@/lib/engine";
import type {
  EngineEvaluateOptions,
  InputFormat,
  OutputFormat,
} from "@/lib/engine-types";

type InitMessage = {
  engine: EngineType;
  testDisableWebAssembly?: boolean;
  type: "init";
};

type EvaluateMessage = {
  payload: {
    expression: string;
    input: string;
    inputFormat: InputFormat;
    options: EngineEvaluateOptions;
    outputFormat: OutputFormat;
  };
  requestId: number;
  type: "evaluate";
};

type DelayMessage = {
  delayMs: number;
  type: "test-delay-next-evaluation";
};

type PanicMessage = {
  type: "test-panic-next-evaluation";
};

type WorkerRequest =
  | DelayMessage
  | EvaluateMessage
  | InitMessage
  | PanicMessage;

type WorkerResponse =
  | {
      message?: string;
      status:
        | "idle"
        | "loading-runtime"
        | "fetching-wasm"
        | "instantiating-wasm"
        | "starting-go"
        | "ready"
        | "error";
      type: "status";
    }
  | {
      output: string;
      requestId: number;
      type: "evaluate-success";
    }
  | {
      message: string;
      requestId: number;
      type: "evaluate-error";
    };

type WorkerBehavior = {
  autoReady?: boolean;
  evaluateResult?: (
    message: EvaluateMessage,
    engine: EngineType,
  ) => {
    error?: string;
    output?: string;
  };
  initError?: string;
};

const workerBehaviors: Record<EngineType, WorkerBehavior> = {
  dasel: {},
  yq: {},
};

const workerInstances: FakeWorker[] = [];

class FakeWorker {
  engine: EngineType | null = null;
  listeners: {
    error: Set<(event: Event) => void>;
    message: Set<(event: MessageEvent<WorkerResponse>) => void>;
    messageerror: Set<(event: MessageEvent<unknown>) => void>;
  } = {
    error: new Set(),
    message: new Set(),
    messageerror: new Set(),
  };
  postedMessages: WorkerRequest[] = [];

  constructor(_url: URL, _options?: WorkerOptions) {
    workerInstances.push(this);
  }

  addEventListener(
    type: "error" | "message" | "messageerror",
    listener:
      | ((event: Event) => void)
      | ((event: MessageEvent<WorkerResponse>) => void)
      | ((event: MessageEvent<unknown>) => void),
  ) {
    if (type === "message") {
      this.listeners.message.add(
        listener as (event: MessageEvent<WorkerResponse>) => void,
      );
      return;
    }

    if (type === "messageerror") {
      this.listeners.messageerror.add(
        listener as (event: MessageEvent<unknown>) => void,
      );
      return;
    }

    this.listeners.error.add(listener as (event: Event) => void);
  }

  postMessage(message: WorkerRequest) {
    this.postedMessages.push(message);

    if (message.type === "init") {
      this.engine = message.engine;
      queueMicrotask(() => {
        this.emit({
          status: "loading-runtime",
          type: "status",
        });
      });

      const behavior = workerBehaviors[message.engine];
      if (behavior.autoReady === false) {
        return;
      }

      queueMicrotask(() => {
        if (behavior.initError) {
          this.emit({
            message: behavior.initError,
            status: "error",
            type: "status",
          });
          return;
        }

        this.emit({
          status: "ready",
          type: "status",
        });
      });

      return;
    }

    if (message.type !== "evaluate") {
      return;
    }

    assert.ok(this.engine, "worker engine should be known before evaluation");
    const behavior = workerBehaviors[this.engine];
    const result = behavior.evaluateResult?.(message, this.engine) ?? {
      output: `${this.engine}:${message.payload.expression}`,
    };

    queueMicrotask(() => {
      if (result.error) {
        this.emit({
          message: result.error,
          requestId: message.requestId,
          type: "evaluate-error",
        });
        return;
      }

      this.emit({
        output: result.output ?? "",
        requestId: message.requestId,
        type: "evaluate-success",
      });
    });
  }

  terminate() {
    // No-op for tests.
  }

  emitReady() {
    this.emit({
      status: "ready",
      type: "status",
    });
  }

  private emit(message: WorkerResponse) {
    for (const listener of this.listeners.message) {
      listener({ data: message } as MessageEvent<WorkerResponse>);
    }
  }
}

function installBrowserStubs() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __engineTestBootstrapOptions: undefined,
    },
    writable: true,
  });

  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: FakeWorker,
    writable: true,
  });
}

function removeBrowserStubs() {
  Reflect.deleteProperty(globalThis, "Worker");
  Reflect.deleteProperty(globalThis, "window");
}

test.beforeEach(() => {
  workerBehaviors.yq = {};
  workerBehaviors.dasel = {};
  workerInstances.length = 0;
  installBrowserStubs();
  __resetEngineStateForTest();
});

test.afterEach(() => {
  __resetEngineStateForTest();
  removeBrowserStubs();
});

test("routes evaluate() to the selected engine worker", async () => {
  await initEngine();

  const yqOutput = await evaluate("foo: bar\n", ".foo", "yaml", "yaml", "yq");
  const daselOutput = await evaluate(
    "foo: bar\n",
    "foo",
    "yaml",
    "yaml",
    "dasel",
  );

  assert.equal(yqOutput, "yq:.foo");
  assert.equal(daselOutput, "dasel:foo");

  const yqWorker = workerInstances.find((worker) => worker.engine === "yq");
  const daselWorker = workerInstances.find(
    (worker) => worker.engine === "dasel",
  );

  assert.ok(yqWorker);
  assert.ok(daselWorker);
  assert.ok(
    yqWorker.postedMessages.some(
      (message) =>
        message.type === "evaluate" && message.payload.expression === ".foo",
    ),
  );
  assert.ok(
    daselWorker.postedMessages.some(
      (message) =>
        message.type === "evaluate" && message.payload.expression === "foo",
    ),
  );
});

test("initializes both engines in parallel before the combined init promise resolves", async () => {
  workerBehaviors.yq.autoReady = false;
  workerBehaviors.dasel.autoReady = false;

  let settled = false;
  const initPromise = initEngine().then(() => {
    settled = true;
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.equal(workerInstances.length, 2);
  assert.ok(
    workerInstances.every((worker) =>
      worker.postedMessages.some((message) => message.type === "init"),
    ),
  );
  assert.equal(settled, false);

  workerInstances.find((worker) => worker.engine === "yq")?.emitReady();
  await Promise.resolve();
  assert.equal(settled, false);

  workerInstances.find((worker) => worker.engine === "dasel")?.emitReady();
  await initPromise;
  assert.equal(settled, true);
});

test("partial engine failure leaves yq usable when dasel fails to initialize", async () => {
  workerBehaviors.dasel.initError =
    "Failed to load expression engine. Please refresh.";

  await initEngine();

  const snapshot = getEngineInitSnapshot();
  assert.equal(snapshot.engines.yq.status, "ready");
  assert.equal(snapshot.engines.dasel.status, "error");
  assert.equal(snapshot.overallStatus, "error");

  const yqOutput = await evaluate("foo: bar\n", ".foo", "yaml", "yaml", "yq");
  assert.equal(yqOutput, "yq:.foo");

  await assert.rejects(
    () => evaluate("foo: bar\n", "foo", "yaml", "yaml", "dasel"),
    /Failed to load expression engine|unavailable/i,
  );
});
