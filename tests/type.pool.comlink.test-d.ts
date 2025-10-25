import { test, expectTypeOf } from "bun:test";
import { expose, pool, proxy, Remote } from "../src/comlink.js";

type HasReadonlyProperty<T, K extends keyof T> = IfEquals<
  {
    [P in K]: T[P];
  },
  {
    -readonly [P in K]: T[P];
  },
  false,
  true
>;
// Helper type to compare equality of types
type IfEquals<X, Y, A = true, B = false> = (<T>() => T extends X
  ? 1
  : 2) extends <T>() => T extends Y ? 1 : 2
  ? A
  : B;

test("readonly property", async () => {
  const x = {
    a: 4,
    b() {
      return 9;
    },
    c: {
      d: 3,
    },
    e: proxy({ f: 1 }),
  };

  const ex = expose(x);
  const thing = pool<typeof ex>(() => globalThis);
  expectTypeOf(thing).not.toBeAny();

  const a = thing.a;
  expectTypeOf<HasReadonlyProperty<typeof thing, "a">>().toEqualTypeOf<true>();
  expectTypeOf(a).toExtend<Promise<number>>();
  expectTypeOf(a).not.toBeAny();

  const b = thing.b;
  expectTypeOf<HasReadonlyProperty<typeof thing, "b">>().toEqualTypeOf<true>();
  expectTypeOf(b).toExtend<() => Promise<number>>();
  expectTypeOf(b).not.toBeAny();

  const subproxy = thing.c;
  expectTypeOf<HasReadonlyProperty<typeof thing, "c">>().toEqualTypeOf<true>();
  expectTypeOf(subproxy).toExtend<Promise<{ d: number }>>();
  expectTypeOf(subproxy).not.toBeAny();

  const copy = await thing.c;
  expectTypeOf(copy).toExtend<{ d: number }>();
  expectTypeOf<HasReadonlyProperty<typeof copy, "d">>().toEqualTypeOf<false>();

  expectTypeOf<HasReadonlyProperty<typeof thing, "e">>().toEqualTypeOf<true>();
  expectTypeOf(thing.e).not.toBeAny();
  expectTypeOf(thing.e).toEqualTypeOf<Promise<Remote<{ f: number }>>>();

  const eProxy = await thing.e;
  expectTypeOf(eProxy).not.toBeAny();
  expectTypeOf(eProxy).toEqualTypeOf<Remote<{ f: number }>>();
});
