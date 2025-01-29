import vscode from 'vscode';

export type AiEvaluationDefinition = {
  AiEvaluationDefinition: {
    description: string;
    name: string;
    subjectType: 'AGENT';
    subjectName: string;
    subjectVersion: string;
    testCase: AgentTestCase[];
    location: vscode.Location;
  };
};

export type AgentTestCase = {
  location: vscode.Location;
  number: string;
  inputs: { utterance: string };
  expectation: [
    { name: 'expectedTopic'; expectedValue: string },
    { name: 'expectedActions'; expectedValue: string },
    { name: 'expectedOutcome'; expectedValue: string }
  ];
};
