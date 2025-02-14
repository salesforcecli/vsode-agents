/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const { build } = require('esbuild');
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
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    format: 'cjs',
    external: ['vscode'],
    platform: 'node',
    minify: true
  });
})()
  .then(() => {
    copyFiles(srcPathTransformStream, destPathTransformStream);
  })
  .catch(() => process.exit(1));
