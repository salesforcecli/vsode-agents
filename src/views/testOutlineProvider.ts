/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as xml from 'fast-xml-parser';
import type { AgentTestDetailsResponse } from '@salesforce/agents';

// Message
// const LOADING_MESSAGE = 'loading';
const NO_TESTS_MESSAGE = 'no tests found';
const NO_TESTS_DESCRIPTION = 'no test description';
const PASS_RESULT = 'pass';
const FAIL_RESULT = 'fail';
const SKIP_RESULT = 'skip';
const TEST_RESULT_JSON_FILE = 'tests.json';
const TEST_RUN_ID_FILE = 'testidfile';
const AGENT_TESTS = 'AgentTests';

const startPos = new vscode.Position(0, 0);
const endPos = new vscode.Position(0, 1);
export const AGENT_GROUP_RANGE = new vscode.Range(startPos, endPos);

const BASE_ID = 'sf.agent.test.view';

type AgentTestCase = {
  location: vscode.Location;
  number: number;
  inputs: { utterance: string };
  expectations: [{ expectation: { name: string; expectedValue: string } }];
};

const getAgentTests = async (): Promise<AgentTestCase[]> => {
  const aiTestDefs = await vscode.workspace.findFiles('**/*.aiEvaluationDefinition-meta.xml');
  //from the aiTestDef files, parse the xml using fast-xml-parser, find the testSetName key/value
  // read the file
  const parser = new xml.XMLParser();
  const v = parser.parse((await vscode.workspace.fs.readFile(aiTestDefs[0])).toString()) as {
    AiEvaluationDefinition: { testSetName: string };
  };

  // read the file, v, in the aiEvaluationTestset folder
  const aiTestSet = await vscode.workspace.findFiles(
    `**/${v.AiEvaluationDefinition.testSetName}.aiEvaluationTestset-meta.xml`
  );

  return Promise.all(
    aiTestSet.map(async f => parser.parse((await vscode.workspace.fs.readFile(f)).toString()) as AgentTestCase)
  );
};

export class AgentTestOutlineProvider implements vscode.TreeDataProvider<TestNode> {
  private onDidChangeTestData: vscode.EventEmitter<TestNode | undefined> = new vscode.EventEmitter<
    TestNode | undefined
  >();
  public onDidChangeTreeData = this.onDidChangeTestData.event;

  private agentTestMap: Map<string, TestNode> = new Map<string, TestNode>();
  private rootNode: TestNode | null;
  public testStrings: Set<string> = new Set<string>();
  private agentTestInfo: AgentTestCase[] | null;
  private testIndex: Map<string, string> = new Map<string, string>();

  constructor(agentTestInfo: AgentTestCase[] | null) {
    this.rootNode = null;
    this.agentTestInfo = agentTestInfo;
    this.createTestIndex();
    this.getAllAgentTests();
  }

  public getHead(): TestNode {
    if (this.rootNode === null) {
      return this.getAllAgentTests();
    } else {
      return this.rootNode;
    }
  }

  public getId(): string {
    return BASE_ID;
  }

