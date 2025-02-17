/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const { build } = require('esbuild');
const esbuildPluginPino = require('esbuild-plugin-pino');
const fs = require('fs');

const copyFiles = (src, dest) => {
  const stats = fs.statSync(src);
  try {
    if (stats.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.cpSync(src, dest);
    }
    console.log(`Copied from ${src} to ${dest}`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

// copy core-bundle/lib/transformStream.js to dist if core-bundle is included
const srcPathTransformStream = './node_modules/@salesforce/core-bundle/lib/transformStream.js';
const destPathTransformStream = './dist/transformStream.js';

(async () => {
  await build({
    bundle: true,
    entryPoints: ['./src/extension.ts'],
    external: ['vscode'],
    format: 'cjs',
    keepNames: true,
    loader: { '.node': 'file' },
    logOverride: {
      'unsupported-dynamic-import': 'error'
    },
    minify: true,
    outdir: 'dist',
    platform: 'node',
    plugins: [esbuildPluginPino({ transports: ['pino-pretty'] })],
    supported: { 'dynamic-import': false }
  });
})()
  .then(() => {
    copyFiles(srcPathTransformStream, destPathTransformStream);
  })
  .catch(() => process.exit(1));
