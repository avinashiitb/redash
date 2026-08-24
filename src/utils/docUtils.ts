export const isDbMatch = (dbInList: string, targetDb: string | null | undefined): boolean => {
  if (!targetDb || !dbInList) return false;
  if (dbInList === targetDb) return true;
  const parts = dbInList.split("||");
  return parts[0] === targetDb || parts[1] === targetDb;
};

export const extractSavedData = (doc: any): any => {
  if (!doc) return null;

  let blocks = doc.blocks;
  if (typeof blocks === "string") {
    try {
      blocks = JSON.parse(blocks);
    } catch (e) {}
  }

  let dataObj: any = null;

  if (Array.isArray(blocks) && blocks.length > 0) {
    const firstBlock = blocks[0];
    if (firstBlock && typeof firstBlock === "object") {
      if (firstBlock.data !== undefined) {
        dataObj = firstBlock.data;
      } else {
        dataObj = firstBlock;
      }
    }
  } else if (blocks && typeof blocks === "object") {
    if (blocks.data !== undefined) {
      dataObj = blocks.data;
    } else {
      dataObj = blocks;
    }
  } else if (doc.data) {
    dataObj = doc.data;
  }

  if (typeof dataObj === "string") {
    try {
      dataObj = JSON.parse(dataObj);
    } catch (e) {}
  }

  if (!dataObj || typeof dataObj !== "object") {
    return null;
  }

  // Normalize properties across legacy format variations
  const query = dataObj.query ?? dataObj.sql ?? dataObj.code ?? dataObj.queryText ?? undefined;
  const result = dataObj.result ?? dataObj.results ?? undefined;
  const selectedConnectionId = dataObj.selectedConnectionId ?? dataObj.connectionId ?? dataObj.configId ?? undefined;
  const selectedDatabase = dataObj.selectedDatabase ?? dataObj.database ?? dataObj.db ?? undefined;
  const executionTime = dataObj.executionTime ?? undefined;

  return {
    ...dataObj,
    query,
    result,
    results: Array.isArray(result) ? result : (dataObj.results || (result ? [result] : undefined)),
    selectedConnectionId: selectedConnectionId !== undefined && selectedConnectionId !== null && !isNaN(Number(selectedConnectionId)) ? Number(selectedConnectionId) : selectedConnectionId,
    selectedDatabase,
    executionTime,
  };
};
