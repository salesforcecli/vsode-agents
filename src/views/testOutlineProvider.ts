/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';
import * as vscode from 'vscode';
import * as xml from 'fast-xml-parser';

// Message
// const LOADING_MESSAGE = 'loading';
const NO_TESTS_MESSAGE = 'no tests found';
const NO_TESTS_DESCRIPTION = 'no test description';
const AGENT_TESTS = 'AgentTests';

const startPos = new vscode.Position(0, 0);
const endPos = new vscode.Position(0, 1);
export const AGENT_GROUP_RANGE = new vscode.Range(startPos, endPos);

const BASE_ID = 'sf.agent.test.view';

type AiEvaluationDefinition = {
  testSetName: string;
  name: string;
  subjectName: string;
  description: string;
  testCases: AgentTestCase[];
  location: vscode.Location;
};

type AgentTestCase = {
  location: vscode.Location;
  name: string;
  utterance: string;
  // expectations: [{ expectation: { name: string; expectedValue: string } }];
};

const parseAgentTestsFromProject = async (): Promise<AiEvaluationDefinition[]> => {
  const aiTestDefs = await vscode.workspace.findFiles('**/*.aiEvaluationDefinition-meta.xml');
  //from the aiTestDef files, parse the xml using fast-xml-parser, find the testSetName that it points to
  const aggregator: AiEvaluationDefinition[] = [];
  const parser = new xml.XMLParser();
  await Promise.all(
    aiTestDefs.map(async definition => {
      const testDefinition = parser.parse((await vscode.workspace.fs.readFile(definition)).toString()) as {
        AiEvaluationDefinition: AiEvaluationDefinition;
      };
      const collector: AiEvaluationDefinition = {
        testCases: [],
        testSetName: testDefinition.AiEvaluationDefinition.testSetName,
        name: testDefinition.AiEvaluationDefinition.name,
        subjectName: testDefinition.AiEvaluationDefinition.subjectName,
        description: testDefinition.AiEvaluationDefinition.description,
        location: new vscode.Location(definition, new vscode.Position(0, 0))
      };

      //force-app/main/default/aiEvaluationTestsets/mysecondtest.aiEvaluationTestSet-meta.xml
      // there's probably a better way to find this file than searching for it
      const aiTestSet = await vscode.workspace.findFiles(
        `**/${testDefinition.AiEvaluationDefinition.testSetName}.aiEvaluationTestSet-meta.xml`
      );

      const content = (await vscode.workspace.fs.readFile(aiTestSet[0])).toString().split(EOL);

      for (let i = 0; i <= content.length - 1; i++) {
        // read the aiTestDefs line by line, parsing for   <testCase> tags
        let number;
        let utterance;
        if (content[i].includes('<number>')) {
          number = parseInt(content[i].replace('<number>', '').replace('</number>', ''), 10);
        }
        if (content[i].includes('<utterance>')) {
          utterance = content[i].replace('<utterance>', '').replace('</utterance>', '');
        }
        if (content && number) {
          collector.testCases.push({
            name: `Test Case: ${number}`,
            utterance: utterance ?? 'unknown',
            location: new vscode.Location(aiTestSet[0], new vscode.Position(i, 0))
          });
        }
      }

      aggregator.push(collector);
    })
  );

  return aggregator;
};

export class AgentTestOutlineProvider implements vscode.TreeDataProvider<TestNode> {
  private onDidChangeTestData: vscode.EventEmitter<TestNode | undefined> = new vscode.EventEmitter<
    TestNode | undefined
  >();
  public onDidChangeTreeData = this.onDidChangeTestData.event;

  // matches test name 'geocodingservce' to test node (children)
  private agentTestMap: Map<string, TestNode> = new Map<string, TestNode>();
  private rootNode: TestNode | null;
  public testStrings: Set<string> = new Set<string>();
  private agentTestInfo: AiEvaluationDefinition[] | null;
  // matches filepath => parent ('geocodingservice.cls' => 'GeocodingService') example
  private testIndex: Map<string, string> = new Map<string, string>();

  constructor(agentTestInfo: AiEvaluationDefinition[] | null) {
    this.rootNode = null;
    this.agentTestInfo = agentTestInfo;
    this.createTestIndex();
    this.getAllAgentTests();
  }

  public getChildren(element?: TestNode): TestNode[] {
    if (element) {
      return element.children;
    } else {
      if (this.rootNode && this.rootNode.children.length > 0) {
        return this.rootNode.children;
      } else {
        const testToDisplay = new AgentTestNode(NO_TESTS_MESSAGE, null);
        testToDisplay.description = NO_TESTS_DESCRIPTION;
        return [testToDisplay];
      }
    }
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      this.getAllAgentTests();
      if (!(this.rootNode && this.rootNode.children.length > 0)) {
        this.rootNode = new AgentTestNode(NO_TESTS_MESSAGE, null);
        const testToDisplay = new AgentTestNode(NO_TESTS_MESSAGE, null);
        testToDisplay.description = NO_TESTS_DESCRIPTION;
        this.rootNode.children.push(testToDisplay);
      }
      return this.rootNode;
    }
  }

  public async refresh(): Promise<void> {
    this.rootNode = null; // Reset tests
    this.agentTestMap.clear();
    this.testStrings.clear();
    this.agentTestInfo = await parseAgentTestsFromProject();
    this.createTestIndex();
    this.getAllAgentTests();
    this.onDidChangeTestData.fire(undefined);
  }

  public async collapseAll(): Promise<void> {
    return vscode.commands.executeCommand(`workbench.actions.treeView.sf.agent.test.view.collapseAll`);
  }

  private createTestIndex(): void {
    this.testIndex.clear();
    if (this.agentTestInfo) {
      this.agentTestInfo.forEach(testMethod => {
        this.testIndex.set(testMethod.location.uri.toString(), testMethod.name);
      });
    }
  }

  private getAllAgentTests(): TestNode {
    if (this.rootNode === null) {
      // Starting Out
      this.rootNode = new AgentTestGroupNode(AGENT_TESTS, null);
    }
    this.rootNode.children = new Array<TestNode>();
    if (this.agentTestInfo) {
      this.agentTestInfo.forEach(definition => {
        let agentGroup = this.agentTestMap.get(definition.name) as AgentTestGroupNode;
        if (!agentGroup) {
          const groupLocation = new vscode.Location(definition.location.uri, AGENT_GROUP_RANGE);
          agentGroup = new AgentTestGroupNode(definition.name, groupLocation);
          this.agentTestMap.set(definition.name, agentGroup);
        }

        definition.testCases.forEach(test => {
          const agentTest = new AgentTestNode(test.name, test.location);

          agentTest.name = agentGroup.label + '.' + agentTest.label;
          this.agentTestMap.set(agentTest.name, agentTest);
          agentGroup.children.push(agentTest);
          if (this.rootNode && !(this.rootNode.children.indexOf(agentGroup) >= 0)) {
            this.rootNode.children.push(agentGroup);
          }
          this.testStrings.add(agentGroup.name);
        });
      });
      // Sorting independently so we don't lose the order of the test methods per test class.
      this.rootNode.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.rootNode;
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
}

export class AgentTestNode extends TestNode {
  public errorMessage: string = '';
  public stackTrace: string = '';
  public outcome = 'Not Run';

  constructor(label: string, location: vscode.Location | null) {
    super(label, vscode.TreeItemCollapsibleState.None, location);
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
