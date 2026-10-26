/**
 * Redash Document Validator & Transformer
 * Normalizes raw LLM content or input objects into standard DevScribe Redash document blocks.
 * Resilient against context window exhaustion, truncated JSON, corrupted escapes, and mixed block types.
 */

/**
 * Cleans query text by stripping markdown code block fences if present
 * @param {string} rawText 
 * @returns {string} Cleaned query string
 */
function cleanQueryText(rawText) {
  if (typeof rawText !== "string") return "";
  let text = rawText.trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }

  return text;
}

/**
 * Unescapes standard JSON string escape sequences into literal characters
 * @param {string} str 
 * @returns {string} Unescaped string
 */
function unescapeJsonString(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

/**
 * Resiliently extracts query or parses JSON candidate even when truncated or corrupted
 * @param {string} rawText 
 * @returns {{ parsed?: any, rawQuery?: string }}
 */
function extractResilientQuery(rawText) {
  if (typeof rawText !== "string") return { rawQuery: "" };
  let text = rawText.trim();

  // 1. Strip outer markdown code block fences
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }

  // 2. Fast path: Direct JSON.parse
  try {
    const parsed = JSON.parse(text);
    return { parsed };
  } catch (e) {}

  // 3. Extract bracket/brace boundaries
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      const parsed = JSON.parse(text.substring(firstBracket, lastBracket + 1));
      return { parsed };
    } catch (e) {}
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      return { parsed };
    } catch (e) {}
  }

  // 4. Sanitize invalid escape sequences
  try {
    const sanitized = text.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, () => "\\\\");
    const fb = sanitized.indexOf("[");
    const lb = sanitized.lastIndexOf("]");
    if (fb !== -1 && lb > fb) {
      const parsed = JSON.parse(sanitized.substring(fb, lb + 1));
      return { parsed };
    }
    const fbr = sanitized.indexOf("{");
    const lbr = sanitized.lastIndexOf("}");
    if (fbr !== -1 && lbr > fbr) {
      const parsed = JSON.parse(sanitized.substring(fbr, lbr + 1));
      return { parsed };
    }
  } catch (e) {}

  // 5. Context window exceeded or truncated JSON extraction
  const isJsonLike =
    (text.startsWith("[") || text.startsWith("{") || text.includes('"redash"')) &&
    /["\x27]query["\x27]\s*:/i.test(text);

  if (isJsonLike) {
    const boundedMatch = text.match(/["\x27]query["\x27]\s*:\s*"([\s\S]*?)(?:"\s*,\s*["\x27]|\s*"\s*\}|\s*"\s*\])/i);
    if (boundedMatch && boundedMatch[1]) {
      return { rawQuery: unescapeJsonString(boundedMatch[1]) };
    }

    const truncatedMatch = text.match(/["\x27]query["\x27]\s*:\s*"([\s\S]*)/i);
    if (truncatedMatch && truncatedMatch[1]) {
      let raw = truncatedMatch[1];
      raw = raw.replace(/(?:",\s*["\x27]\w+["\x27][\s\S]*|\s*\}[\s\S]*|\s*\][\s\S]*|"\s*)$/i, "");
      return { rawQuery: unescapeJsonString(raw) };
    }
  }

  return { rawQuery: cleanQueryText(text) };
}

/**
 * Recursively unwraps accidental nested JSON envelopes in query strings
 * @param {string} queryText 
 * @returns {string} Unwrapped clean query text
 */
function unwrapRecursiveEnvelope(queryText) {
  if (typeof queryText !== "string") return "";
  let text = cleanQueryText(queryText);

  if (
    (text.startsWith("[") || text.startsWith("{")) &&
    text.includes('"redash"') &&
    /["\x27]query["\x27]\s*:/i.test(text)
  ) {
    const res = extractResilientQuery(text);
    if (res.parsed) {
      const sub = validateAndTransform(res.parsed);
      return sub[0]?.data?.query || text;
    }
    if (res.rawQuery && res.rawQuery !== text) {
      return unwrapRecursiveEnvelope(res.rawQuery);
    }
  }

  return text;
}

/**
 * Validates raw input and transforms into standard redash document payload
 * @param {string|Array|Object} rawContent 
 * @returns {Array<Object>} Array containing standard redash block object
 */
function validateAndTransform(rawContent) {
  let query = "";
  let selectedDatabase = "";
  let selectedConnectionId = null;
  let result = null;

  if (typeof rawContent === "string") {
    const extracted = extractResilientQuery(rawContent);
    if (extracted.parsed) {
      return validateAndTransform(extracted.parsed);
    }
    query = unwrapRecursiveEnvelope(extracted.rawQuery || "");
  } else if (Array.isArray(rawContent) && rawContent.length > 0) {
    const redashBlock =
      rawContent.find(
        (b) =>
          b &&
          (b.type === "redash" ||
            (b.data && (b.data.query !== undefined || b.data.sql !== undefined || b.data.content !== undefined)))
      ) || rawContent[0];

    if (redashBlock) {
      const dataObj = redashBlock.data || redashBlock;
      const rawQuery = dataObj.query !== undefined
        ? dataObj.query
        : (dataObj.sql !== undefined ? dataObj.sql : (dataObj.content || ""));
      query = unwrapRecursiveEnvelope(rawQuery);
      selectedDatabase = dataObj.selectedDatabase || redashBlock.selectedDatabase || "";
      selectedConnectionId = dataObj.selectedConnectionId || redashBlock.selectedConnectionId || null;
      result =
        dataObj.result !== undefined
          ? dataObj.result
          : (dataObj.results || redashBlock.result || redashBlock.results || null);
    }
  } else if (rawContent && typeof rawContent === "object") {
    const dataObj = rawContent.data || rawContent;
    const rawQuery = dataObj.query !== undefined
      ? dataObj.query
      : (dataObj.sql !== undefined ? dataObj.sql : (dataObj.content || ""));
    query = unwrapRecursiveEnvelope(rawQuery);
    selectedDatabase = dataObj.selectedDatabase || rawContent.selectedDatabase || "";
    selectedConnectionId = dataObj.selectedConnectionId || rawContent.selectedConnectionId || null;
    result =
      dataObj.result !== undefined
        ? dataObj.result
        : (dataObj.results || rawContent.result || rawContent.results || null);
  }

  return [
    {
      type: "redash",
      data: {
        query: query ? query.trim() : "",
        result,
        selectedConnectionId,
        selectedDatabase,
      },
    },
  ];
}

module.exports = {
  validateAndTransform,
  cleanQueryText,
  unescapeJsonString,
  extractResilientQuery,
};
