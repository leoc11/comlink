import * as Comlink from "../../src/comlink";

export default Comlink.expose(
  (a: number, b: number) => a + b,
  Comlink.windowEndpoint(self.parent)
);
