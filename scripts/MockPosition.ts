/**
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
export class MockPosition {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}

  public isBefore(other: MockPosition): boolean {
    if (this.line < other.line) {
      return true;
    }
    if (other.line < this.line) {
      return false;
    }
    return this.character < other.character;
  }

  public isBeforeOrEqual(other: MockPosition): boolean {
    if (this.line < other.line) {
      return true;
    }
    if (other.line < this.line) {
      return false;
    }
    return this.character <= other.character;
  }

  public isAfter(other: MockPosition): boolean {
    if (this.line > other.line) {
      return true;
    }
    if (other.line > this.line) {
      return false;
    }
    return this.character > other.character;
  }

  public isAfterOrEqual(other: MockPosition): boolean {
    if (this.line > other.line) {
      return true;
    }
    if (other.line > this.line) {
      return false;
    }
    return this.character >= other.character;
  }

  public isEqual(other: MockPosition): boolean {
    return this.line === other.line && this.character === other.character;
  }

  public compareTo(other: MockPosition): number {
    if (this.line < other.line) {
      return -1;
    }
    if (this.line > other.line) {
      return 1;
    }
    if (this.character < other.character) {
      return -1;
    }
    if (this.character > other.character) {
      return 1;
    }
    return 0;
  }

  public translate(delta: { lineDelta?: number; characterDelta?: number }): MockPosition {
    return new MockPosition(this.line + (delta.lineDelta || 0), this.character + (delta.characterDelta || 0));
  }

  public with(line?: number, character?: number): MockPosition {
    return new MockPosition(
      line !== undefined ? line : this.line,
      character !== undefined ? character : this.character
    );
  }
}
