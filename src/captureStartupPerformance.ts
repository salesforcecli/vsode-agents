/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { ExtensionActivationStats } from './types';
import { parseStartupPerformanceFile } from './helpers/parseStartupPerformance';
import { waitForPerfDataToStabilize } from './helpers/waitForPerfDataToStabilize';

export const captureStartupPerformance = async (): Promise<void> => {
  console.log('Method - This is the Capture Startup Performance class!');

  try {
    // Show running notification to the user
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SFDX: Capture Startup Performance',
        cancellable: false
      },
      async progress => {
        progress.report({ message: 'Running...' });

        // open Developer: Startup Performance (open via API - try "perfview.show")
        const perfStatsDoc = await openStartupPerformanceFile();

        progress.report({
          message: 'Closing Capture Startup Performance view...'
        });
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        progress.report({
          message: 'Waiting for Startup Performance view to stabilize...'
        });
        const stable = await waitForPerfDataToStabilize(5000, 500, () => {
          return perfStatsDoc ? perfStatsDoc.getText() : '';
        }); // Wait for 5 seconds, checking every 500ms

        progress.report({ message: 'Capturing Startup Performance Data...' });
        const contents = await captureStartupPerfContents(perfStatsDoc);

        progress.report({ message: 'Parsing captured contents...' });
        const parsedResults = await parseStartupPerformanceFile(contents);

        // send parsed results to appinsights
        await sendTelemetryData(parsedResults, stable);
      }
    );

    // Show success notification to the user
    vscode.window.showInformationMessage('SFDX: Capture Startup Performance command completed successfully.');
  } catch (error) {
    // Show failure notification to the user
    vscode.window.showErrorMessage('SFDX: Capture Startup Performance command failed: ' + error.message);
  }
};

// ------- Helper Functions -------

const openStartupPerformanceFile = async (): Promise<vscode.TextDocument | undefined> => {
  await vscode.commands.executeCommand('perfview.show');
  const activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  return activeEditor?.document;
};

const captureStartupPerfContents = async (document: vscode.TextDocument | undefined): Promise<string> => {
  if (document) {
    return document.getText();
  } else {
    return '';
  }
};

const sendTelemetryData = async (extensionStats: ExtensionActivationStats[], stableData: boolean): Promise<void> => {
  console.log(`Perf Data: found stats for ${extensionStats.length} extensions`);

  for (const extensionStat of extensionStats) {
    // for now log to debug
    console.log(`Perf Data: ${extensionStat.extension} finish activate time: ${extensionStat.finishActivate} stableData: ${stableData}`);
  }
};
