/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as events from 'events';
import * as vscode from 'vscode';
import { AgentTestGroupNode, AgentTestNode, TestNode } from './testOutlineProvider';
import { AgentTester } from '@salesforce/agents';
import { ConfigAggregator, Org } from '@salesforce/core';

export class AgentTestRunner {
  private eventsEmitter: events.EventEmitter;
  constructor(eventsEmitter?: events.EventEmitter) {
    this.eventsEmitter = eventsEmitter || new events.EventEmitter();
    this.eventsEmitter.on('sf:update_selection', this.updateSelection);
  }

  public showErrorMessage(test: TestNode) {
    let testNode = test;
    let position: vscode.Range | number = test.location!.range;
    if (testNode instanceof AgentTestGroupNode) {
      if (test.contextValue === 'agentTestGroup_Fail') {
        const failedTest = test.children.find(testCase => testCase.contextValue === 'agentTest_Fail');
        if (failedTest) {
          testNode = failedTest;
        }
      }
    }
    if (testNode instanceof AgentTestNode) {
      const errorMessage = testNode.errorMessage;
      if (errorMessage && errorMessage !== '') {
        const stackTrace = testNode.stackTrace;
        position = parseInt(stackTrace.substring(stackTrace.indexOf('line') + 4, stackTrace.indexOf(',')), 10) - 1; // Remove one because vscode location is zero based
        // channelService.appendLine('-----------------------------------------');
        // channelService.appendLine(stackTrace);
        // channelService.appendLine(errorMessage);
        // channelService.appendLine('-----------------------------------------');
        // channelService.showChannelOutput();
      }
    }

    if (testNode.location) {
      vscode.window.showTextDocument(testNode.location.uri).then(() => {
        this.eventsEmitter.emit('sf:update_selection', position);
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

  public async runAgentTest(definition: string) {
    const ca = await ConfigAggregator.create();
    const org = await Org.create({ aliasOrUsername: ca.getPropertyValue<string>('target-org') ?? 'undefined' });

    const at = new AgentTester(org.getConnection());
    at.start(definition);
  }
}
