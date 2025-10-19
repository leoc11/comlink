import { test, describe, expectTypeOf } from "bun:test";
import {
  expose,
  wrap,
  proxy,
  ProxyMarked,
  windowEndpoint,
  Remote,
  proxyRemoteData,
  Local,
  UnProxyMarked,
  proxyMarker,
  TransferHandler,
  transferHandlers,
  opch,
} from "../src/comlink.js";

describe("Comlink types", () => {
  test("", () => {
    function simpleNumberFunction() {
      return 4;
    }

    const ex = expose(simpleNumberFunction);
    const proxy = wrap<typeof ex>(globalThis);
    expectTypeOf(proxy).not.toBeAny();
    const v = proxy();
    expectTypeOf(v).toExtend<Promise<number>>();
  });
  test("", async () => {
    function simpleObjectFunction() {
      return { a: 3 };
    }

    const ex = expose(simpleObjectFunction);
    const proxy = wrap<typeof ex>(globalThis);
    const v = await proxy();
    expectTypeOf(v).toExtend<{ a: number }>();
  });
  test("", async () => {
    async function simpleAsyncFunction() {
      return { a: 3 };
    }

    const ex = expose(simpleAsyncFunction);
    const proxy = wrap<typeof ex>(globalThis);
    const v = await proxy();
    expectTypeOf(v).toExtend<{ a: number }>();
  });

  test("", async () => {
    function functionWithProxy() {
      return proxy({ a: 3 });
    }

    const ex = expose(functionWithProxy);
    const thing = wrap<typeof ex>(globalThis);
    const subproxy = await thing();
    const prop = subproxy.a;
    expectTypeOf(prop).toExtend<Promise<number>>();
  });

  test("", async () => {
    class X {
      static staticFunc() {
        return 4;
      }
      private f = 4;
      public g = 9;
      sayHi() {
        return "hi";
      }
    }

    const ex = expose(X);
    const thing = wrap<typeof ex>(globalThis);
    expectTypeOf(thing).toExtend<{ staticFunc: () => Promise<number> }>();
    const instance = await new thing();
    expectTypeOf(instance).toExtend<{
      sayHi: () => Promise<string>;
      g: Promise<number>;
    }>();
    expectTypeOf(instance).not.toExtend<{ f: Promise<number> }>();
    expectTypeOf(instance).not.toBeAny();
  });

  test("", async () => {
    const x = {
      a: 4,
      b() {
        return 9;
      },
      c: {
        d: 3,
      },
    };

    const ex = expose(x);
    const proxy = wrap<typeof ex>(globalThis);
    expectTypeOf(proxy).not.toBeAny();

    const a = proxy.a;
    expectTypeOf(a).toExtend<Promise<number>>();
    expectTypeOf(a).not.toBeAny();

    const b = proxy.b;
    expectTypeOf(b).toExtend<() => Promise<number>>();
    expectTypeOf(b).not.toBeAny();

    const subproxy = proxy.c;
    expectTypeOf(subproxy).toExtend<Promise<{ d: number }>>();
    expectTypeOf(subproxy).not.toBeAny();

    const copy = await proxy.c;
    expectTypeOf(copy).toExtend<{ d: number }>();
  });

  test("", async () => {
    wrap(new MessageChannel().port1);
    expose({}, new MessageChannel().port2);

    interface Baz {
      baz: number;
      method(): number;
    }

    class Foo {
      constructor(cParam: string) {
        const self = this;
        expectTypeOf(self.proxyProp).toEqualTypeOf<ProxyMarked<Bar>>();
      }
      prop1: string = "abc";
      proxyProp = proxy(new Bar());
      methodWithTupleParams(...args: [string] | [number, string]): number {
        return 123;
      }
      methodWithProxiedReturnValue(): ProxyMarked<Baz> {
        return proxy({ baz: 123, method: () => 123 });
      }
      methodWithProxyParameter(param: ProxyMarked<Baz>): void {}
    }

    class Bar {
      prop2: string | number = "abc";
      method(param: string): number {
        return 123;
      }
      methodWithProxiedReturnValue(): ProxyMarked<Baz> {
        return proxy({ baz: 123, method: () => 123 });
      }
    }

    const foo = expose(new Foo(""));
    const thing = wrap<typeof foo>(windowEndpoint(self));
    expectTypeOf(thing).toEqualTypeOf<Remote<Foo>>();

    thing[Symbol.asyncDispose]();
    thing[proxyRemoteData];

    expectTypeOf(thing.prop1).not.toBeAny();
    expectTypeOf(thing.prop1).toExtend<Promise<string>>();

    const r1 = thing.methodWithTupleParams(123, "abc");
    expectTypeOf(r1).toEqualTypeOf<Promise<number>>();

    const r2 = thing.methodWithTupleParams("abc");
    expectTypeOf(r2).toEqualTypeOf<Promise<number>>();

    expectTypeOf(thing.proxyProp).toEqualTypeOf<
      Remote<Bar> & Promise<Remote<Bar>>
    >();
    expectTypeOf(thing.proxyProp.prop2).not.toBeAny();
    expectTypeOf(thing.proxyProp.prop2)
      .extract<Promise<string>>()
      .toEqualTypeOf<Promise<string>>();
    expectTypeOf(thing.proxyProp.prop2)
      .extract<Promise<number>>()
      .toEqualTypeOf<Promise<number>>();

    const r3 = thing.proxyProp.method("param");
    expectTypeOf(r3).not.toBeAny();
    expectTypeOf(r3).toExtend<Promise<number>>();

    // @ts-expect-error
    thing.proxyProp.method(123);
    // @ts-expect-error
    thing.proxyProp.method();

    const r4 = thing.methodWithProxiedReturnValue();
    expectTypeOf(r4).not.toBeAny();
    expectTypeOf(r4).toExtend<Promise<Remote<Baz>>>();

    const r5 = thing.proxyProp.methodWithProxiedReturnValue();
    expectTypeOf(r5).not.toBeAny();
    expectTypeOf(r5).toExtend<Promise<Remote<Baz>>>();

    const r6 = (await thing.methodWithProxiedReturnValue()).baz;
    expectTypeOf(r6).not.toBeAny();
    expectTypeOf(r6).toExtend<Promise<number>>();

    const r7 = (await thing.methodWithProxiedReturnValue()).method();
    expectTypeOf(r7).not.toBeAny();
    expectTypeOf(r7).toExtend<Promise<number>>();

    const thingFoo = expose(Foo);
    const ProxiedFooClass = wrap<typeof thingFoo>(windowEndpoint(self));

    const inst1 = await new ProxiedFooClass("test");
    expectTypeOf(inst1).toEqualTypeOf<Remote<Foo>>();
    inst1[Symbol.asyncDispose]();
    inst1[proxyRemoteData];

    // @ts-expect-error
    await new ProxiedFooClass(123);
    // @ts-expect-error
    await new ProxiedFooClass();

    //
    // Tests for advanced proxy use cases
    //

    // Type round trips
    // This tests that Local is the exact inverse of Remote for objects:
    expectTypeOf<UnProxyMarked<ProxyMarked<string>>>().toEqualTypeOf<string>();
    expectTypeOf<Local<Remote<string>>>().toEqualTypeOf<string>();

    // This tests that Local is the inverse of Remote for functions
    type tF = (a: number) => string;
    expectTypeOf<Local<Remote<tF>>>().toEqualTypeOf<tF | Local<tF>>();

    interface Subscriber<T> {
      closed?: boolean;
      next?: (value: T) => void;
    }
    interface Unsubscribable {
      unsubscribe(): void;
    }
    /** A Subscribable that can get proxied by Comlink */
    interface ProxyableSubscribable<T> {
      [proxyMarker]: true;
      subscribe(subscriber: Remote<Subscriber<T>>): ProxyMarked<Unsubscribable>;
    }

    /** Simple parameter object that gets cloned (not proxied) */
    interface Params {
      textDocument: string;
    }

    class Registry {
      async registerProvider(
        provider: Remote<(params: Params) => ProxyableSubscribable<string>>
      ) {
        const resultPromise = provider({ textDocument: "foo" });
        expectTypeOf(resultPromise).toEqualTypeOf<
          Promise<Remote<ProxyableSubscribable<string>>>
        >();

        const result = await resultPromise;
        const subscriptionPromise = result.subscribe({
          [proxyMarker]: true,
          next: (value) => {
            expectTypeOf(value).toEqualTypeOf<string>();
          },
        });

        expectTypeOf(subscriptionPromise).toEqualTypeOf<
          Promise<Remote<Unsubscribable>>
        >();

        const subscriber = proxy({
          next: (value: string) => console.log(value),
        });
        result.subscribe(subscriber);

        const r1 = (await subscriptionPromise).unsubscribe();
        expectTypeOf(r1).toEqualTypeOf<Promise<void>>();
      }
    }

    const exposedRegistry = expose(new Registry());
    const proxy2 = wrap<typeof exposedRegistry>(windowEndpoint(self));

    proxy2.registerProvider(
      // Synchronous callback
      proxy(({ textDocument }: Params) => {
        const subscribable = proxy({
          subscribe(
            subscriber: Remote<Subscriber<string>>
          ): ProxyMarked<Unsubscribable> {
            // Important to test here is that union types (such as Function | undefined) distribute properly
            // when wrapped in Promises/proxied
            expectTypeOf(subscriber.closed).not.toBeAny();
            expectTypeOf(subscriber.closed).toEqualTypeOf<
              (Promise<undefined> | Promise<false> | Promise<true>) & {
                [opch]: Promise<false> | Promise<true>;
              }
            >();

            expectTypeOf(subscriber.next).not.toBeAny();
            expectTypeOf(subscriber.next).toEqualTypeOf<
              (Remote<(value: string) => void> | Promise<undefined>) & {
                [opch]: Remote<(value: string) => void>;
              }
            >();

            // @ts-expect-error
            subscriber.next();

            if (subscriber.next) {
              // Only checking for presence is not enough, since it could be a Promise
              // @ts-expect-error
              subscriber.next();
            }

            if (typeof subscriber.next === "function") {
              subscriber.next("abc");
            }

            return proxy({ unsubscribe() {} });
          },
        });
        expectTypeOf(subscribable).toExtend<ProxyMarked>();
        return subscribable;
      })
    );
    proxy2.registerProvider(
      // Synchronous callback
      ({ textDocument }: Params) => {
        const subscribable = proxy({
          subscribe(
            subscriber: Remote<ProxyMarked<Subscriber<string>>>
          ): ProxyMarked<Unsubscribable> {
            // Important to test here is that union types (such as Function | undefined) distribute properly
            // when wrapped in Promises/proxied
            expectTypeOf(subscriber.closed).not.toBeAny();
            expectTypeOf(subscriber.closed).toEqualTypeOf<
              (Promise<undefined> | Promise<false> | Promise<true>) & {
                [opch]: Promise<false> | Promise<true>;
              }
            >();

            expectTypeOf(subscriber.next).not.toBeAny();
            expectTypeOf(subscriber.next).toEqualTypeOf<
              (Remote<(value: string) => void> | Promise<undefined>) & {
                [opch]: Remote<(value: string) => void>;
              }
            >();

            // @ts-expect-error
            subscriber.next();

            if (subscriber.next) {
              // Only checking for presence is not enough, since it could be a Promise
              // @ts-expect-error
              subscriber.next();
            }

            if (typeof subscriber.next === "function") {
              subscriber.next("abc");
            }

            return proxy({ unsubscribe() {} });
          },
        });
        expectTypeOf(subscribable).toExtend<ProxyMarked>();
        return subscribable;
      }
    );
    proxy2.registerProvider(
      // Async callback
      proxy(async ({ textDocument }: Params) => {
        const subscribable = proxy({
          subscribe(
            subscriber: Remote<ProxyMarked<Subscriber<string>>>
          ): ProxyMarked<Unsubscribable> {
            expectTypeOf(subscriber.next).not.toBeAny();
            expectTypeOf(subscriber.next).toEqualTypeOf<
              (Remote<(value: string) => void> | Promise<undefined>) & {
                [opch]: Remote<(value: string) => void>;
              }
            >();

            // Only checking for presence is not enough, since it could be a Promise
            if (typeof subscriber.next === "function") {
              subscriber.next("abc");
            }
            return proxy({ unsubscribe() {} });
          },
        });
        return subscribable;
      })
    );
  });

  test("Transfer handlers", async () => {
    const urlTransferHandler: TransferHandler<URL, string> = {
      canHandle: (val): val is URL => {
        expectTypeOf(val).toBeUnknown();
        return val instanceof URL;
      },
      serialize: async (url, ep) => {
        expectTypeOf(url).toEqualTypeOf<URL>();
        return [url.href, []];
      },
      deserialize: async (str, ep) => {
        expectTypeOf(str).toEqualTypeOf<string>();
        return new URL(str);
      },
    };
    transferHandlers.set("URL", urlTransferHandler);
  });
});
