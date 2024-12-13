/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This function is used to compare startup performance data and determine if it is stable.
 * The caller provides a callback that is used to fetch the current value of a string (perf data) and
 * compares it to the last value.  If the values are the same, the perf data is considered stable.
 *
 * @param fetchContent
 * @param stableData
 * @param timeout
 * @param interval
 * @param fetchContent
 * @returns
 */
export const waitForPerfDataToStabilize = async (
  timeout: number,
  interval: number,
  fetchContent: () => string
): Promise<boolean> => {
  let lastContent = fetchContent();
  let stableCount = 0;
  const stableCountMax = 5;

  const checkStability = async (): Promise<void> => {
    const currentContent = fetchContent();
    if (currentContent === lastContent) {
      stableCount++;
    } else {
      lastContent = currentContent;
      stableCount = 0;
    }
  };

  const start = Date.now();
  while (Date.now() - start < timeout) {
    await checkStability();
    if (stableCount++ >= stableCountMax) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
};
