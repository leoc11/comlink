import { MessageType, WireValueType } from "../../src/protocol";

globalThis.addEventListener("message", (ev) => {
  if (ev.data === "start") {
    // send back a message to modify the prototype
    parent.postMessage(
      {
        id: 1,
        type: MessageType.SET,
        value: { type: WireValueType.RAW, value: "x" },
        path: ["__proto__", "foo"],
        pid: 0,
      },
      "*"
    );
    parent.postMessage("done", "*");
  }
});
parent.postMessage("ready", "*");
