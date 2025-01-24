/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';
import * as vscode from 'vscode';
import * as xml from 'fast-xml-parser';
import { Commands } from '../enums/commands';
import {AgentTestGroupNode, AgentTestNode, AiEvaluationDefinition, TestNode} from "../types";

const NO_TESTS_MESSAGE = 'no tests found';
const NO_TESTS_DESCRIPTION = 'no test description';
const AGENT_TESTS = 'AgentTests';

export const AGENT_GROUP_RANGE = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));

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
        if (content[i].includes('<number>')) {
          collector.testCases.push({
            number: content[i].replace('<number>', '').replace('</number>', '').trim(),
            location: new vscode.Location(aiTestSet[0], new vscode.Position(i, 5))
          });
        }
      }

      aggregator.push(collector);
    })
  );

  return aggregator;
};

export class AgentTestOutlineProvider implements vscode.TreeDataProvider<TestNode> {
  // communicates to VSC that the data has changed and needs to be rerendered - these are vitally important
  private onDidChangeTestData: vscode.EventEmitter<TestNode | undefined> = new vscode.EventEmitter<
    TestNode | undefined
  >();
  public onDidChangeTreeData = this.onDidChangeTestData.event;

  // matches test name 'geocodingservce' to test node (children)
  // TODO: clean up agentTestMap/agentTestInfo relationships/types
  private agentTestMap: Map<string, TestNode> = new Map<string, TestNode>();
  private rootNode: TestNode | null;
  private agentTestInfo: AiEvaluationDefinition[] = [];

  constructor(agentTestInfo: AiEvaluationDefinition[] = []) {
    this.rootNode = null;
    this.agentTestInfo = agentTestInfo;
    this.getAllAgentTests();
  }

  public getChild(key: string): TestNode | undefined {
    return this.agentTestMap.get(key);
  }

  public refreshView(): void {
    this.onDidChangeTestData.fire(undefined);
  }

  public getChildren(element?: TestNode): TestNode[] {
    if (element) {
      return element.children;
    } else {
      if (this.rootNode && this.rootNode.children.length > 0) {
        return this.rootNode.children;
      } else {
        const testToDisplay = new AgentTestNode(NO_TESTS_MESSAGE);
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
        this.rootNode = new AgentTestNode(NO_TESTS_MESSAGE);
        const testToDisplay = new AgentTestNode(NO_TESTS_MESSAGE);
        testToDisplay.description = NO_TESTS_DESCRIPTION;
        this.rootNode.children.push(testToDisplay);
      }
      return this.rootNode;
    }
  }

  public async refresh(): Promise<void> {
    this.rootNode = null; // Reset tests
    this.agentTestMap.clear();
    this.agentTestInfo = await parseAgentTestsFromProject();
    this.getAllAgentTests();
    this.refreshView();
  }

  public async collapseAll(): Promise<void> {
    return vscode.commands.executeCommand(`workbench.actions.treeView.${Commands.collapseAll}`);
  }

  private getAllAgentTests(): TestNode {
    if (this.rootNode === null) {
      // Starting Out
      this.rootNode = new AgentTestGroupNode(AGENT_TESTS);
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
          const agentTest = new AgentTestNode(`Test Case: ${test.number}`, test.location);

          this.agentTestMap.set(agentTest.name, agentTest);
          agentGroup.children.push(agentTest);
          if (this.rootNode && !(this.rootNode.children.indexOf(agentGroup) >= 0)) {
            this.rootNode.children.push(agentGroup);
          }
        });
      });
      // Sorting independently so we don't lose the order of the test methods per test class.
      this.rootNode.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.rootNode;
  }
}

let testOutlineProviderInst: AgentTestOutlineProvider;

export const getTestOutlineProvider = () => {
  if (!testOutlineProviderInst) {
    testOutlineProviderInst = new AgentTestOutlineProvider();
  }
  return testOutlineProviderInst;
};