  public getChildren(element?: TestNode): TestNode[] {
    if (element) {
      return element.children;
    } else {
      if (this.rootNode && this.rootNode.children.length > 0) {
        return this.rootNode.children;
      } else {
        let message = NO_TESTS_MESSAGE;
        let description = NO_TESTS_DESCRIPTION;
        // const languageClientStatus = languageClientUtils.getStatus();
        // if (!languageClientStatus.isReady()) {
        //   if (languageClientStatus.failedToInitialize()) {
        //     void vscode.window.showInformationMessage(languageClientStatus.getStatusMessage());
        //     return new Array<agentTestNode>();
        //   }
        //   message = LOADING_MESSAGE;
        //   description = '';
        // }
        const emptyArray = new Array<AgentTestNode>();
        const testToDisplay = new AgentTestNode(message, null);
        testToDisplay.description = description;
        emptyArray.push(testToDisplay);
        return emptyArray;
      }
    }
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      this.getAllAgentTests();
      let message = NO_TESTS_MESSAGE;
      let description = NO_TESTS_DESCRIPTION;
      // if (!languageClientUtils.getStatus().isReady()) {
      //   message = LOADING_MESSAGE;
      //   description = '';
      // }
      if (!(this.rootNode && this.rootNode.children.length > 0)) {
        this.rootNode = new AgentTestNode(message, null);
        const testToDisplay = new AgentTestNode(message, null);
        testToDisplay.description = description;
        this.rootNode.children.push(testToDisplay);
      }
      return this.rootNode;
    }
  }

  public async refresh(): Promise<void> {
    this.rootNode = null; // Reset tests
    this.agentTestMap.clear();
    this.testStrings.clear();
    this.agentTestInfo = await getAgentTests();
    this.createTestIndex();
    this.getAllAgentTests();
    this.onDidChangeTestData.fire(undefined);
  }

  public async collapseAll(): Promise<void> {
    return vscode.commands.executeCommand(`workbench.actions.treeView.${this.getId()}.collapseAll`);
  }

  public async onResultFileCreate(agentTestPath: string, testResultFile: string) {
    const testRunIdFile = path.join(agentTestPath, TEST_RUN_ID_FILE);
    const testRunId = readFileSync(testRunIdFile).toString();
    const testResultFilePath = path.join(
      agentTestPath,
      !testRunId ? TEST_RESULT_JSON_FILE : `test-result-${testRunId}.json`
    );

    if (testResultFile === testResultFilePath) {
      await this.refresh();
      this.updateTestResults(testResultFile);
    }
  }

  public getTestClassName(uri: vscode.Uri): string | undefined {
    return this.testIndex.get(uri.toString());
  }

  private createTestIndex(): void {
    this.testIndex.clear();
    if (this.agentTestInfo) {
      this.agentTestInfo.forEach(testMethod => {
        this.testIndex.set(testMethod.location.uri.toString(), testMethod.number.toString());
      });
    } else {
      //
    }
  }

  private getAllAgentTests(): TestNode {
    if (this.rootNode === null) {
      // Starting Out
      this.rootNode = new AgentTestGroupNode(AGENT_TESTS, null);
    }
    this.rootNode.children = new Array<TestNode>();
    if (this.agentTestInfo) {
      this.agentTestInfo.forEach(test => {
        let agentGroup = this.agentTestMap.get(test.number.toString()) as AgentTestGroupNode;
        if (!agentGroup) {
          const groupLocation = new vscode.Location(test.location.uri, AGENT_GROUP_RANGE);
          agentGroup = new AgentTestGroupNode(test.number, groupLocation);
          this.agentTestMap.set(test.number.toString(), agentGroup);
        }
        const agentTest = new AgentTestNode(test.number.toString(), test.location);

        agentTest.name = agentGroup.label + '.' + agentTest.label;
        this.agentTestMap.set(agentTest.name, agentTest);
        agentGroup.children.push(agentTest);
        if (this.rootNode && !(this.rootNode.children.indexOf(agentGroup) >= 0)) {
          this.rootNode.children.push(agentGroup);
        }
        this.testStrings.add(agentGroup.name);
      });
      // Sorting independently so we don't lose the order of the test methods per test class.
      this.rootNode.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.rootNode;
  }

  public updateTestResults(testResultFilePath: string) {
    const testResultOutput = readFileSync(testResultFilePath, 'utf8');
    const testResultContent = JSON.parse(testResultOutput) as AgentTestDetailsResponse;

    this.updateTestsFromLibrary(testResultContent);
    this.onDidChangeTestData.fire(undefined);
  }

  private updateTestsFromLibrary(testResult: AgentTestDetailsResponse) {
    const groups = new Set<AgentTestGroupNode>();
    for (const test of testResult.testSet.testCases) {
      // const { name, namespacePrefix } = test.agentClass;
      // const agentGroupName = namespacePrefix ? `${namespacePrefix}.${name}` : name;

      const agentGroupNode = this.agentTestMap.get(test.number) as AgentTestGroupNode;

      if (agentGroupNode) {
        groups.add(agentGroupNode);
      }

      const agentTestNode = this.agentTestMap.get(test.number) as AgentTestNode;
      if (agentTestNode) {
        agentTestNode.outcome = test.expectationResults.every(entry => entry.result === 'Passed') ? 'PASS' : 'FAIL';
        agentTestNode.updateOutcome();
        // test.status - I think that's the API status (in-progress, etc,) not the tests' status
        if (test.status.toString() === FAIL_RESULT) {
          agentTestNode.errorMessage = test.expectationResults.map(e => e.errorMessage).join() || '';
          agentTestNode.description = `${agentTestNode.stackTrace}\n${agentTestNode.errorMessage}`;
        }
      }
    }
    groups.forEach(group => {
      group.updatePassFailLabel();
    });
  }
}

