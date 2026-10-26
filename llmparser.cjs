/**
 * DevScribe Redash - LLM Parser
 * Converts stored redash document payload into clean, structured LLM-readable format
 * matching the DevScribe Redash specification.
 */

/**
 * Extracts query and metadata from various possible document payload structures.
 * @param {*} rawPayload
 * @returns {Object} { query, selectedDatabase, selectedConnectionId }
 */
function extractData(rawPayload) {
  if (!rawPayload) return { query: "", selectedDatabase: "", selectedConnectionId: null };

  let data = rawPayload;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { query: rawPayload, selectedDatabase: "", selectedConnectionId: null };
    }
  }

  // DevScribe wrapper array: [ { type: "redash", data: { ... } } ]
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]) {
      if (data[0].type === "redash" && data[0].data) {
        return extractData(data[0].data);
      }
      if (typeof data[0] === "object" && (data[0].query !== undefined || data[0].sql !== undefined || data[0].content !== undefined)) {
        return extractData(data[0]);
      }
    }
    return { query: "", selectedDatabase: "", selectedConnectionId: null };
  }

  if (data && typeof data === "object") {
    if (data.data && typeof data.data === "object") {
      return extractData(data.data);
    }

    const query = typeof data.query === "string"
      ? data.query
      : (typeof data.sql === "string" ? data.sql : (typeof data.content === "string" ? data.content : ""));
    const selectedDatabase = typeof data.selectedDatabase === "string" ? data.selectedDatabase : "";
    const selectedConnectionId = data.selectedConnectionId !== undefined ? data.selectedConnectionId : null;

    return {
      query,
      selectedDatabase,
      selectedConnectionId,
    };
  }

  return { query: "", selectedDatabase: "", selectedConnectionId: null };
}

/**
 * Primary export: Converts stored redash blocks into clean, structured LLM-readable JSON.
 * @param {string|Array|Object} documentPayload - Stored blocks from SQLite documents table
 * @returns {string} Formatted JSON matching Redash specification
 */
function toLlmText(documentPayload) {
  const { query, selectedDatabase, selectedConnectionId } = extractData(documentPayload);

  if (!query || !query.trim()) {
    if (typeof documentPayload === "string" && documentPayload.trim()) {
      return documentPayload.trim();
    }
    return "";
  }

  const outputBlock = [
    {
      "type": "redash",
      "data": {
        "query": query.trim(),
        "result": null,
        "selectedConnectionId": selectedConnectionId || null,
        "selectedDatabase": selectedDatabase || "",
      }
    }
  ];

  return JSON.stringify(outputBlock, null, 2);
}

module.exports = {
  toLlmText,
  extractData,
};
