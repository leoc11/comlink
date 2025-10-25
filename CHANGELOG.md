# v4.4.2 -> v4.4.2-fork.1
FEATURE
- `Comlink.opch` for optional chaining `Remote` object
- `Comlink.pool`. `Comlink.wrap` with thread pool (close: #657)
- `Comlink.unexpose` to release exposed object (close: #674)
- support `Symbol.iterator` and `Symbol.asyncIterator` on exposed side. wrap as `Symbol.asyncIterator` in proxy.
- add ReadyMessage. wait for exposed side to ready before sending any message. (close: #665, #635)
- add HeartBeat (close: #673)
- Always use the same endpoint for communication between thread.
- Always create direct communication line between thread, avoid transit. (avoid re-proxy proxy)
- `Remote` object are transferred by default. no need to wrap with `Comlink.proxy()`
- `Comlink.Proxy` no longer polute object
- Proxy tracker.
  - When proxy object return to source thread, it will serialize to real object.
  - Same proxy will be deserialize for the same `Comlink.ProxyMarked` on exposed side.
- Improve typing.
  - close #680
  - support function overloading

BREAKING CHANGES
- `Comlink.createEndPoint` removed.
- `Comlink.proxyRelease` removed. use `Symbol.asyncDispose` instead
- `Comlink.finalizer` removed. use `Symbol.dispose` or `Symbol.asyncDispose` instead
- typing: `Comlink.warp` only accept `Comlink.ProxyMarked` type returned by `Comlink.expose`
- Function are proxied by default. no need to wrap with `Comlink.proxy()`
- Original value provided in `Comlink.proxy()` won't be automatically proxied anymore. Only return value from `Comlink.proxy()` will be proxied.

PERFORMANCE
- use incremental number instead of UUID for MessageID.
- use the same Proxy Target for all proxy.
