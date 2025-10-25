/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, test, describe, beforeEach } from "bun:test";
import * as Comlink from "../src/comlink";
import { SampleClass } from "./fixtures/sample-class";

describe("Comlink in the same realm", function () {
  const createChannel = () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    return channel;
  };

  test("can work with objects", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose({ value: 4 }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    expect(await thing.value).toBe(4);
  });

  test("can work with functions on an object", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose({ f: () => 4 }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    expect(await thing.f()).toBe(4);
  });

  test("can work with functions", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(() => 4, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    expect(await thing()).toBe(4);
  });

  test("can work with objects that have undefined properties", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose({ x: undefined }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    expect(await thing.x).toBeUndefined();
  });

  test("can keep the stack and message of thrown errors", async function () {
    const { port1, port2 } = createChannel();
    let stack: string | undefined;
    const d = Comlink.expose((): void => {
      const error = Error("OMG");
      stack = error.stack;
      throw error;
    }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    try {
      await thing();
      throw "Should have thrown";
    } catch (err: any) {
      expect(err).not.toBe("Should have thrown");
      expect(err.message).toBe("OMG");
      expect(err.stack).toBe(stack);
    }
  });

  test("can forward an async function error", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(
      {
        async throwError() {
          throw new Error("Should have thrown");
        },
      },
      port2
    );
    const thing = Comlink.wrap<typeof d>(port1);
    try {
      await thing.throwError();
    } catch (err: any) {
      expect(err.message).toBe("Should have thrown");
    }
  });

  test("can rethrow non-error objects", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose((): void => {
      throw { test: true };
    }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    try {
      await thing();
      throw "Should have thrown";
    } catch (err: any) {
      expect(err).not.toBe("Should have thrown");
      expect(err.test).toBe(true);
    }
  });

  test("can rethrow scalars", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose((): void => {
      throw "oops";
    }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    try {
      await thing();
      throw "Should have thrown";
    } catch (err) {
      expect(err).not.toBe("Should have thrown");
      expect(err).toBe("oops");
      expect(typeof err).toBe("string");
    }
  });

  test("can rethrow null", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose((): void => {
      throw null;
    }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    try {
      await thing();
      throw "Should have thrown";
    } catch (err) {
      expect(err).not.toBe("Should have thrown");
      expect(err).toBe(null);
      expect(typeof err).toBe("object");
    }
  });

  test("can work with parameterized functions", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose((a: number, b: number) => a + b, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    expect(await thing(1, 3)).toBe(4);
  });

  test("can work with functions that return promises", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(
      () => new Promise((resolve) => setTimeout(() => resolve(4), 100)),
      port2
    );
    const thing = Comlink.wrap<typeof d>(port1);
    expect(await thing()).toBe(4);
  });

  test("can work with classes", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(SampleClass, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    const instance = await new thing();
    expect(await instance.method()).toBe(4);
  });

  test("can pass parameters to class constructor", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(SampleClass, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    const instance = await new thing(23);
    expect(await instance.counter).toBe(23);
  });

  test("can access a class in an object", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose({ SampleClass }, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    const instance = await new thing.SampleClass();
    expect(await instance.method()).toBe(4);
  });

  test("can work with class instance properties", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(SampleClass, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    const instance = await new thing();
    expect(await instance._counter).toBe(1);
  });

  test("can set class instance properties", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    expect(await instance._counter).toBe(1);
    await (instance._counter = 4 as any);
    expect(await instance._counter).toBe(4);
  });

  test("can work with class instance methods", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    expect(await instance.counter).toBe(1);
    await instance.increaseCounter();
    expect(await instance.counter).toBe(2);
  });

  test("can handle throwing class instance methods", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    return instance
      .throwsAnError()
      .then((_) => Promise.reject())
      .catch((err) => {});
  });

  test("can work with class instance methods multiple times", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    expect(await instance.counter).toBe(1);
    await instance.increaseCounter();
    await instance.increaseCounter(5);
    expect(await instance.counter).toBe(7);
  });

  test("can work with class instance methods that return promises", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    expect(await instance.promiseFunc()).toBe(4);
  });

  test("can work with class instance properties that are promises", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    expect(await instance._promise).toBe(4);
  });

  test("can work with class instance getters that are promises", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(SampleClass, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    const instance = await new thing();
    expect(await instance.promise).toBe(4);
  });

  test("can work with static class properties", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    expect(await thing.SOME_NUMBER).toBe(4);
  });

  test("can work with static class methods", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    expect(await thing.ADD(1, 3)).toBe(4);
  });

  test("can work with bound class instance methods", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    expect(await instance.counter).toBe(1);
    const method = instance.increaseCounter.bind(instance);
    await method();
    expect(await instance.counter).toBe(2);
  });

  test("can work with class instance getters", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    expect(await instance.counter).toBe(1);
    await instance.increaseCounter();
    expect(await instance.counter).toBe(2);
  });

  test("can work with class instance setters", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(SampleClass, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    const instance = await new thing();
    expect(await instance._counter).toBe(1);
    await (instance.counter = 4 as any);
    expect(await instance._counter).toBe(4);
  });

  const hasBroadcastChannel = () => "BroadcastChannel" in self;
  testWhen(hasBroadcastChannel)(
    "will work with BroadcastChannel",
    async function () {
      const b1 = new BroadcastChannel("comlink_bc_test");
      const b2 = new BroadcastChannel("comlink_bc_test");
      const thing = Comlink.wrap<typeof d>(b1);
      const d = Comlink.expose((b: number) => 40 + b, b2);
      expect(await thing(2)).toBe(42);
    }
  );

  test("will transfer buffers", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose((b: ArrayBuffer) => b.byteLength, port2);
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    expect(await thing(Comlink.transfer(buffer, [buffer]))).toBe(3);
    expect(buffer.byteLength).toBe(0);
  });

  test("will copy TypedArrays", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose((b: Uint8Array) => b, port2);
    const array = new Uint8Array([1, 2, 3]);
    const receive = await thing(array);
    expect(array).not.toBe(receive);
    expect(array.byteLength).toBe(receive.byteLength);
    expect([...array]).toEqual([...receive]);
  });

  test("will copy nested TypedArrays", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(<T>(b: T) => b, port2);
    const thing = Comlink.wrap<typeof d>(port1);
    const array = new Uint8Array([1, 2, 3]);
    const data = {
      v: 1,
      array,
    };
    const receive = (await thing(data)) as typeof data;
    expect(array).not.toBe(receive.array);
    expect(array.byteLength).toBe(receive.array.byteLength);
    expect([...array]).toEqual([...receive.array]);
  });

  test("will transfer deeply nested buffers", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose((a: any): number => a.b.c.d.byteLength, port2);
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    expect(
      await thing(Comlink.transfer({ b: { c: { d: buffer } } }, [buffer]))
    ).toBe(3);
    expect(buffer.byteLength).toBe(0);
  });

  test("will transfer a message port", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose((a: MessagePort) => a.postMessage("ohai"), port2);
    const { port1: lport1, port2: lport2 } = createChannel();
    const p = new Promise<void>((resolve) => {
      lport1.onmessage = (event) => {
        expect(event.data).toBe("ohai");
        resolve();
      };
    });
    await thing(Comlink.transfer(lport2, [lport2]));
    await p;
  });

  test("will wrap marked return values", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(
      () =>
        Comlink.proxy({
          counter: 0,
          inc() {
            this.counter += 1;
          },
        }),
      port2
    );
    const obj = await thing();
    expect(await obj.counter).toBe(0);
    await obj.inc();
    expect(await obj.counter).toBe(1);
  });

  test("will wrap marked return values from class instance methods", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    const obj = await instance.proxyFunc();
    expect(await obj.counter).toBe(0);
    await obj.inc();
    expect(await obj.counter).toBe(1);
  });

  test("will wrap marked parameter values", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const local = {
      counter: 0,
      inc() {
        this.counter++;
      },
    };
    const d = Comlink.expose(async function (f: typeof local) {
      await f.inc();
    }, port2);
    expect(local.counter).toBe(0);
    await thing(Comlink.proxy(local));
    expect(await local.counter).toBe(1);
  });

  test("will wrap marked assignments", function (done) {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const obj = {
      onready: null as Function | null,
      call() {
        this.onready?.();
      },
    };
    const d = Comlink.expose(obj, port2);

    thing.onready = Comlink.proxy(() => done()) as any;
    thing.call();
  });

  test("will wrap marked parameter values, simple function", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(async function (f: Function) {
      await f();
    }, port2);
    // Weird code because Mocha
    await new Promise<void>(async (resolve) => {
      thing(Comlink.proxy(() => resolve()));
    });
  });

  test("will wrap multiple marked parameter values, simple function", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(async function (
      f1: () => number,
      f2: () => number,
      f3: () => number
    ) {
      return (await f1()) + (await f2()) + (await f3());
    },
    port2);
    // Weird code because Mocha
    expect(
      await thing(
        Comlink.proxy(() => 1),
        Comlink.proxy(() => 2),
        Comlink.proxy(() => 3)
      )
    ).toBe(6);
  });

  test("will proxy deeply nested values", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const obj = {
      a: {
        v: 4,
      },
      b: Comlink.proxy({
        v: 5,
      }),
    };
    const d = Comlink.expose(obj, port2);

    const a = await thing.a;
    const b = thing.b;
    expect(a.v).toBe(4);
    expect(await b.v).toBe(5);
    a.v = 8;
    await (b.v = Promise.resolve(9));
    // Workaround for a weird scheduling inconsistency in Firefox.
    // This test failed, but not when run in isolation, and only
    // in Firefox. I think there might be problem with task ordering.
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(await thing.a.v).toBe(4);
    expect(await thing.b.v).toBe(9);
  });

  test("will handle undefined parameters", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose({ f: (_: any) => 4 }, port2);
    expect(await thing.f(undefined)).toBe(4);
  });

  test("can handle destructuring", async function () {
    const { port1, port2 } = createChannel();
    const d = Comlink.expose(
      {
        a: 4,
        get b() {
          return 5;
        },
        c() {
          return 6;
        },
      },
      port2
    );
    const { a, b, c } = Comlink.wrap<typeof d>(port1);
    expect(await a).toBe(4);
    expect(await b).toBe(5);
    expect(await c()).toBe(6);
  });

  test("lets users define transfer handlers", function (this: any, done) {
    const { port1, port2 } = createChannel();
    Comlink.transferHandlers.set("event", {
      canHandle(obj) {
        return obj instanceof MessageEvent;
      },
      async serialize(obj: MessageEvent) {
        return [obj.data, []];
      },
      async deserialize(data) {
        return new MessageEvent("message", { data });
      },
    });

    const d = Comlink.expose((ev: MessageEvent) => {
      expect(ev).toBeInstanceOf(Event);
      expect(ev.data).toEqual({ a: 1 });
      done();
    }, port1);
    const thing = Comlink.wrap<typeof d>(port2);

    const { port1: lport1, port2: lport2 } = createChannel();
    lport1.addEventListener("message", thing.bind(this));
    lport2.postMessage({ a: 1 });
  });

  // it("can tunnels a new endpoint with createEndpoint", async function () {
  //   const d = Comlink.expose(
  //     {
  //       a: 4,
  //       c() {
  //         return 5;
  //       },
  //     },
  //     port2
  //   );
  //   const proxy = Comlink.wrap<typeof d>(port1);
  //   const otherEp = await proxy[Comlink.createEndpoint]();
  //   const otherProxy = Comlink.wrap<typeof d>(otherEp);
  //   expect(await otherProxy.a).toBe(4);
  //   expect(await proxy.a).toBe(4);
  //   expect(await otherProxy.c()).toBe(5);
  //   expect(await proxy.c()).toBe(5);
  // });

  test("released proxy should no longer be useable and throw an exception", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose(SampleClass, port2);
    const instance = await new thing();
    await instance[Symbol.asyncDispose]();
    expect(() => instance.method()).toThrow();
  });

  test("released proxy should invoke finalizer", async function () {
    const { port1, port2 } = createChannel();
    let finalized = false;
    const d = Comlink.expose(
      {
        a: "thing",
        [Symbol.dispose]: () => {
          finalized = true;
        },
      },
      port2
    );
    const instance = Comlink.wrap<typeof d>(port1);
    let a: any = instance.a;
    expect(await a).toBe("thing");
    // dispose a to ensure all related resource release.
    // in real case, a should be collected by gc, but not reliable in test
    await a[Symbol.asyncDispose]();
    await instance[Symbol.asyncDispose]();
    // wait a beat to let the events process
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(finalized).toBeTrue();
  });

  // commented out this test as it could be unreliable in various browsers as
  // it has to wait for GC to kick in which could happen at any timing
  // this does seem to work when testing locally
  testWhen(() => "Bun" in globalThis)(
    "released proxy via GC should invoke finalizer",
    async function () {
      const { port1, port2 } = createChannel();
      let finalized = false;
      const d = Comlink.expose(
        {
          a: "thing",
          [Symbol.dispose]: () => {
            finalized = true;
          },
        },
        port2
      );

      const registry = new FinalizationRegistry((heldValue: Function) => {
        heldValue();
      });
      // promise will resolve when the proxy is garbage collected
      await new Promise(async (resolve, reject) => {
        {
          const instance = Comlink.wrap<typeof d>(port1);
          registry.register(instance, resolve);
          expect(await instance.a).toBe("thing");
        }
        Bun?.gc(true);
      });
      // wait for finalizer to fire
      await new Promise((resolve) => setTimeout(resolve));
      // wait for release message to complete
      await new Promise((resolve) => setTimeout(resolve));
      expect(finalized).toBeTrue();
    }
  );

  test("can proxy with a given target", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose({ value: 4 }, port2);
    expect(await thing.value).toBe(4);
  });

  test("can handle unserializable types", async function () {
    const { port1, port2 } = createChannel();
    const thing = Comlink.wrap<typeof d>(port1);
    const d = Comlink.expose({ value: () => "boom" }, port2);

    try {
      await thing.value;
    } catch (err: any) {
      expect(err.message).toBe("Unserializable return value");
    }
  });
});

function testWhen(f: () => boolean) {
  return f() ? test : test.skip;
}
