import React, { useState, useEffect, useMemo } from "react";
import QueryEditor from "../components/QueryEditor";
import ResultSection from "../components/ResultSection";
import "./DbQueryPage.css";

interface DbQueryPreviewPageProps {
  selectedConnectionId: number | null;
  selectedDatabase: string | null;
  previewData?: any;
  theme?: "light" | "dark";
}

function extractResultStats(result: any): { hasResponse: boolean; rowCount: number; isError: boolean } {
  if (!result) return { hasResponse: false, rowCount: 0, isError: false };
  if (result.error) return { hasResponse: true, rowCount: 0, isError: true };

  let data = null;
  if (Array.isArray(result)) {
    data = result;
  } else if (result && Array.isArray(result.data)) {
    if (
      result.data.length === 1 &&
      result.data[0] &&
      typeof result.data[0] === "object" &&
      Array.isArray(result.data[0].data)
    ) {
      data = result.data[0].data;
    } else {
      data = result.data;
    }
  }

  if (Array.isArray(data)) {
    const hasExecuted =
      data.length > 0 ||
      (result.columns && result.columns.length > 0) ||
      typeof result.executionTime === "number";
    return {
      hasResponse: hasExecuted,
      rowCount: data.length,
      isError: false,
    };
  }

  if (result.data || result.columns || typeof result.executionTime === "number") {
    return { hasResponse: true, rowCount: 1, isError: false };
  }

  return { hasResponse: false, rowCount: 0, isError: false };
}

const DbQueryPreviewPage: React.FC<DbQueryPreviewPageProps> = ({
  selectedConnectionId,
  selectedDatabase,
  previewData,
  theme,
}) => {
  const [query, setQuery] = useState("");
  const isExecuting = false;
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (previewData && typeof previewData === "object") {
      if (previewData.query !== undefined) setQuery(previewData.query);
      if (previewData.result !== undefined) setResult(previewData.result);
    }
  }, [previewData]);

  const { hasResponse, rowCount, isError } = useMemo(
    () => extractResultStats(result),
    [result]
  );

  const queryLines = useMemo(() => {
    return (query || "").split("\n").length;
  }, [query]);

  const layout = useMemo(() => {
    if (!hasResponse) {
      const idealHeight = 36 + queryLines * 20 + 24;
      const totalHeight = Math.min(800, Math.max(160, idealHeight));
      return {
        totalHeight,
        hasResponse: false,
        editorFlex: "1 1 100%",
        editorHeight: "100%",
        responseHeight: undefined,
      };
    }

    const neededQueryHeight = Math.max(120, Math.min(420, 36 + queryLines * 20 + 20));

    let neededResponseHeight: number;
    if (isError) {
      neededResponseHeight = 110;
    } else if (rowCount === 0) {
      neededResponseHeight = 110;
    } else {
      neededResponseHeight = 36 + 32 + Math.min(10, rowCount) * 28 + 38;
      neededResponseHeight = Math.max(130, Math.min(380, neededResponseHeight));
    }

    const totalIdeal = neededQueryHeight + neededResponseHeight;
    const totalHeight = Math.min(800, Math.max(220, totalIdeal));

    if (totalIdeal >= 800) {
      if (neededQueryHeight >= 380 && neededResponseHeight >= 380) {
        return {
          totalHeight: 800,
          hasResponse: true,
          editorFlex: "1 1 50%",
          editorHeight: undefined,
          responseHeight: undefined,
        };
      } else if (neededResponseHeight < 300) {
        return {
          totalHeight: 800,
          hasResponse: true,
          editorFlex: "1 1 auto",
          editorHeight: undefined,
          responseHeight: neededResponseHeight,
        };
      } else {
        return {
          totalHeight: 800,
          hasResponse: true,
          editorFlex: `0 0 ${neededQueryHeight}px`,
          editorHeight: `${neededQueryHeight}px`,
          responseHeight: undefined,
        };
      }
    }

    return {
      totalHeight,
      hasResponse: true,
      editorFlex: `0 0 ${neededQueryHeight}px`,
      editorHeight: `${neededQueryHeight}px`,
      responseHeight: undefined,
    };
  }, [hasResponse, queryLines, rowCount, isError]);

  useEffect(() => {
    (window as any).parent?.postMessage(
      { type: "RESIZE_PREVIEW", height: layout.totalHeight },
      "*"
    );
  }, [layout.totalHeight]);

  return (
    <div className="app">
      <div className="body" style={{ height: "100%" }}>
        <main className="db-main" style={{ width: "100%", height: "100%" }}>
          <div
            className="editor"
            style={{
              flex: layout.editorFlex,
              height: layout.editorHeight,
              minHeight: 0,
              minWidth: 0,
              borderBottom: layout.hasResponse ? "1px solid var(--border)" : "none",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 12px",
                background: "var(--bg-2)",
                borderBottom: "1px solid var(--border)",
                height: "36px",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  color: "var(--fg-2)",
                  letterSpacing: "0.05em",
                }}
              >
                SQL Query (Preview Only)
              </span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <QueryEditor
                value={query}
                onChange={setQuery}
                schemaTables={[]}
                selectedConnectionId={selectedConnectionId}
                selectedDatabase={selectedDatabase}
                readOnly={true}
                theme={theme}
              />
            </div>
          </div>

          {layout.hasResponse && (
            <div
              className="col"
              style={{
                flex: layout.responseHeight ? `0 0 ${layout.responseHeight}px` : 1,
                minHeight: 0,
              }}
            >
              <ResultSection result={result} isExecuting={isExecuting} theme={theme} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DbQueryPreviewPage;
