import { expose, Remote, UnProxyMarked } from "../../src/comlink";
import type worker_1 from "./worker_1";

let other: Remote<UnProxyMarked<typeof worker_1>>;
export default expose({
  init: async (w1: Remote<UnProxyMarked<typeof worker_1>>) => {
    other = w1;
  },
  get: () => {
    return other.value();
  },
  getValue: async function () {
    const val = await other.value();
    return await val.value;
  },
  getNumberValue: async function () {
    const c = await new other.NumberValue(8);
    return c;
  },
});
