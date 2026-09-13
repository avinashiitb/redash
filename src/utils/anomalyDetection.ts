/**
 * Detects outliers in a numeric array using the IQR (Interquartile Range) method.
 *
 * A value is flagged as an outlier if it falls outside:
 *   [Q1 - 1.5 * IQR, Q3 + 1.5 * IQR]
 *
 * where Q1 is the 25th percentile, Q3 is the 75th percentile,
 * and IQR = Q3 - Q1.
 *
 * @param values - array of numbers (order does not matter, NaN/null entries are ignored)
 * @returns array of the same length as `values`, where each element is
 *          true if the corresponding value is an outlier, false otherwise.
 *          Non-numeric entries are always marked false (not flagged).
 */
export function detectOutliers(values: (number | null | undefined)[]): boolean[] {
  // Not enough data to compute meaningful quartiles.
  if (values.length < 4) {
    return values.map(() => false);
  }

  // Keep only valid numbers for the quartile calculation.
  const numeric = values.filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v)
  );

  if (numeric.length < 4) {
    return values.map(() => false);
  }

  const sorted = [...numeric].sort((a, b) => a - b);

  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;

  // All values identical (or IQR is 0) — nothing meaningfully deviates.
  if (iqr === 0) {
    return values.map(() => false);
  }

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return values.map((v) => {
    if (typeof v !== "number" || Number.isNaN(v)) {
      return false;
    }
    return v < lowerBound || v > upperBound;
  });
}

/**
 * Computes the given percentile of an already-sorted numeric array,
 * using linear interpolation between closest ranks.
 *
 * @param sortedValues - array of numbers, sorted ascending
 * @param p - percentile to compute (0-100)
 */
function percentile(sortedValues: number[], p: number): number {
  const index = (p / 100) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;
  return (
    sortedValues[lowerIndex] * (1 - weight) +
    sortedValues[upperIndex] * weight
  );
}

/**
 * Convenience helper for tabular query results: given a 2D array of rows
 * (each row an array of cell values) and a column index, returns which
 * rows have an outlier value in that column.
 *
 * @param rows - array of rows, each row an array of cell values
 * @param columnIndex - index of the numeric column to check
 */
export function detectColumnOutliers(
  rows: (number | string | null | undefined)[][],
  columnIndex: number
): boolean[] {
  const columnValues = rows.map((row) => {
    const cell = row[columnIndex];
    return typeof cell === "number" ? cell : Number(cell);
  });

  return detectOutliers(
    columnValues.map((v) => (Number.isNaN(v) ? null : v))
  );
}
