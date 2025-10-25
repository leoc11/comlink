import { expect, test, describe } from "bun:test";
import {
  expose,
  proxy,
  proxyRemoteData,
  Remote,
  UnProxyMarked,
  wrap,
} from "../src/comlink";
import worker_1 from "./fixtures/worker_1";
import worker_2 from "./fixtures/worker_2";
import { BunWorkerPatched } from "./mocks/BunWorkerPatched";
import { tidEndPointMap } from "../src/common";

describe("Comlink remote transfer", function () {
  const createChannel = () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    return channel;
  };

  test("function always proxied", async function () {
    const { port1, port2 } = createChannel();
    const c = {
      call(fn: () => number) {
        return fn();
      },
    };
    const d = expose(c, port2);
    const thing = wrap<typeof d>(port1);

    expect(await thing.call(proxy(() => 5))).toBe(5);
    expect(await thing.call(() => 10)).toBe(10);
  });

  test("don't proxy source", async function () {
    const { port1, port2 } = createChannel();
    const obj = { value: 4 };
    const prox = proxy(obj);
    const c = { obj, proxy: prox };
    const d = expose(c, port2);
    const thing = wrap<typeof d>(port1);

    const p1 = await thing.obj;
    expect(p1.value).toBe(4);
    p1.value = 5;
    expect(await thing.obj.value).toBe(4);

    const p2 = thing.proxy;
    await (p2.value = Promise.resolve(3));
    // needed to ensure set promise resolved.
    await new Promise((resolve) => setTimeout(resolve));

    expect(obj.value).toBe(3);
    expect(await thing.proxy.value).toBe(3);
    expect(await thing.obj.value).toBe(3);
  });

  test("get real object when receive proxy object from same source", async function () {
    const { port1, port2 } = createChannel();
    const obj = { value: 4 };
    const prox = proxy(obj);
    const d = expose(
      {
        test: function (p: typeof prox) {
          return p === obj;
        },
        obj,
        proxy: prox,
      },
      port2
    );

    const thing = wrap<typeof d>(port1);

    let p1: any = thing.proxy;
    expect(await p1.value).toBe(4);
    expect(await thing.test(p1 as any)).toBeTrue();

    p1 = await thing.proxy;
    expect(await p1.value).toBe(4);
    expect(await thing.test(p1 as any)).toBeTrue();

    p1 = thing.obj;
    expect(await p1.value).toBe(4);
    expect(await thing.test(p1 as any)).toBeTrue();
  });

  test("always return same proxy for same remote", async function () {
    const { port1, port2 } = createChannel();
    const obj = { value: 4 };
    const prox = proxy(obj);
    const d = expose({ obj, proxy: prox }, port2);
    const thing = wrap<typeof d>(port1);

    const p1 = await thing.proxy;
    expect(await p1.value).toBe(4);
    const p2 = await thing.proxy;
    expect(p1).toBe(p2);
  });

  test("proxy iterable", async function () {
    const { port1, port2 } = createChannel();
    const obj = [1, 2, 3, 4];
    const prox = proxy(obj);
    const d = expose({ obj, proxy: prox }, port2);
    const thing = wrap<typeof d>(port1);

    let i = 0;
    for await (const a of thing.obj) {
      expect(a).toBe(++i);
    }

    i = 0;
    for await (const a of thing.proxy) {
      expect(a).toBe(++i);
    }
  });

  test("proxy async iterable", async function () {
    const { port1, port2 } = createChannel();
    const obj = {
      async *[Symbol.asyncIterator]() {
        yield await Promise.resolve(1);
        yield await Promise.resolve(2);
        yield await Promise.resolve(3);
        yield await Promise.resolve(4);
      },
    };
    const prox = proxy(obj);
    const d = expose({ obj, proxy: prox }, port2);
    const thing = wrap<typeof d>(port1);

    let i = 0;
    for await (const a of thing.obj) {
      expect(a).toBe(++i);
    }

    i = 0;
    for await (const a of thing.proxy) {
      expect(a).toBe(++i);
    }
  });

  test("proxy async iterable return", async function () {
    const { port1, port2 } = createChannel();
    let isStopEarly = false;
    const obj = {
      async *[Symbol.asyncIterator]() {
        isStopEarly = false;
        let isDone = false;
        try {
          yield await Promise.resolve(1);
          yield await Promise.resolve(2);
          yield await Promise.resolve(3);
          yield await Promise.resolve(4);
          isDone = true;
        } finally {
          isStopEarly = !isDone;
        }
      },
    };
    const prox = proxy(obj);
    const d = expose({ obj, proxy: prox }, port2);
    const thing = wrap<typeof d>(port1);

    let i = 0;
    for await (const a of thing.obj) {
      expect(a).toBe(++i);
      break;
    }
    expect(isStopEarly).toBeTrue();

    i = 0;
    for await (const a of thing.proxy) {
      expect(a).toBe(++i);
      break;
    }
    expect(isStopEarly).toBeTrue();
  });

  test("proxy async iterable throw", async function () {
    const { port1, port2 } = createChannel();
    let error: Error = undefined as any;
    const obj = {
      async *[Symbol.asyncIterator]() {
        error = undefined as any;
        try {
          yield await Promise.resolve(1);
          yield await Promise.resolve(2);
          yield await Promise.resolve(3);
          yield await Promise.resolve(4);
        } catch (e: any) {
          error = e;
        }
      },
    };
    const prox = proxy(obj);
    const d = expose({ obj, proxy: prox }, port2);
    const thing = wrap<typeof d>(port1);

    let iterator = await thing.obj[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: 1, done: false });
    expect(error).toBeUndefined();
    await iterator.throw(new Error("stop"));
    expect(error?.message).toBe("stop");

    iterator = await thing.proxy[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: 1, done: false });
    expect(error).toBeUndefined();
    await iterator.throw(new Error("stop"));
    expect(error?.message).toBe("stop");
  });

  test("can pas remote object to other", async function () {
    const worker1 = new BunWorkerPatched(
      new URL("./fixtures/worker_1.ts", import.meta.url),
      { type: "module" }
    );
    const worker2 = new BunWorkerPatched(
      new URL("./fixtures/worker_2.ts", import.meta.url),
      { type: "module" }
    );
    const w1 = wrap<typeof worker_1>(worker1);
    const w2 = wrap<typeof worker_2>(worker2);
    await w2.init(w1);
    expect(await w2.getValue()).toBe(1);
    const b = await w2.getNumberValue();
    expect(await b.value).toBe(8);
    const d = await w2.get();
    expect(await d.value).toBe(1);

    worker2.terminate();
    worker1.terminate();
  });

  test("avoid re-proxy, always create direct message channel", async function () {
    const worker1 = new BunWorkerPatched(
      new URL("./fixtures/worker_1.ts", import.meta.url),
      { type: "module" }
    );
    const worker2 = new BunWorkerPatched(
      new URL("./fixtures/worker_2.ts", import.meta.url),
      { type: "module" }
    );
    let w1: Remote<UnProxyMarked<typeof worker_1>> | undefined =
      wrap<typeof worker_1>(worker1);
    const w2 = wrap<typeof worker_2>(worker2);

    await w2.init(w1);
    await w1[Symbol.asyncDispose]();
    w1 = undefined;

    const d = await w2.get();
    expect(await d.value).toBe(1);
    const b = await w2.getNumberValue();
    expect(await b.value).toBe(8);

    worker2.terminate();
    expect(await d.value).toBe(1);
    expect(await b.value).toBe(8);
    worker1.terminate();
  });

  test("merge message channel, maintain 1 message channel per thread", async function () {
    const worker1 = new BunWorkerPatched(
      new URL("./fixtures/worker_1.ts", import.meta.url),
      { type: "module" }
    );
    const worker2 = new BunWorkerPatched(
      new URL("./fixtures/worker_2.ts", import.meta.url),
      { type: "module" }
    );
    const w1 = wrap<typeof worker_1>(worker1);
    const w2 = wrap<typeof worker_2>(worker2);
    const w1Data = w1[proxyRemoteData];

    await w2.init(w1);
    const tidCount = tidEndPointMap.size;

    const d = await w2.get();
    expect(await d.value).toBe(1);
    const dData = d[proxyRemoteData];
    expect(w1Data.controller).toBe(dData.controller);

    const b = await w2.getNumberValue();
    expect(await b.value).toBe(8);
    const bData = b[proxyRemoteData];
    expect(w1Data.controller).toBe(bData.controller);

    expect(tidEndPointMap.size).toBe(tidCount);
    worker2.terminate();
    worker1.terminate();
  });

  test("ensure tid endpoint map not mess up", async function () {
    const valueObj = { value: 10 };
    const proxyValueObj = proxy(valueObj);
    const c = {
      fnCheck(fn: () => number) {
        return fn;
      },
      fnObjCheck(obj: Remote<typeof valueObj>) {
        const rObj = obj as unknown as typeof valueObj;
        return rObj === valueObj;
      },
      proxy: proxyValueObj,
    };

    let { port1, port2 } = createChannel();
    let d = expose(c, port2);
    let thing = wrap<typeof d>(port1);

    const fn1 = proxy(() => 5);
    expect(await thing.fnCheck(fn1)).toBe(fn1);
    const fn2 = () => 10;
    expect(await thing.fnCheck(fn2)).toBe(fn2);

    let px = await thing.proxy;
    expect(await thing.fnObjCheck(px)).toBe(true);

    const msgChannel = createChannel();
    port1 = msgChannel.port1;
    port2 = msgChannel.port2;
    thing = wrap<typeof d>(port1);
    d = expose(c, port2);

    expect(await thing.fnCheck(fn1)).toBe(fn1);
    expect(await thing.fnCheck(fn2)).toBe(fn2);

    px = await thing.proxy;
    expect(await thing.fnObjCheck(px)).toBe(true);
  });
});
