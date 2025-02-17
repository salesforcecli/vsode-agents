/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as events from 'events';
import * as vscode from 'vscode';
import { AgentTestOutlineProvider } from './testOutlineProvider';
import { AgentTester, TestStatus, AgentTestResultsResponse, humanFriendlyName } from '@salesforce/agents-bundle';
import { ConfigAggregator, Lifecycle, Org } from '@salesforce/core-bundle';
import { Duration } from '@salesforce/kit';
import type { AgentTestGroupNode, TestNode } from '../types';
import { CoreExtensionService } from '../services/coreExtensionService';
import { AgentTestNode } from '../types';

export class AgentTestRunner {
  private eventsEmitter: events.EventEmitter;
  private testGroupNameToResult = new Map<string, AgentTestResultsResponse>();
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
    const channelService = CoreExtensionService.getChannelService();
    channelService.showChannelOutput();
    channelService.clear();

    const resultFromMap = this.testGroupNameToResult.get(test.name) ?? this.testGroupNameToResult.get(test.parentName);
    if (resultFromMap) {
      // set to a new var so we can remove test cases and not affect saved information
      const testInfo = structuredClone(resultFromMap);
      if (test instanceof AgentTestNode) {
        // filter to selected test case
        testInfo.testCases = testInfo.testCases.filter(f => `#${f.testNumber}` === test.name);
      }
      testInfo.testCases.map(tc => {
        const testCaseTitle = ` ${testInfo.subjectName} (Test Case: ${tc.testNumber}) `;
        // +4, so there's two extra per side
        const testCasePadding = this.fillPadding(testCaseTitle.length + 4);
        channelService.appendLine(`┌${testCasePadding}┐`);
        channelService.appendLine(` ${testCaseTitle} `);
        channelService.appendLine(`└${testCasePadding}┘`);
        channelService.appendLine('');
        channelService.appendLine(`"${tc.inputs.utterance}"`);
        channelService.appendLine('');
        tc.testResults.map(tr => {
          const title = `${humanFriendlyName(tr.name)} ─ ${tr.result}`;
          // 37 char width bottom, 20 in top chars (excluding title) => 17 <= 17 is also longest possible combo
          const padding = this.fillPadding(17 - title.length);
          channelService.appendLine(`\t┌────────── ${title} ──${padding}────┐`);
          channelService.appendLine(`\t EXPECTED: ${tr.expectedValue.replaceAll('\n', '')}`);
          channelService.appendLine(`\t ACTUAL: ${tr.actualValue.replaceAll('\n', '')}`);
          channelService.appendLine(`\t STATS: ${tr.metricLabel}, ${tr.score}`);
          channelService.appendLine('\t└───────────────────────────────────┘');
        });
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
      let passing,
        failing,
        total = 0;
      const configAggregator = await ConfigAggregator.create();
      const lifecycle = await Lifecycle.getInstance();
      const org = await Org.create({
        aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
      });
      channelService.clear();
      channelService.showChannelOutput();
      const tester = new AgentTester(org.getConnection());
      channelService.appendLine(`Starting ${test.name} tests: ${new Date().toLocaleString()}`);
      vscode.window.withProgress(
        {
          //TODO: once we can cancel in progress tests
          cancellable: false,
          location: vscode.ProgressLocation.Notification,
          title: `Running ${test.name}`
        },
        async progress => {
          return new Promise((resolve, reject) => {
            lifecycle.on(
              'AGENT_TEST_POLLING_EVENT',
              async (data: {
                status: TestStatus;
                completedTestCases: number;
                totalTestCases: number;
                failingTestCases: number;
                passingTestCases: number;
              }) => {
                switch (data.status) {
                  case 'NEW':
                  case 'IN_PROGRESS':
                    // every time IN_PROGRESS is returned, 10 is added, is possible to 100% progress bar and tests not be done
                    progress.report({ increment: 10, message: `Status: ${data.status}` });
                    break;
                  case 'ERROR':
                  case 'TERMINATED':
                    passing = data.passingTestCases;
                    failing = data.failingTestCases;
                    total = data.totalTestCases;
                    reject();
                    break;
                  case 'COMPLETED':
                    passing = data.passingTestCases;
                    failing = data.failingTestCases;
                    total = data.totalTestCases;
                    progress.report({ increment: 100, message: `Status: ${data.status}` });
                    resolve({});
                    break;
                }
              }
            );
          });
        }
      );

      const response = await tester.start(test.name);
      // begin in-progress
      this.testOutline.getTestGroup(test.name)?.updateOutcome('IN_PROGRESS', true);
      channelService.appendLine(`Job Id: ${response.runId}`);

      const result = await tester.poll(response.runId, { timeout: Duration.minutes(100) });
      this.testGroupNameToResult.set(test.name, result);
      this.testOutline.getTestGroup(test.name)?.updateOutcome('IN_PROGRESS', true);
      let hasFailure = false;
      result.testCases.map(tc => {
        hasFailure = tc.testResults.some(tr => tr.result === 'FAILURE');

        // update the children, accordingly if they passed/failed
        this.testOutline
          .getTestGroup(test.name)
          ?.getChildren()
          .find(child => child.name === `#${tc.testNumber}`)
          ?.updateOutcome(hasFailure ? 'ERROR' : 'COMPLETED');
      });
      // update the parent's icon
      this.testOutline.getTestGroup(test.name)?.updateOutcome(hasFailure ? 'ERROR' : 'COMPLETED');
      channelService.appendLine(result.status);
      channelService.appendLine('');
      channelService.appendLine('Test Results');
      channelService.appendLine(`Passing: ${passing}/${total}`);
      channelService.appendLine(`Failing: ${failing}/${total}`);
      channelService.appendLine('');
      channelService.appendLine(`Select a test case in the Test View panel for more information`);
    } catch (e) {
      void Lifecycle.getInstance().emit('AGENT_TEST_POLLING_EVENT', { status: 'ERROR' });
      this.testOutline.getTestGroup(test.name)?.updateOutcome('ERROR', true);
      channelService.appendLine(`Error running test: ${(e as Error).message}`);
    }
  }

  fillPadding(num: number): string {
    return Array(num).fill('─').join('');
  }
}
