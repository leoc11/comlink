import { parentPort } from "node:worker_threads";
import * as Comlink from "../../src/comlink";

export default Comlink.expose(
  (a: number, b: number) => a + b,
  Comlink.nodeEndpoint(parentPort!)
);
