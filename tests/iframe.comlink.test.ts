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
import type iframet from "./fixtures/iframe";
import { HTMLIFrameElement } from "./mocks/HTMLIFrameElement";

describe("Comlink across iframes", function () {
  const createIframe = async () => {
    const iframe = new HTMLIFrameElement(import.meta.url);
    iframe.src = "./fixtures/iframe.ts";
    await new Promise<void>((resolve) => (iframe.onload = resolve));
    return iframe;
  };

  test("can communicate", async function () {
    const iframe = await createIframe();
    const proxy = Comlink.wrap<typeof iframet>(
      Comlink.windowEndpoint(iframe.contentWindow)
    );
    expect(await proxy(1, 3)).toBe(4);
  });

  test("Symbol.asyncDispose closes Endpoint", async function () {
    const iframe = await createIframe();
    const endpoint = Comlink.windowEndpoint(iframe.contentWindow);
    const proxy = Comlink.wrap<typeof iframet>(endpoint);
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
});
