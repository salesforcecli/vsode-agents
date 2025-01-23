/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as events from 'events';
import * as vscode from 'vscode';
import { AgentTestOutlineProvider, type AgentTestGroupNode, type TestNode } from './testOutlineProvider';
import { AgentTester } from '@salesforce/agents';
import { ConfigAggregator, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';

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
    try {
      const configAggregator = await ConfigAggregator.create();

      const org = await Org.create({
        aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
      });
      // set the mock directory here - needs to be removed;
      process.env.SF_MOCK_DIR = '/Users/william.ruemmele/projects/oss/agents/test/mocks';

      const tester = new AgentTester(org.getConnection());
      const response = await tester.start(test.name);
      await vscode.window.showInformationMessage(`Test ${test.name} ran with status: ${response.status}`);

      const result = await tester.poll(response.aiEvaluationId, { timeout: Duration.minutes(100) });
      this.testOutline.getChild(test.name)?.updateOutcome(result.status);

      if (result.status === 'ERROR') {
        vscode.window.showErrorMessage(`Test ${test.name} failed with error: ${result.errorMessage}`);
      }
      if (result.status === 'COMPLETED') {
        vscode.window.showInformationMessage(`Test ${test.name} completed successfully`);
      }
    } catch (e) {
      this.testOutline.getChild(test.name)?.updateOutcome('ERROR');
      vscode.window.showErrorMessage(`Error running test: ${(e as Error).message}`);
    } finally {
      // will update icons
      this.testOutline.refreshView();
    }
  }
}
