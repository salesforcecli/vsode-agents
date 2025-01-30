/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

// Note this is a subset of the ChannelService interface from the core extension
export interface ChannelService {
  getInstance(channelName: string): ChannelService;
  showCommandWithTimestamp(commandName: string): void;
  showChannelOutput(): void;
  appendLine(text: string): void;
  clear(): void;
}
