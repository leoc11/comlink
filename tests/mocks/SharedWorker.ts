type SharedWorkerEntry = {
  worker: Worker;
  connections: Set<MessagePort>;
};
const sharedWorkerMap = new Map<string, SharedWorkerEntry>();

export class SharedWorker {
  constructor(src: URL, options?: WorkerOptions) {
    this._src = src;

    if (!sharedWorkerMap.has(src.href)) {
      const workerCode = `
globalThis.SharedWorkerGlobalScope = globalThis.constructor;
await import('${src.pathname.slice(1)}');
globalThis.onmessage = (e) => {
  // we treat 'connect' specially
  if (e.data && e.data.type === 'connect') {
    const port = e.ports && e.ports[0];
    if (!port) return;
    globalThis.onconnect?.(e);
  }
};
  `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl, options);

      sharedWorkerMap.set(src.href, {
        worker: worker,
        connections: new Set(),
      });
    }

    this._entry = sharedWorkerMap.get(src.href)!;
    const { port1, port2 } = new MessageChannel();
    this._entry?.worker.postMessage({ type: "connect" }, [port1]);
    this.port = port2;
    this._entry?.connections.add(port2);
  }

  private _src: URL;
  private _entry: SharedWorkerEntry;
  public port: MessagePort;
  public close() {
    try {
      this.port.close();
    } catch {}
    this._entry.connections.delete(this.port);
    if (this._entry.connections.size === 0) {
      this._entry.worker.terminate();
      sharedWorkerMap.delete(this._src.href);
    }
  }
}
