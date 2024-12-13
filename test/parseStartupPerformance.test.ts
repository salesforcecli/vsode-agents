/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { parseStartupPerformanceFile } from '../src/helpers/parseStartupPerformance';

describe('parseStartupPerformance', () => {
  it('should parse a valid markdown file with the expected table structure', async () => {
    const fileContents = `
## Extension Activation Stats

| Extension                           | Eager | Load Code | Call Activate | Finish Activate | Event                                    | By                                  |
|-------------------------------------|-------|-----------|---------------|-----------------|------------------------------------------|-------------------------------------|
| salesforce.salesforcedx-vscode-core | true  | 123       | 456           | 789             | onStartupFinished                        | vscode                              |
| extension2                          | false | 234       | 567           | 890             | onCommand:extension.activate             | user                                |
`;

    const result = await parseStartupPerformanceFile(fileContents);
    expect(result).toEqual([
      {
        extension: 'salesforce.salesforcedx-vscode-core',
        eager: true,
        loadCode: 123,
        callActivate: 456,
        finishActivate: 789,
        event: 'onStartupFinished',
        by: 'vscode'
      }
    ]);
  });

  it('should handle an empty markdown file', async () => {
    const fileContents = ``;

    const result = await parseStartupPerformanceFile(fileContents);
    expect(result).toEqual([]);
  });

  it('should handle a markdown file without the "Extension Activation Stats" section', async () => {
    const fileContents = `
## Some Other Section

| Column1 | Column2 |
|---------|---------|
| value1  | value2  |
`;

    const result = await parseStartupPerformanceFile(fileContents);
    expect(result).toEqual([]);
  });
  
  it('should handle a markdown file with the "Extension Activation Stats" section but invalid table format', async () => {
    const fileContents = `
## Extension Activation Stats

| Column1 | Column2 |
|---------|---------|
| value1  | value2  |
`;

    const result = await parseStartupPerformanceFile(fileContents);
    expect(result).toEqual([]);
  });

  it('should handle a markdown file with an incomplete table', async () => {
    const fileContents = `
## Extension Activation Stats

| Extension                           | Eager | Load Code | Call Activate | Finish Activate | Event                                    | By                                  |
|-------------------------------------|-------|-----------|---------------|-----------------|------------------------------------------|-------------------------------------|
| salesforce.salesforcedx-vscode-core | true  | 123       |               | 789             | onStartupFinished                        | vscode                              |
| salesforce.salesforcedx-vscode-apex | false | 321       | 543           | 111             | onStartupFinished                        | vscode                              |
`;

    const result = await parseStartupPerformanceFile(fileContents);
    expect(result).toEqual([
      {
        extension: 'salesforce.salesforcedx-vscode-core',
        eager: true,
        loadCode: 123,
        callActivate: undefined, // Incomplete value should be undefined
        finishActivate: 789,
        event: 'onStartupFinished',
        by: 'vscode'
      },
      {
        extension: 'salesforce.salesforcedx-vscode-apex',
        eager: false,
        loadCode: 321,
        callActivate: 543,
        finishActivate: 111,
        event: 'onStartupFinished',
        by: 'vscode'
      }
    ]);
  });
});
