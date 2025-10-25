import { expect, test, describe, expectTypeOf } from "bun:test";
import { expose, wrap, opch, Remote } from "../src/comlink";

type optionalChaining = {
  value: number;
  next?: optionalChaining;
};
type optionalChainingValue = {
  value?: number;
};

describe("Comlink optional chaining", function () {
  const obj: optionalChaining = {
    value: 0,
    next: {
      value: 1,
      next: {
        value: 2,
      },
    },
  };

  test("basic", async function () {
    const d = expose(obj);
    const thing = wrap<typeof d>(globalThis);

    expectTypeOf(thing)
      .toHaveProperty("value")
      .toEqualTypeOf<Promise<number>>();
    expectTypeOf(thing.next)
      .toHaveProperty(opch)
      .toExtend<Promise<optionalChaining>>();
    expectTypeOf(thing.next[opch].value).toEqualTypeOf<Promise<number>>();
    expectTypeOf(thing.next[opch].next[opch]).toExtend<
      Promise<optionalChaining>
    >();
  });

  test("basic 2", async function () {
    const d = expose(obj);
    const thing = wrap<typeof d>(globalThis);

    expectTypeOf(thing.next[opch].next[opch].next).toEqualTypeOf<
      (
        | (Remote<optionalChaining> & Promise<optionalChaining>)
        | Promise<undefined>
      ) & { [opch]: Promise<optionalChaining> & Remote<optionalChaining> }
    >();
  });

  test("basic 3", async function () {
    const d = expose({} as optionalChainingValue);
    const thing = wrap<typeof d>(globalThis);

    expectTypeOf(thing.value).toEqualTypeOf<
      (Promise<number> | Promise<undefined>) & { [opch]: Promise<number> }
    >();
    expectTypeOf(thing.value[opch]).toEqualTypeOf<Promise<number>>();
  });

  test("basic 4", async function () {
    const d = expose(obj);
    const thing = wrap<typeof d>(globalThis);

    const c = (await thing.next)!;
    expectTypeOf(await thing.next[opch]).toEqualTypeOf<typeof c>();
  });
});
