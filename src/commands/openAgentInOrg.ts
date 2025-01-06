import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject } from '@salesforce/core';
import * as path from 'path';
import { sync } from 'cross-spawn';

export const registerOpenAgentInOrgCommand = () => {
  return vscode.commands.registerCommand(Commands.openAgentInOrg, async () => {
    // TODO: maybe an Agent.listLocal() or something similar in the library
    const project = SfProject.getInstance();
    const defaultPath = project.getDefaultPackage().fullPath;
    const agents = (
      await vscode.workspace.fs.readDirectory(vscode.Uri.file(path.join(defaultPath, 'main', 'default', 'bots')))
    ).map(f => f[0]);

    // we need to prompt the user which agent to ope
    const agentName = await vscode.window.showQuickPick(agents, { title: 'Choose which Agent to open' });

    if (!agentName) {
      throw new Error('No Agent selected');
    }
    const result = sync('sf', ['org', 'open', 'agent', '--name', agentName]);
    if (result.status !== 0) {
      vscode.window.showErrorMessage(`Unable to open agent: ${result.stderr.toString()}`);
    }
  });
};
