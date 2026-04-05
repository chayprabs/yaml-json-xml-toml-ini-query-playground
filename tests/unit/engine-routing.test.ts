import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetEngineStateForTest,
  evaluate,
  getEngineInitSnapshot,
  initEngine,
} from "@/lib/engine";

type EngineType = "dasel" | "yq";

type WorkerListener = (event: { data: unknown }) => void;

class FakeWorker {
  public static createdEngines: EngineType[] = [];

  private engine: EngineType | null = null;
  private readonly listeners = new Map<string, WorkerListener[]>();

  public constructor(_url: URL, _options: { name: string }) {}

  public addEventListener(type: string, listener: WorkerListener) {
    const nextListeners = this.listeners.get(type) ?? [];
    nextListeners.push(listener);
    this.listeners.set(type, nextListeners);
  }

  public postMessage(message: unknown) {
    const payload = message as
      | { engine: EngineType; type: "init" }
      | {
          payload: { expression: string };
          requestId: number;
          type: "evaluate";
        };

    if (payload.type === "init") {
      this.engine = payload.engine;
      FakeWorker.createdEngines.push(payload.engine);
      queueMicrotask(() => {
        this.emit("message", {
          data: {
            status: "ready",
            type: "status",
          },
        });
      });
      return;
    }

    if (payload.type === "evaluate") {
      const engine = this.engine ?? "yq";
      queueMicrotask(() => {
        this.emit("message", {
          data: {
            output: `${engine}:${payload.payload.expression}`,
            requestId: payload.requestId,
            type: "evaluate-success",
          },
        });
      });
    }
  }

  public terminate() {}

  private emit(type: string, event: { data: unknown }) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const originalWorker = globalThis.Worker;
const originalWindow = globalThis.window;

function installBrowserStubs() {
  FakeWorker.createdEngines = [];
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  globalThis.window = {
    __engineTestBootstrapOptions: {},
  } as Window & typeof globalThis;
}

function restoreBrowserStubs() {
  if (originalWorker) {
    globalThis.Worker = originalWorker;
  } else {
    delete (globalThis as { Worker?: unknown }).Worker;
  }

  if (originalWindow) {
    globalThis.window = originalWindow;
  } else {
    delete (globalThis as { window?: unknown }).window;
  }
}

test.beforeEach(() => {
  installBrowserStubs();
  __resetEngineStateForTest();
});

test.afterEach(() => {
  __resetEngineStateForTest();
  restoreBrowserStubs();
});

test("evaluate() with engine='yq' routes to the yq worker", async () => {
  await initEngine();

  const result = await evaluate("foo: bar\n", ".foo", "yaml", "yaml", "yq");

  assert.equal(result, "yq:.foo");
});

test("evaluate() with engine='dasel' routes to the dasel worker", async () => {
  await initEngine();

  const result = await evaluate(
    "foo: bar\n",
    "foo.bar",
    "yaml",
    "yaml",
    "dasel",
  );

  assert.equal(result, "dasel:foo.bar");
});

test("both engines initialize before the first call completes", async () => {
  await initEngine();

  const snapshot = getEngineInitSnapshot();

  assert.equal(snapshot.overallStatus, "ready");
  assert.deepEqual(FakeWorker.createdEngines.sort(), ["dasel", "yq"]);
});

test("switching engines mid-session keeps routing stable", async () => {
  await initEngine();

  const first = await evaluate("foo: bar\n", ".foo", "yaml", "yaml", "yq");
  const second = await evaluate(
    "foo: bar\n",
    "foo.bar",
    "yaml",
    "yaml",
    "dasel",
  );
  const third = await evaluate("foo: bar\n", ".bar", "yaml", "yaml", "yq");

  assert.equal(first, "yq:.foo");
  assert.equal(second, "dasel:foo.bar");
  assert.equal(third, "yq:.bar");
});
