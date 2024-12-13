/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type ExtensionActivationStats = {
  extension: string;
  eager: boolean;
  loadCode?: number;
  callActivate?: number;
  finishActivate?: number;
  event: string;
  by: string;
};

export type ElementAttributes = {
  text: string;
  tokens: [
    {
      type: string;
      raw: string;
      text: string;
    }
  ];
  header: boolean;
  align: string | null;
};
