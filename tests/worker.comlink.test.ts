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

import { expect, test, describe, mock } from "bun:test";
import * as Comlink from "../src/comlink";
import type d from "./fixtures/worker";

describe("Comlink across workers", function () {
  test("can communicate", async function () {
    const worker = new Worker(
      new URL("./fixtures/worker.ts", import.meta.url),
      { type: "module" }
    );
    const proxy = Comlink.wrap<typeof d>(worker);
    expect(await proxy(1, 3)).toEqual(4);
    worker.terminate();
  });

  test("Symbol.asyncDispose closes Endpoint", async function () {
    const worker = new Worker(
      new URL("./fixtures/worker.ts", import.meta.url),
      { type: "module" }
    );
    const endpoint = worker;
    const proxy = Comlink.wrap<typeof d>(endpoint);
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
  });

  // it("can tunnels a new endpoint with createEndpoint", async function () {
  //   const proxy = Comlink.wrap(globalThis.worker);
  //   const otherEp = await proxy[Comlink.createEndpoint]();
  //   const otherProxy = Comlink.wrap(otherEp);
  //   expect(await otherProxy(20, 1)).to.equal(21);
  // });

  // it("releaseProxy closes MessagePort created by createEndpoint", async function () {
  //   const proxy = Comlink.wrap(globalThis.worker);
  //   const otherEp = await proxy[Comlink.createEndpoint]();
  //   const otherProxy = Comlink.wrap(otherEp);
  //   expect(await otherProxy(20, 1)).to.equal(21);

  //   await new Promise((resolve) => {
  //     otherEp.close = resolve; // Resolve the promise when the MessagePort is closed.
  //     otherProxy[Comlink.releaseProxy](); // Release the proxy, which should close the MessagePort.
  //   });
  // });
});
