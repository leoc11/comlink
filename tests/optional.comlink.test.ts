import { expect, test, describe } from "bun:test";
import { expose, wrap, opch, ProxyMarked } from "../src/comlink";

type optionalChaining = {
  value: number;
  next?: optionalChaining;
};

describe("Comlink optional chaining", function () {
  const createChannel = () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    return channel;
  };

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
    const { port1, port2 } = createChannel();
    const d = expose(obj, port2);
    const thing = wrap<typeof d>(port1);

    expect(await thing.value).toBe(0);
    expect(await thing.next[opch].value).toBe(1);
    expect(await thing.next[opch].next[opch].value).toBe(2);
  });

  test("basic 2", async function () {
    const { port1, port2 } = createChannel();
    const d = expose(obj, port2);
    const thing = wrap<typeof d>(port1);

    expect(await thing.next[opch].next[opch].next).toBeUndefined();
  });

  test("basic 2", async function () {
    const { port1, port2 } = createChannel();
    const d = expose(obj, port2);
    const thing = wrap<typeof d>(port1);

    expect(
      await thing.next[opch].next[opch].next[opch].next[opch].value
    ).toBeUndefined();
  });

  test("basic 3", async function () {
    const { port1, port2 } = createChannel();
    const obj: optionalChaining = {
      value: 1,
      next: {
        value: 2,
        next: {
          value: 3,
        },
      },
    };
    const d = expose(obj, port2);
    const thing = wrap<typeof d>(port1);

    const c = await thing.next;
    expect(await thing.next[opch]).toEqual(c!);
  });
});
