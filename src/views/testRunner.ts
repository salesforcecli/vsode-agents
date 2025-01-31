/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as events from 'events';
import * as vscode from 'vscode';
import { AgentTestOutlineProvider } from './testOutlineProvider';
import { AgentTester } from '@salesforce/agents';
import { ConfigAggregator, Org } from '@salesforce/core';
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

  private translateExpectationNameToHumanFriendly(expectationName: string): 'Topic' | 'Actions' | 'Response' {
    switch (expectationName) {
      case 'topic_sequence_match':
        return 'Topic';
      case 'action_sequence_match':
        return 'Actions';
      case 'bot_response_rating':
        return 'Response';
      default:
        return 'Response';
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
      this.testOutline.getChild(test.name)?.updateOutcome(response.status);
      channelService.appendLine(`Job Id: ${response.aiEvaluationId}`);

      const result = await tester.poll(response.aiEvaluationId, { timeout: Duration.minutes(100) });
      this.testOutline.getChild(test.name)?.updateOutcome(result.status);

      channelService.appendLine(`Finished ${test.name} - Status: ${result.status}`);
      result.testSet.testCases.forEach(testCase => {
        testCase.testResults.forEach(expectation => {
          // only print to the output panel for failures
          if (expectation.result === 'FAILURE') {
            channelService.appendLine(`Failed: ${test.description}`);
            channelService.appendLine(`\t --- ${this.translateExpectationNameToHumanFriendly(expectation.name)} ---`);

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
              .getChild(test.name)
              ?.children.find(child => child.description === testCase.inputs.utterance)
              ?.updateOutcome('ERROR');
            channelService.appendLine(`\n`);
          }
        });
      });
    } catch (e) {
      this.testOutline.getChild(test.name)?.updateOutcome('ERROR');
      channelService.appendLine(`Error running test: ${(e as Error).message}`);
    }
  }
}
