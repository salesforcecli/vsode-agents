/**
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

const logger = (msg, obj) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, obj);
  }
};

const extensionDirectory = process.cwd();
logger('CWD', { extensionDirectory });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageContents = require(`${extensionDirectory}/package.json`);
const {writeFileSync} = require("fs");
if (!packageContents) {
  console.error('Failed to find extension package.json');
  process.exit(2);
}

const packagingConfig = packageContents.packaging;

if (!packagingConfig) {
  console.error('No packaging config found.');
  process.exit(2);
}

const newPackage = Object.assign({}, packageContents, packagingConfig.packageUpdates);
delete newPackage.packaging;

logger('Write the new package.json file.');
writeFileSync(`./package.json`, JSON.stringify(newPackage, null, 2), 'utf-8');

logger('VSIX package.json updated.');
process.exit(0);
