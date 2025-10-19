/**
 * Bun workaround
 * ref: https://github.com/oven-sh/bun/issues/15931
 */
export class BunWorkerPatched {
  constructor(src: URL, options?: WorkerOptions) {
    const workerCode = `
let port = undefined;
globalThis.onmessage = async (e) => {
  if (e.data && e.data.type === 'connect') {
    port = e.ports && e.ports[0];
    if (!port) return;
    
    port.start();
    await import('${src.pathname.slice(1)}');
  }
};

globalThis.postMessage = (msg, transfer) => {
  port?.postMessage(msg, transfer);
};
globalThis.addEventListener = (type, eh, op) => {
  port?.addEventListener(type, eh, op);
};
globalThis.removeEventListener = (type, eh, op) => {
  port?.removeEventListener(type, eh, op);
};
`;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(workerUrl, options);

    const { port1, port2 } = new MessageChannel();
    this.worker.postMessage({ type: "connect" }, [port1]);
    port2.start();
    this.port = port2;
  }

  private worker: Worker;
  private port: MessagePort;
  public postMessage(message: any, transfer?: Transferable[]) {
    this.port.postMessage(message, transfer ?? []);
  }
  public addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) {
    this.port.addEventListener(type, listener, options);
  }
  public removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) {
    this.port.removeEventListener(type, listener, options);
  }
  public terminate() {
    this.port.close();
    this.worker.terminate();
  }
}
