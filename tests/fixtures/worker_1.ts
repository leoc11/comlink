import { expose, proxy } from "../../src/comlink";
import { providerResourceMap } from "../../src/provider";

const value = {
  value: 1,
};
class NumberValue {
  constructor(public value: number) {}
}

export default expose({
  value: () => {
    return proxy(value);
  },
  NumberValue,
});
