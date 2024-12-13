/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { marked } from 'marked';
import { ExtensionActivationStats, ElementAttributes } from '../types';

/**
 * Parses the contents of the startup performance file and extension activation stats
 * for extensions belonging to salesforce.salesforcedx*
 *
 * @see https:
 *
 * @example
 * # Extension Activation Stats
 * | Extension                                                  | Eager | Load Code | Call Activate | Finish Activate | Event                                     | By                                                         |
 * | ---------------------------------------------------------- | ----- | --------- | ------------- | --------------- | ----------------------------------------- | ---------------------------------------------------------- |
 * | vscode.git                                                 | true  | 71        | 4             | 327             | *                                         | vscode.git                                                 |
 * | vscode.git-base                                            | true  | 2         | 0             | 0               | *                                         | vscode.git                                                 |
 * | vscode.github                                              | true  | 30        | 2             | 6               | *                                         | vscode.github                                              |
 * | salesforce.salesforcedx-vscode-core                        | true  | 662       | 4             | 1224            | workspaceContains:sfdx-project.json       | salesforce.salesforcedx-vscode-core                        |
 * @param fileContents
 * @returns
 */
// export for testing
export const parseStartupPerformanceFile = async (fileContents: string): Promise<ExtensionActivationStats[]> => {
  const parsedData = marked.lexer(fileContents);
  const extensionStats: ExtensionActivationStats[] = [];

  // Traverse the parsed data
  parsedData.forEach(token => {
    if (token.type === 'heading' && token.depth === 2 && token.text === 'Extension Activation Stats') {
      // Found the section for Extension Activation Stats
      let inTable = false;
      let headers: ElementAttributes[] = [];

      for (let i = parsedData.indexOf(token) + 1; i < parsedData.length; i++) {
        const nextToken = parsedData[i];

        if (nextToken.type === 'table') {
          inTable = true;
          headers = nextToken.header;

          nextToken.rows.forEach((row: ElementAttributes[]) => {
            const rowData: ExtensionActivationStats = {
              extension: '',
              eager: false,
              loadCode: 0,
              callActivate: 0,
              finishActivate: 0,
              event: '',
              by: ''
            };
            headers.forEach((header, index) => {
              switch (header.text) {
                case 'Extension':
                  rowData.extension = row[index].text;
                  break;
                case 'Eager':
                  rowData.eager = row[index].text === 'true';
                  break;
                case 'Load Code':
                  const loadCode = parseInt(row[index].text);
                  rowData.loadCode = Number.isInteger(loadCode) ? loadCode  : undefined;
                  break;
                case 'Call Activate':
                  const callActivate = parseInt(row[index].text);
                  rowData.callActivate = Number.isInteger(callActivate) ? callActivate : undefined;
                  break;
                case 'Event':
                  rowData.event = row[index].text;
                  break;
                case 'By':
                  rowData.by = row[index].text;
                  break;
                case 'Finish Activate':
                  const finishActivate = parseInt(row[index].text);
                  rowData.finishActivate = Number.isInteger(finishActivate) ? finishActivate : undefined;
                  break;
                default:
                  break;
              }
            });

            extensionStats.push(rowData);
          });
        }

        if (inTable && nextToken.type !== 'table') {
          // Exit the loop once we are out of the table
          break;
        }
      }
    }
  });

  return extensionStats.filter(extensionStat => extensionStat.extension.startsWith('salesforce.salesforcedx'));
};