export abstract class TestNode extends vscode.TreeItem {
  public children = new Array<TestNode>();
  public description: string;
  public name: string;
  public location: vscode.Location | null;

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, location: vscode.Location | null) {
    super(label, collapsibleState);
    this.location = location;
    this.description = label;
    this.name = label;
    this.command = {
      command: `${BASE_ID}.showError`,
      title: 'SHOW ERROR',
      arguments: [this]
    };
  }

  // public iconPath = {
  //   light: iconHelpers.getIconPath(IconsEnum.LIGHT_BLUE_BUTTON),
  //   dark: iconHelpers.getIconPath(IconsEnum.DARK_BLUE_BUTTON)
  // };

  // TODO: create a ticket to address this particular issue.

  // @ts-ignore
  get tooltip(): string {
    return this.description;
  }

  public updateOutcome(outcome: string) {
    // if (outcome === 'PASS') {
    //   // Passed Test
    //   this.iconPath = {
    //     light: iconHelpers.getIconPath(IconsEnum.LIGHT_GREEN_BUTTON),
    //     dark: iconHelpers.getIconPath(IconsEnum.DARK_GREEN_BUTTON)
    //   };
    // } else if (outcome === FAIL_RESULT) {
    //   // Failed test
    //   this.iconPath = {
    //     light: iconHelpers.getIconPath(IconsEnum.LIGHT_RED_BUTTON),
    //     dark: iconHelpers.getIconPath(IconsEnum.DARK_RED_BUTTON)
    //   };
    // } else if (outcome === SKIP_RESULT) {
    //   // Skipped test
    //   this.iconPath = {
    //     light: iconHelpers.getIconPath(IconsEnum.LIGHT_ORANGE_BUTTON),
    //     dark: iconHelpers.getIconPath(IconsEnum.DARK_ORANGE_BUTTON)
    //   };
    // }
    // const nodeType = this.contextValue.split('_')[0];
    // this.contextValue = `${nodeType}_${outcome}`;
  }

  public abstract contextValue: string;
}

export class AgentTestGroupNode extends TestNode {
  public passing: number = 0;
  public failing: number = 0;
  public skipping: number = 0;

  constructor(label: number | string, location: vscode.Location | null) {
    super(typeof label === 'string' ? label : label.toString(), vscode.TreeItemCollapsibleState.Expanded, location);
  }

  public contextValue = 'agentTestGroup';

  public updatePassFailLabel() {
    this.passing = 0;
    this.failing = 0;
    this.skipping = 0;
    this.children.forEach(child => {
      if (child instanceof AgentTestNode) {
        this.passing += child.outcome === PASS_RESULT ? 1 : 0;
        this.failing += child.outcome === FAIL_RESULT ? 1 : 0;
        this.skipping += child.outcome === SKIP_RESULT ? 1 : 0;
      }
    });

    if (this.passing + this.failing + this.skipping === this.children.length) {
      if (this.failing !== 0) {
        this.updateOutcome(FAIL_RESULT);
      } else {
        this.updateOutcome(PASS_RESULT);
      }
    }
  }

  public updateOutcome(outcome: string) {
    super.updateOutcome(outcome);
    if (outcome === PASS_RESULT) {
      this.children.forEach(child => {
        // Update all the children as well
        child.updateOutcome(outcome);
      });
    }
  }
}

export class AgentTestNode extends TestNode {
  public errorMessage: string = '';
  public stackTrace: string = '';
  public outcome = 'Not Run';

  constructor(label: string, location: vscode.Location | null) {
    super(label, vscode.TreeItemCollapsibleState.None, location);
  }

  public updateOutcome() {
    super.updateOutcome(this.outcome);
    if (this.outcome === PASS_RESULT) {
      this.errorMessage = '';
    }
  }

  public contextValue = 'agentTest';
}

let testOutlineProviderInst: AgentTestOutlineProvider;

export const getTestOutlineProvider = () => {
  if (!testOutlineProviderInst) {
    testOutlineProviderInst = new AgentTestOutlineProvider(null);
  }
  return testOutlineProviderInst;
};
