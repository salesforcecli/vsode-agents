#! /usr/bin/env node
/**
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import * as shell from 'shelljs';
type WorkflowRun = {
  databaseId: string;
};
const EXTENSION_ID = 'salesforce.salesforcedx-einstein-gpt';
const SAVE_DIRECTORY = './.localTesting/';
const IDE = process.argv[2] as string;

const logger = (msg: string, obj?: unknown) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, obj);
  }
};

logger('==========================');
logger('Hello easier VSIX testing!');
logger('==========================\n');

if (shell.test('-e', SAVE_DIRECTORY)) {
  logger(`Deleting previous VSIX files. \n`);
  shell.rm('-rf', SAVE_DIRECTORY);
}

logger('The branch that you are testing with is: ');
const currentBranch = shell.exec(`git branch --show-current`);
logger('\n');

logger('Getting the latest successful Commit Workflow for this run');
const latestWorkflowForBranch = shell
  .exec(`gh run list -e push -s success -L 1  --json databaseId -b ${currentBranch}`)
  .toString()
  .trim();
logger('\n');

if (latestWorkflowForBranch === '[]') {
  logger('No successful workflow runs found for this branch. Exiting.');
  process.exit(0);
}

const ghJobRun: WorkflowRun = JSON.parse(latestWorkflowForBranch.toString())[0];

logger(`Saving the resources for job ID ${ghJobRun.databaseId} \n`);
shell.exec(`gh run download ${ghJobRun.databaseId} --dir ${SAVE_DIRECTORY}`);

const einsteinPath = shell.find(SAVE_DIRECTORY).filter(function (file) {
  return file.includes('einstein');
});

if (einsteinPath) {
  logger('Cleaning up any old GPT versions (if applicable) and installing the new VSIX.');
  shell.exec(`${IDE} --uninstall-extension ${EXTENSION_ID}`);
  shell.exec(`${IDE} --install-extension ${einsteinPath}`);
  logger(`Done! Einstein VSIX was installed in ${IDE}. Reload VS Code and start your testing.`);
} else {
  logger(`No VSIX for Einstein could be installed from your ${SAVE_DIRECTORY}.`);
}
