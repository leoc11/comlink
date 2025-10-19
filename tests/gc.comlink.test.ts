import { expect, test, describe } from "bun:test";
import { expose, proxy, proxyRemoteData, Remote, wrap } from "../src/comlink";
import { SampleClass } from "./fixtures/sample-class";
import { ProxyID } from "../src/protocol";

describe("Comlink gc", function () {
  const createChannel = () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    return channel;
  };

  const bunTest = "Bun" in globalThis ? test : test.skip;
  bunTest(
    "released proxy via GC should invoke Symbol.dispose",
    async function () {
      const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
        heldValue();
      });
      // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
      await new Promise(async (resolve) => {
        gcRegistry.register({}, resolve);
        Bun.gc(true);
      });

      const { port1, port2 } = createChannel();
      let finalized = false;
      const d = expose(
        {
          a: "thing",
          [Symbol.dispose]: () => {
            finalized = true;
          },
        },
        port2
      );

      let instance = wrap<typeof d>(port1);
      expect(await instance.a).toBe("thing");
      // promise will resolve when the proxy is garbage collected
      await new Promise(async (resolve) => {
        gcRegistry.register(instance, resolve);
        instance = undefined as any;

        await new Promise((resolve) => setTimeout(resolve));
        Bun.gc(true);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(finalized).toBeTrue();
    }
  );

  bunTest(
    "released proxy via GC should invoke Symbol.asyncDispose",
    async function () {
      const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
        heldValue();
      });
      // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
      await new Promise(async (resolve) => {
        gcRegistry.register({}, resolve);
        Bun.gc(true);
      });

      const { port1, port2 } = createChannel();
      let finalized = false;
      const d = expose(
        {
          a: "thing",
          [Symbol.asyncDispose]: async () => {
            finalized = true;
          },
        },
        port2
      );

      let instance = wrap<typeof d>(port1);
      expect(await instance.a).toBe("thing");
      // promise will resolve when the proxy is garbage collected
      await new Promise(async (resolve) => {
        gcRegistry.register(instance, resolve);
        instance = undefined as any;

        await new Promise((resolve) => setTimeout(resolve));
        Bun.gc(true);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(finalized).toBeTrue();
    }
  );

  bunTest("proxy should increase counter", async function () {
    const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
      heldValue();
    });
    // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
    await new Promise(async (resolve) => {
      gcRegistry.register({}, resolve);
      Bun.gc(true);
    });

    const { port1, port2 } = createChannel();
    const k = expose(new SampleClass(), port1);
    let thing = wrap<typeof k>(port2);
    const proxyData = thing[proxyRemoteData];
    const pidRemoteMap: Map<
      ProxyID,
      { remote: WeakRef<Remote>; count: number }
    > = (proxyData.controller as any).pidRemoteMap;
    const pid = proxyData.pid;

    expect(pidRemoteMap.size).toBe(1);

    const trackData = pidRemoteMap.get(pid)!;
    expect(trackData?.count).toBe(1);

    expect(await thing.counter).toBe(1);
    expect(trackData.count).toBe(2);

    expect(await thing.method()).toBe(4);
    expect(trackData.count).toBe(3);

    thing.deepObject;
    expect(trackData.count).toBe(4);

    thing.deepObject.level1.level2.level3;
    expect(trackData.count).toBe(8);
  });

  bunTest("release proxy should decrease counter", async function () {
    const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
      heldValue();
    });
    // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
    await new Promise(async (resolve) => {
      gcRegistry.register({}, resolve);
      Bun.gc(true);
    });

    const { port1, port2 } = createChannel();
    const k = expose(new SampleClass(), port1);
    let thing = wrap<typeof k>(port2);
    const proxyData = thing[proxyRemoteData];
    const pidRemoteMap: Map<
      ProxyID,
      { remote: WeakRef<Remote>; count: number }
    > = (proxyData.controller as any).pidRemoteMap;
    const pid = proxyData.pid;

    expect(pidRemoteMap.size).toBe(1);

    const trackData = pidRemoteMap.get(pid)!;
    expect(trackData?.count).toBe(1);

    const t1 = thing.deepObject;
    expect(trackData.count).toBe(2);

    await t1[Symbol.asyncDispose]();
    expect(trackData.count).toBe(1);

    await thing[Symbol.asyncDispose]();
    expect(trackData.count).toBe(0);
    expect(pidRemoteMap.has(pid)).toBeFalse();
  });

  bunTest("new proxy should increase pid counter", async function () {
    const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
      heldValue();
    });
    // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
    await new Promise(async (resolve) => {
      gcRegistry.register({}, resolve);
      Bun.gc(true);
    });

    const { port1, port2 } = createChannel();
    const k = expose(SampleClass, port1);
    let thingType = wrap<typeof k>(port2);
    const proxyData = thingType[proxyRemoteData];
    const pidRemoteMap: Map<
      ProxyID,
      { remote: WeakRef<Remote>; count: number }
    > = (proxyData.controller as any).pidRemoteMap;
    expect(pidRemoteMap.size).toBe(1);

    const thing1 = await new thingType(1);
    const pid1 = thing1[proxyRemoteData].pid;
    expect(pid1).not.toEqual(proxyData.pid);
    expect(pidRemoteMap.size).toBe(2);

    const thing2 = await new thingType(2);
    const pid2 = thing2[proxyRemoteData].pid;
    expect(pid2).not.toEqual(proxyData.pid);
    expect(pid2).not.toEqual(pid1);
    expect(pidRemoteMap.size).toBe(3);
  });

  bunTest("new proxy should not increase counter", async function () {
    const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
      heldValue();
    });
    // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
    await new Promise(async (resolve) => {
      gcRegistry.register({}, resolve);
      Bun.gc(true);
    });

    const { port1, port2 } = createChannel();
    const k = expose(SampleClass, port1);
    let thingType = wrap<typeof k>(port2);
    const proxyData = thingType[proxyRemoteData];
    const pidRemoteMap: Map<
      ProxyID,
      { remote: WeakRef<Remote>; count: number }
    > = (proxyData.controller as any).pidRemoteMap;
    expect(pidRemoteMap.size).toBe(1);

    const thing1 = await new thingType(1);
    const pid = thing1[proxyRemoteData].pid;
    expect(pidRemoteMap.get(pid)!.count).toBe(1);

    const thing2 = await new thingType(2);
    expect(pidRemoteMap.get(pid)!.count).toBe(1);
  });

  bunTest("released proxy via GC should decrease counter", async function () {
    const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
      heldValue();
    });
    // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
    await new Promise(async (resolve) => {
      gcRegistry.register({}, resolve);
      Bun.gc(true);
    });

    const { port1, port2 } = createChannel();
    const k = expose(SampleClass, port1);
    let thingType = wrap<typeof k>(port2);
    const pidRemoteMap: Map<
      ProxyID,
      { remote: WeakRef<Remote>; count: number }
    > = (thingType[proxyRemoteData].controller as any).pidRemoteMap;
    expect(pidRemoteMap.size).toBe(1);

    let thing = await new thingType();
    expect(pidRemoteMap.size).toBe(2);

    const pid = thing[proxyRemoteData].pid;
    const trackData = pidRemoteMap.get(pid)!;

    expect(trackData?.count).toBe(1);
    thing.deepObject.level1.level2.level3;
    expect(trackData.count).toBe(5);

    // promise will resolve when the proxy is garbage collected
    await new Promise(async (resolve) => {
      gcRegistry.register(thing, resolve);
      thingType = thing = undefined as any;

      Bun.gc(true);
      await new Promise((resolve) => setTimeout(resolve));
      Bun.gc(true);
    });

    // wait for Promise in finalizer to complete
    await new Promise((resolve) => setTimeout(resolve));

    expect(trackData.count).toBe(0);
    expect(pidRemoteMap.has(pid)).toBeFalse();
    expect(pidRemoteMap.size).toBe(0);
  });

  bunTest(
    "released proxy via GC should not invoke Symbol.dispose when some proxy (same pid) exist",
    async function () {
      const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
        heldValue();
      });
      // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
      await new Promise(async (resolve) => {
        gcRegistry.register({}, resolve);
        Bun.gc(true);
      });

      const { port1, port2 } = createChannel();
      let finalized = false;
      const d = expose(
        {
          a: "thing",
          value: {
            b: "thing",
          },
          [Symbol.dispose]: () => {
            finalized = true;
          },
        },
        port2
      );

      let instance = wrap<typeof d>(port1);
      const proxyData = instance[proxyRemoteData];
      const pidRemoteMap: Map<
        ProxyID,
        { remote: WeakRef<Remote>; count: number }
      > = (proxyData.controller as any).pidRemoteMap;
      const trackData = pidRemoteMap.get(proxyData.pid)!;

      expect(pidRemoteMap.size).toBe(1);
      expect(trackData.count).toBe(1);

      let c = instance.value;
      expect(trackData.count).toBe(2);

      expect(await instance.a).toBe("thing");
      // promise will resolve when the proxy is garbage collected
      await new Promise(async (resolve) => {
        gcRegistry.register(instance, resolve);
        instance = undefined as any;

        await new Promise((resolve) => setTimeout(resolve));
        Bun.gc(true);
      });

      await new Promise((resolve) => setTimeout(resolve));
      expect(trackData.count).toBe(1);
      expect(await c.b).toBe("thing");
      expect(finalized).toBeFalse();

      // promise will resolve when the proxy is garbage collected
      await new Promise(async (resolve) => {
        gcRegistry.register(c, resolve);
        c = undefined as any;

        await new Promise((resolve) => setTimeout(resolve));
        Bun.gc(true);
      });

      await new Promise((resolve) => setTimeout(resolve));
      expect(trackData.count).toBe(0);
      expect(pidRemoteMap.size).toBe(0);

      await new Promise((resolve) => setTimeout(resolve));
      expect(finalized).toBeTrue();
    }
  );

  bunTest(
    "released proxy via GC should invoke Symbol.dispose even if some proxy (other pid) exist",
    async function () {
      const gcRegistry = new FinalizationRegistry((heldValue: Function) => {
        heldValue();
      });
      // NOTE: Wierd behaviour in bun. without this, next finalizer won't fired
      await new Promise(async (resolve) => {
        gcRegistry.register({}, resolve);
        Bun.gc(true);
      });

      const { port1, port2 } = createChannel();
      let finalizedCount = 0;
      const d = expose(
        {
          a: "thing",
          value: proxy({
            b: "thing",
          }),
          [Symbol.dispose]: () => {
            finalizedCount++;
          },
        },
        port2
      );

      let instance = wrap<typeof d>(port1);
      const proxyData = instance[proxyRemoteData];
      const pidRemoteMap: Map<
        ProxyID,
        { remote: WeakRef<Remote>; count: number }
      > = (proxyData.controller as any).pidRemoteMap;
      const trackData = pidRemoteMap.get(proxyData.pid)!;

      expect(pidRemoteMap.size).toBe(1);
      expect(trackData.count).toBe(1);

      let c = await instance.value;
      expect(trackData.count).toBe(2);
      expect(pidRemoteMap.size).toBe(2);

      expect(await instance.a).toBe("thing");
      expect(trackData.count).toBe(3);

      // promise will resolve when the proxy is garbage collected
      await new Promise(async (resolve) => {
        gcRegistry.register(instance, resolve);
        instance = undefined as any;

        await new Promise((resolve) => setTimeout(resolve));
        Bun.gc(true);
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(pidRemoteMap.size).toBe(1);
      expect(trackData.count).toBe(0);

      expect(await c.b).toBe("thing");
      expect(finalizedCount).toBe(1);

      // promise will resolve when the proxy is garbage collected
      await new Promise(async (resolve) => {
        gcRegistry.register(c, resolve);
        c = undefined as any;

        await new Promise((resolve) => setTimeout(resolve));
        Bun.gc(true);
      });

      await new Promise((resolve) => setTimeout(resolve));
      expect(pidRemoteMap.size).toBe(0);
      expect(finalizedCount).toBe(1);
    }
  );
});
