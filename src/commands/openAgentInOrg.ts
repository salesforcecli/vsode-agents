import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject } from '@salesforce/core';
import * as path from 'path';
import * as shell from 'shelljs';

export const registerOpenAgentInOrgCommand = () => {
  return vscode.commands.registerCommand(Commands.openAgentInOrg, async () => {
    // we need to prompt the user which agent to open
    // TODO: maybe an Agent.listLocal() or something similar in the library
    const project = SfProject.getInstance();
    const defaultPath = project.getDefaultPackage().fullPath;
    const agents = (
      await vscode.workspace.fs.readDirectory(vscode.Uri.file(path.join(defaultPath, 'main', 'default', 'bots')))
    ).map(f => f[0]);

    const agentName = await vscode.window.showQuickPick(agents, { title: 'Choose which Agent to open' });

    if (!agentName) {
      throw new Error('Agent must be selected');
    }

    // const c = CoreExtensionService.getChannelService().showCommandWithTimestamp(`org:open:agent --name ${agentn}`);

    // shell out to the CLI - maybe look at adding frontdoor/file/open logic to library?
    // const execution = new CliCommandExecutor(new SfCommandBuilder().withArg('org:display').withJson().build(), {
    //   cwd: projectPath
    // }).execute();

    const res = shell.exec(`sf org open agent --name ${agentName} 2>&1`, {});

    if (res.at(0)) {
      throw new Error('abc');
    }
  });
};
