/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import * as vscode from 'vscode';
import * as commands from './commands';
import { sync } from 'cross-spawn';
import { getTestOutlineProvider, TestNode } from './views/testOutlineProvider';
import { AgentTestRunner, TestRunType } from './views/testRunner';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
// see "contributes" property in package.json for command list
export async function activate(context: vscode.ExtensionContext) {
  try {
    /**
     * TODO:
     * look at E4D CoreExtensionService to see if we need something similar
     * decide if we want a hard CLI dependency, ensure it's installed, etc...
     */

    const versions = sync('sf', ['version', '--verbose', '--json']);
    if (!versions.output.toString().includes('agent')) {
      throw new Error('sf CLI + plugin-agent installed required');
    }
    const disposables: vscode.Disposable[] = [];

    // Command Registration
    disposables.push(commands.registerOpenAgentInOrgCommand());
    context.subscriptions.push(registerTestView());
    await getTestOutlineProvider().refresh();
    context.subscriptions.push(...disposables);
  } catch (err: unknown) {
    throw new Error(`Failed to initialize: ${(err as Error).message}`);
  }
}

const registerTestView = (): vscode.Disposable => {
  const testOutlineProvider = getTestOutlineProvider();
  // Create TestRunner
  const testRunner = new AgentTestRunner(testOutlineProvider);

  // Test View
  const testViewItems = new Array<vscode.Disposable>();

  const testProvider = vscode.window.registerTreeDataProvider('sf.agent.test.view', testOutlineProvider);
  testViewItems.push(testProvider);

  // Run Test Button on Test View command
  testViewItems.push(vscode.commands.registerCommand('sf.agent.test.view.run', () => testRunner.runAllAgentTests()));
  // Show Error Message command
  testViewItems.push(
    vscode.commands.registerCommand('sf.agent.test.view.showError', (test: TestNode) =>
      testRunner.showErrorMessage(test)
    )
  );
  // Show Definition command
  testViewItems.push(
    vscode.commands.registerCommand('sf.agent.test.view.goToDefinition', (test: TestNode) =>
      testRunner.showErrorMessage(test)
    )
  );
  // Run Class Tests command
  testViewItems.push(
    vscode.commands.registerCommand('sf.agent.test.view.runClassTests', (test: TestNode) =>
      testRunner.runAgentTests([test.name], TestRunType.All)
    )
  );

  // Refresh Test View command
  testViewItems.push(
    vscode.commands.registerCommand('sf.agent.test.view.refresh', () => {
      return testOutlineProvider.refresh();
    })
  );
  // Collapse All Apex Tests command
  testViewItems.push(
    vscode.commands.registerCommand('sf.agent.test.view.collapseAll', () => testOutlineProvider.collapseAll())
  );

  return vscode.Disposable.from(...testViewItems);
};
