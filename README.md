# Capture Startup Performance

## Overview

The Capture Startup Performance extension is a tool used by the IDE Experience Team to investigate and resolve slow startup performance of the Salesforce extensions. It contains one command - "SFDX: Capture Startup Performance" - that when run, does the following steps:

1. Open the "Developer: Startup Performance" file
2. Parse the file for each Salesforce extension and its Load Code, Call Activate, and Finish Activate values
3. Store the parsed results in a new file for the IDE Experience Team to review as needed
4. Send the parsed results to AppInsights

When customers report startup performance issues, they can easily install this extension and run the "SFDX: Capture Startup Performance" command, which will automatically capture their startup performance data and send it to AppInsights for the IDE Experience Team to query and analyze.

## How to Use

As a utility built for the IDE Experience Team's internal data collection, the Capture Startup Performance extension is not published and can only be installed via VSIX.

Here are instructions for installing the extension:

1. Download the latest version of the extension from https://github.com/forcedotcom/salesforcedx-vscode-capture-startup-performance/releases.
2. Unzip the zip file.
3. In VSCode, go to Extensions view, then click the "..." button in the top right corner of the sidebar and select "Install from VSIX...".
4. In the popup, navigate to the directory where the VSIX is extracted into, select it, and click "Install".

After installing the extension, go to your User settings in VSCode and search for the "Salesforcedx-vscode-core: Telemetry-tag" setting. Input a unique value so that the IDE Experience Team can easily find your data when querying AppInsights.

## Prerequisites

The Capture Startup Performance extension depends on the Salesforce Extension Pack.

Prior to using the Capture Startup Performance extension, install the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) and its prerequisites.
