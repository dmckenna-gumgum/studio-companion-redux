// polyfill-queueMicrotask.js
;(function (g) {
  // try globalThis, fallback to window or global
  const host = g || globalThis || window || global;
  if (!host.queueMicrotask) {
    host.queueMicrotask = cb => Promise.resolve().then(cb);
  }
})(this);