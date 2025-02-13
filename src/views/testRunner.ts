/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as events from 'events';
import * as vscode from 'vscode';
import { AgentTestOutlineProvider } from './testOutlineProvider';
import { AgentTester, humanFriendlyName } from '@salesforce/agents-bundle';
import { ConfigAggregator, Org } from '@salesforce/core-bundle';
import { Duration } from '@salesforce/kit';
import type { AgentTestGroupNode, TestNode } from '../types';
import { CoreExtensionService } from '../services/coreExtensionService';

export class AgentTestRunner {
  private eventsEmitter: events.EventEmitter;
  constructor(
    private testOutline: AgentTestOutlineProvider,
    eventsEmitter?: events.EventEmitter
  ) {
    this.eventsEmitter = eventsEmitter || new events.EventEmitter();
    this.eventsEmitter.on('sf:update_selection', this.updateSelection);
  }

  public goToTest(test: TestNode) {
    if (test.location) {
      vscode.window.showTextDocument(test.location.uri).then(() => {
        this.eventsEmitter.emit('sf:update_selection', test.location?.range);
      });
    }
  }

  public updateSelection(index: vscode.Range | number) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      if (index instanceof vscode.Range) {
        editor.selection = new vscode.Selection(index.start, index.end);
        editor.revealRange(index); // Show selection
      } else {
        const line = editor.document.lineAt(index);
        const startPos = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
        editor.selection = new vscode.Selection(startPos, line.range.end);
        editor.revealRange(line.range); // Show selection
      }
    }
  }

  public async runAgentTest(test: AgentTestGroupNode) {
    const channelService = CoreExtensionService.getChannelService();
    try {
      channelService.clear();
      channelService.showChannelOutput();

      channelService.appendLine(`Running tests for: ${test.name}`);

      const configAggregator = await ConfigAggregator.create();
      const org = await Org.create({
        aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
      });

      const tester = new AgentTester(org.getConnection());
      channelService.appendLine(`Starting ${test.name} tests: ${new Date().toLocaleString()}`);

      const response = await tester.start(test.name, 'name');
      // begin in-progress
      this.testOutline.getTestGroup(test.name)?.updateOutcome('IN_PROGRESS', true);
      channelService.appendLine(`Job Id: ${response.runId}`);

      const result = await tester.poll(response.runId, { timeout: Duration.minutes(100) });
      this.testOutline.getTestGroup(test.name)?.updateOutcome('IN_PROGRESS', true);

      channelService.appendLine(`Finished ${test.name} - Status: ${result.status}`);

      let hasFailure = false;
      result.testCases.forEach(testCase => {
        testCase.testResults.forEach(expectation => {
          // only print to the output panel for failures
          if (expectation.result === 'FAILURE') {
            hasFailure = true;
            channelService.appendLine(`Failed: ${testCase.inputs.utterance}`);
            channelService.appendLine(`\t --- ${humanFriendlyName(expectation.name)} ---`);

            // helps wrap string expectations in quotes to separate from other verbiage on the line
            if (!expectation.expectedValue.startsWith('[') && !expectation.actualValue.startsWith('[')) {
              expectation.expectedValue = `"${expectation.expectedValue}"`;
              expectation.actualValue = `"${expectation.actualValue}"`;
            }

            channelService.appendLine(`\t Expected: ${expectation.expectedValue}`);
            channelService.appendLine(`\t Actual: ${expectation.actualValue}`);
            channelService.appendLine(
              `\t ${expectation.metricLabel}, ${expectation.metricExplainability}: ${expectation.score}`
            );
            channelService.appendLine(`\t ${expectation.errorMessage}`);
            // also update image to failure
            this.testOutline
              .getTestGroup(test.name)
              ?.getChildren()
              .find(child => child.name === `#${testCase.testNumber}`)
              ?.updateOutcome('ERROR');
            channelService.appendLine(`\n`);
          } else {
            // updates the test case to completed
            this.testOutline
              .getTestGroup(test.name)
              ?.getChildren()
              .find(child => child.name === `#${testCase.testNumber}`)
              ?.updateOutcome('COMPLETED');
          }
        });
      });

      this.testOutline.getTestGroup(test.name)?.updateOutcome(hasFailure ? 'ERROR' : 'COMPLETED');
    } catch (e) {
      this.testOutline.getTestGroup(test.name)?.updateOutcome('ERROR', true);
      channelService.appendLine(`Error running test: ${(e as Error).message}`);
    }
  }
}
