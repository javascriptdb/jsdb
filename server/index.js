if(typeof Bun !== 'undefined') {
  (await import('./runtimes/bun/index.js'))
} else if (process?.release?.name === 'node') {
  (await import('./runtimes/node/index.js'))
}