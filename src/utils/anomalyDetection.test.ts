import { describe, it, expect } from "vitest";
import { detectOutliers, detectColumnOutliers } from "./anomalyDetection";

describe("detectOutliers", () => {
  it("flags no outliers in a clean, tightly-clustered dataset", () => {
    const values = [10, 11, 12, 13, 12, 11, 10, 12];
    const result = detectOutliers(values);
    expect(result).toEqual(values.map(() => false));
  });

  it("flags an obvious high outlier", () => {
    const values = [10, 11, 12, 13, 12, 11, 10, 500];
    const result = detectOutliers(values);
    expect(result[result.length - 1]).toBe(true);
    expect(result.slice(0, -1)).toEqual(
      values.slice(0, -1).map(() => false)
    );
  });

  it("flags an obvious low outlier", () => {
    const values = [50, 52, 51, 53, 49, 50, -900, 52];
    const result = detectOutliers(values);
    expect(result[6]).toBe(true);
  });

  it("flags multiple outliers on both ends", () => {
    const values = [-1000, 20, 21, 22, 23, 21, 20, 900];
    const result = detectOutliers(values);
    expect(result[0]).toBe(true);
    expect(result[result.length - 1]).toBe(true);
    expect(result.slice(1, -1)).toEqual([false, false, false, false, false,false]);
  });

  it("returns all false when fewer than 4 data points are given", () => {
    const values = [1, 1000, -1000];
    const result = detectOutliers(values);
    expect(result).toEqual([false, false, false]);
  });

  it("returns all false for an empty array", () => {
    expect(detectOutliers([])).toEqual([]);
  });

  it("returns all false when every value is identical (IQR = 0)", () => {
    const values = [7, 7, 7, 7, 7, 7];
    const result = detectOutliers(values);
    expect(result).toEqual(values.map(() => false));
  });

  it("ignores null/undefined/NaN entries without crashing, and never flags them", () => {
    const values: (number | null | undefined)[] = [
      10,
      11,
      null,
      12,
      undefined,
      13,
      NaN,
      500,
    ];
    const result = detectOutliers(values);
    expect(result[2]).toBe(false); // null
    expect(result[4]).toBe(false); // undefined
    expect(result[6]).toBe(false); // NaN
    expect(result[7]).toBe(true); // 500 is still correctly flagged
  });

  it("handles negative-number datasets correctly", () => {
    const values = [-10, -11, -12, -13, -12, -11, -10, -900];
    const result = detectOutliers(values);
    expect(result[result.length - 1]).toBe(true);
  });
});

describe("detectColumnOutliers", () => {
  it("flags outlier rows within a specific column of tabular data", () => {
    const rows = [
      [1, 100],
      [2, 102],
      [3, 101],
      [4, 99],
      [5, 9999], // outlier in column 1
    ];
    const result = detectColumnOutliers(rows, 1);
    expect(result).toEqual([false, false, false, false, true]);
  });

  it("treats non-numeric strings in the target column as non-outliers", () => {
    const rows = [
      [1, "abc"],
      [2, 50],
      [3, 51],
      [4, 49],
      [5, 52],
    ];
    const result = detectColumnOutliers(rows, 1);
    expect(result[0]).toBe(false);
  });
});
