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

/// <reference lib="webworker" />

import * as Comlink from "../../src/comlink";
import { locks } from "web-locks";

(navigator as any).locks = locks;
const sum = (a: number, b: number) => a + b;
export default sum;

const self = globalThis as unknown as SharedWorkerGlobalScope;
self.onconnect = function (event) {
  const port = event.ports[0];

  Comlink.expose(sum, port, ["*"], 30);
};
