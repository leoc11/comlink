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
import type d from "./fixtures/shared_worker";
import { ProxyMarked, Remote, wrap, proxyRemoteData } from "../src/comlink";
import { SharedWorker } from "./mocks/SharedWorker";
import { locks } from "web-locks";

describe("Comlink across shared workers", function () {
  test("can communicate", async function () {
    const worker = new SharedWorker(
      new URL("./fixtures/shared_worker.ts", import.meta.url),
      { type: "module" }
    );
    const proxy = wrap<ProxyMarked<typeof d>>(worker.port);
    expect(await proxy(1, 3)).toEqual(4);
    worker.close();
  });
  test("send heart beat", async function () {
    const worker = new SharedWorker(
      new URL("./fixtures/shared_worker.ts", import.meta.url),
      { type: "module" }
    );

    const proxy: Remote<typeof d> | undefined = wrap<ProxyMarked<typeof d>>(
      worker.port
    );
    const controller = proxy[proxyRemoteData]?.controller as any;
    controller.sendHeartBeat = mock(controller.sendHeartBeat);

    expect(await proxy(1, 3)).toEqual(4);

    await new Promise<void>((res) => setTimeout(res, 10));
    expect(controller.sendHeartBeat).toHaveBeenCalled();
    worker.close();
  });
  test("unexposed on timeout", async function () {
    const worker = new SharedWorker(
      new URL("./fixtures/shared_worker.ts", import.meta.url),
      { type: "module" }
    );

    const proxy: Remote<typeof d> | undefined = wrap<ProxyMarked<typeof d>>(
      worker.port
    );
    const controller = proxy[proxyRemoteData]?.controller as any;
    controller.sendHeartBeat = mock(() => {});

    expect(await proxy(1, 3)).toEqual(4);

    await new Promise<void>((res) => setTimeout(res, 50));
    expect(controller.sendHeartBeat).toHaveBeenCalled();

    let settled = false;
    // Race the promise with a timeout
    await Promise.race([
      proxy(1, 3).finally(() => {
        settled = true;
      }),
      new Promise((resolve) => setTimeout(resolve, 100)), // 100ms wait
    ]);

    expect(settled).toBe(false);
    worker.close();
  });
  test("use locks api", async function () {
    const worker = new SharedWorker(
      new URL("./fixtures/shared_worker.ts", import.meta.url),
      { type: "module" }
    );

    (navigator as any).locks = locks;
    const proxy: Remote<typeof d> | undefined = wrap<ProxyMarked<typeof d>>(
      worker.port
    );
    (navigator.locks as any).request = mock(navigator.locks.request);
    expect(await proxy(1, 3)).toEqual(4);

    await new Promise<void>((res) => setTimeout(res, 10));
    expect(navigator.locks.request).toHaveBeenCalled();
    (navigator as any).locks = undefined;
    worker.close();
  });
  test("unexposed on release locks", async function () {
    const worker = new SharedWorker(
      new URL("./fixtures/shared_worker.ts", import.meta.url),
      { type: "module" }
    );

    (navigator as any).locks = locks;
    const proxy: Remote<typeof d> | undefined = wrap<ProxyMarked<typeof d>>(
      worker.port
    );
    let resolve: (() => void) | undefined;
    const requestLock = navigator.locks.request.bind(navigator.locks);
    const mockFn = mock((name: string, options: LockOptions) => {
      requestLock(name, options, async (lock) => {
        await new Promise<void>((res) => {
          resolve = res;
        });
      });
    });
    (navigator.locks as any).request = mockFn;
    expect(await proxy(1, 3)).toEqual(4);

    await new Promise<void>((res) => setTimeout(res, 10));
    expect(navigator.locks.request).toHaveBeenCalled();
    resolve?.();

    await new Promise((resolve) => setTimeout(resolve, 10));

    let settled = false;
    // Race the promise with a timeout
    await Promise.race([
      proxy(1, 3).finally(() => {
        settled = true;
      }),
      new Promise((resolve) => setTimeout(resolve, 100)), // 100ms wait
    ]);

    expect(settled).toBe(false);
    worker.close();
    (navigator as any).locks = undefined;
  });

  test("Symbol.asyncDispose closes Endpoint", async function () {
    const worker = new SharedWorker(
      new URL("./fixtures/shared_worker.ts", import.meta.url),
      { type: "module" }
    );
    const endpoint = worker.port;
    const proxy = wrap<ProxyMarked<typeof d>>(endpoint);
    expect(await proxy(1, 3)).toEqual(4);

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
});
