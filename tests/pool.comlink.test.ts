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

import { expect, test, describe } from "bun:test";
import { PoolOptions, pool, proxyRemoteData } from "../src/comlink";
import type d from "./fixtures/worker_pool";

describe("Comlink pool", function () {
  test("can communicate", async function () {
    const proxy = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        }),
      {
        max: 10,
        min: 2,
      }
    );
    expect(await proxy.sum(1, 3)).toEqual(4);
  });

  test("can work with objects", async function () {
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        })
    );
    expect(await thing.value.value).toBe(4);
  });

  test("can work with functions on an object", async function () {
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        })
    );
    expect(await thing.sum(1, 3)).toBe(4);
  });

  test("reject set", async function () {
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        })
    );
    expect(() => {
      (thing.value as any).value = Promise.resolve(10);
    }).toThrow("pool don't support set");
  });

  test("can pass parameters to class constructor", async function () {
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        })
    );
    const instance = await new thing.SampleClass(23);
    expect(await instance.init).toBe(23);
  });
  test("max queue", async function () {
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        }),
      { min: 1, max: 1, maxQueue: 2 }
    );

    thing.sum(1, 2);
    thing.sum(2, 3);
    thing.sum(3, 4);
    expect(thing.sum(5, 6)).rejects.toThrowError("max queue reached");
  });
  test("min worker", async function () {
    const minWorker = 2;
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        }),
      { min: minWorker }
    );
    const controller = thing[proxyRemoteData]?.controller as any;
    expect(controller.workers.size).toBe(minWorker);
  });
  test("max worker", async function () {
    const maxWorker = 5;
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        }),
      { min: 1, max: maxWorker }
    );
    const controller = thing[proxyRemoteData]?.controller as any;

    const promises: Promise<number>[] = [];
    for (let i = 0; i < maxWorker * 3; i++) {
      promises.push(thing.sum(1, 2));
    }

    expect(controller.workers.size).toBe(maxWorker);
    expect(Promise.all(promises)).resolves.toBeDefined();
  });
  test("idle timeout", async function () {
    const poolOptions: PoolOptions = {
      min: 1,
      max: 5,
      idleTimeout: 10,
    };
    const thing = pool<typeof d>(
      () =>
        new Worker(new URL("./fixtures/worker_pool.ts", import.meta.url), {
          type: "module",
        }),
      poolOptions
    );
    const controller = thing[proxyRemoteData]?.controller as any;

    const promises: Promise<number>[] = [];
    for (let i = 0; i < poolOptions.max! * 3; i++) {
      promises.push(thing.sum(1, 2));
    }
    expect(controller.workers.size).toBe(poolOptions.max!);

    expect(Promise.all(promises)).resolves.toBeDefined();
    await new Promise((resolve) =>
      setTimeout(resolve, poolOptions.idleTimeout! + 1)
    );
    expect(controller.workers.size).toBe(poolOptions.min!);
  });
});
