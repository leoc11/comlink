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
import * as Comlink from "../src/comlink";
import { HTMLIFrameElement } from "./mocks/HTMLIFrameElement";
Error.stackTraceLimit = 100;
describe("Comlink origin filtering", function () {
  test("rejects messages from unknown origin", async function () {
    // expose on our window so comlink is listening to window postmessage
    const obj = { my: "value" };
    Comlink.expose(obj, self, [/^http:\/\/localhost(:[0-9]+)?\/?$/]);

    let handler: any = null;
    let ifr: HTMLIFrameElement = null as any;
    // juggle async timings to get the attack started
    const attackComplete = new Promise<void>((resolve) => {
      handler = ((ev: MessageEvent) => {
        if (ev.data === "ready" && ev.origin === "null") {
          // tell the iframe it can start the attack
          ifr.contentWindow.postMessage("start", "*");
        } else if (ev.data === "done") {
          // confirm the attack failed, the prototype was not updated
          expect((Object as any).prototype.foo).toBeUndefined();
          expect(obj.my).toBe("value");
          resolve();
        }
      }) as any;
      globalThis.addEventListener("message", handler);
    });

    ifr = new HTMLIFrameElement(import.meta.url, "null");
    ifr.src = "./fixtures/attack-iframe.ts";
    await new Promise<void>((resolve) => (ifr.onload = resolve));
    // and wait for the attack to complete
    await attackComplete;
    globalThis.removeEventListener("message", handler);
  });
  test("accepts messages from matching origin", async function () {
    // expose on our window so comlink is listening to window postmessage
    const obj = { my: "value" };
    Comlink.expose(obj, self, [/^http:\/\/localhost(:[0-9]+)?\/?$/]);

    let handler: any = null;
    let ifr: HTMLIFrameElement = null as any;
    // juggle async timings to get the attack started
    const attackComplete = new Promise<void>((resolve, reject) => {
      handler = ((ev: MessageEvent) => {
        if (ev.data === "ready") {
          // tell the iframe it can start the attack
          ifr.contentWindow.postMessage("start", "*");
        } else if (ev.data === "done") {
          // confirm the attack succeeded, the prototype was updated
          expect((Object as any).prototype.foo).toBe("x");
          expect(obj.my).toBe("value");
          resolve();
        }
      }) as any;
      globalThis.addEventListener("message", handler);
    });
    ifr = new HTMLIFrameElement(import.meta.url);
    ifr.src = "./fixtures/attack-iframe.ts";
    // and wait for the attack to complete
    await attackComplete;
    globalThis.removeEventListener("message", handler);
  });
});
