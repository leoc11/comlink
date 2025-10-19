import { expect, it as test, describe, mock } from "bun:test";
import { Worker } from "node:worker_threads";
import * as Comlink from "../src/comlink";
import type node from "./fixtures/node";

// should run last, coz it can fail other test
describe("node", () => {
  describe("Comlink across workers", function () {
    test("can communicate", async function () {
      const worker = new Worker(
        new URL("./fixtures/node.js", import.meta.url).pathname.slice(1),
        { eval: false }
      );
      const proxy = Comlink.wrap<typeof node>(Comlink.nodeEndpoint(worker));
      expect(await proxy(1, 3)).toBe(4);
      await worker.terminate();
    });

    test("Symbol.asyncDispose closes Endpoint", async function () {
      const worker = new Worker(
        new URL("./fixtures/node.js", import.meta.url).pathname.slice(1),
        { eval: false }
      );
      const endpoint = Comlink.nodeEndpoint(worker);
      const proxy = Comlink.wrap<typeof node>(endpoint);
      expect(await proxy(1, 3)).toBe(4);

      await new Promise<void>(async (resolve) => {
        const ori = endpoint.removeEventListener.bind(endpoint);
        endpoint.removeEventListener = mock(
          (
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: {}
          ) => {
            ori(type, listener, options);
            resolve();
          }
        );
        // Release the proxy, which should remove the attached event listener
        await proxy[Symbol.asyncDispose]();
      });

      expect(endpoint.removeEventListener).toBeCalled();
      await worker.terminate();
    });
  });
});
