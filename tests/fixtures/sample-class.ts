import { proxy, proxyMarker } from "../../src/comlink";

export class SampleClass {
  constructor(counterInit = 1) {
    this._counter = counterInit;
    this._promise = Promise.resolve(4);
  }

  public _counter: number;
  public _promise: Promise<number>;

  static get SOME_NUMBER() {
    return 4;
  }

  static ADD(a: number, b: number) {
    return a + b;
  }

  get counter() {
    return this._counter;
  }

  set counter(value) {
    this._counter = value;
  }

  get promise() {
    return this._promise;
  }

  public deepObject = {
    level1: {
      value: 1,
      [proxyMarker]: true,
      level2: {
        value: 2,
        level3: {
          value: 3,
          [proxyMarker]: true,
        },
      },
    },
  };

  method() {
    return 4;
  }

  increaseCounter(delta = 1) {
    this._counter += delta;
  }

  promiseFunc() {
    return new Promise((resolve) => setTimeout((_) => resolve(4), 100));
  }

  proxyFunc() {
    return proxy({
      counter: 0,
      inc() {
        this.counter++;
      },
    });
  }

  throwsAnError() {
    throw Error("OMG");
  }
}
