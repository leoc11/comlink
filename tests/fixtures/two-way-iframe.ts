import * as Comlink from "../../src/comlink";

const parentEndpoint = Comlink.windowEndpoint(self.parent);
const wrappedParent =
  Comlink.wrap<Comlink.ProxyMarked<(b: number) => number>>(parentEndpoint);

export default Comlink.expose(async (a: number, b: number) => {
  return a + (await wrappedParent(b));
}, parentEndpoint);
