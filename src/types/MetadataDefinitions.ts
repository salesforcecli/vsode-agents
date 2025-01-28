import vscode from 'vscode';

export type AiEvaluationDefinition = {
  AiEvaluationDefinition: {
    testSetName: string;
    name: string;
    subjectName: string;
    description: string;
    testCases: AgentTestCase[];
    location: vscode.Location;
  };
};

export type AgentTestCase = {
  location: vscode.Location;
  number: string;
};
