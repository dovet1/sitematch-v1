// Next resolves the 'server-only' guard itself; plain Node does not ship it. Preload this
// (tsx --require ./scripts/lib/server-only-stub.cjs) so a read-only script can exercise the
// real server read path. It stubs only that one module.
const Module = require('node:module')
const load = Module._load
Module._load = function (request, ...rest) {
  if (request === 'server-only') return {}
  return load.call(this, request, ...rest)
}
