export class HTMLIFrameElement {
  constructor(base?: string, origin: string = "http://localhost:80") {
    this._baseUrl = base;
    this.origin = origin;
  }

  private _baseUrl?: string;
  public set src(url: string) {
    if (this._baseUrl) {
      url = new URL(url, this._baseUrl).pathname.slice(1);
    }
    const workerCode = `
self.postMessage("loaded");
self.parent = {
  postMessage: (message, targetOrigin, transfer) => {
    self.postMessage(message, transfer);
  }
};

await import('${url}');
  `;

    if (this._worker) {
      this._worker.terminate();
      this._worker = undefined;
    }

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    this._worker = new Worker(workerUrl, { type: "module" });
    let isLoaded = false;
    this._worker.onmessage = (ev) => {
      if (!isLoaded) {
        if (ev.data === "loaded") {
          isLoaded = true;
          this.onload?.();
        }
        return;
      }

      globalThis.dispatchEvent(
        new MessageEvent("message", { data: ev.data, origin: this.origin })
      );
    };
  }
  public origin: string;
  public onload?: () => void;
  private _worker?: Worker;
  public contentWindow = {
    postMessage: (
      message: any,
      targetOrigin: string,
      transfer?: Transferable[]
    ) => {
      this._worker?.postMessage(message, transfer ?? []);
    },
  };
}
