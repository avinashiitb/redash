import React, { useState, useEffect, useMemo } from "react";
import DocDbEditor from "./DocDbEditor";
import ResultSection from "../components/ResultSection";
import "./DocDbPage.css";

interface DocDbPreviewPageProps {
  selectedConnectionId: number | null;
  selectedDatabase: string | null;
  previewData?: any;
  theme?: "light" | "dark";
}

const DocDbPreviewPage: React.FC<DocDbPreviewPageProps> = ({
  previewData,
  theme,
}) => {
  const [query, setQuery] = useState("");
  const isExecuting = false;
  const [results, setResults] = useState<any[]>([]);
  const [executionTime, setExecutionTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const hasResponse = useMemo(() => {
    return (Array.isArray(results) && results.length > 0) || Boolean(error);
  }, [results, error]);

  const resultProp = useMemo(() => {
    return hasResponse ? { data: results, error, executionTime } : null;
  }, [hasResponse, results, error, executionTime]);

  useEffect(() => {
    if (previewData && typeof previewData === 'object') {
      if (previewData.query !== undefined) setQuery(previewData.query);
      if (previewData.results !== undefined) setResults(previewData.results);
      if (previewData.executionTime !== undefined) setExecutionTime(previewData.executionTime);
      if (previewData.error !== undefined) setError(previewData.error);
    }
  }, [previewData]);

  const queryLines = useMemo(() => {
    return (query || "").split("\n").length;
  }, [query]);

  const rowCount = Array.isArray(results) ? results.length : 0;
  const isError = Boolean(error);

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
    <div className="docdb-container">
      <div className="docdb-main-layout" style={{ height: "100%", flexDirection: "column" }}>
        <div
          className="docdb-editor-wrapper"
          style={{
            flex: layout.editorFlex,
            height: layout.editorHeight,
            minHeight: 0,
            borderBottom: layout.hasResponse ? "1px solid var(--border)" : "none",
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
              Document Query (Preview Only)
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <DocDbEditor
              value={query}
              onChange={setQuery}
              readOnly={true}
            />
          </div>
        </div>

        {layout.hasResponse && (
          <div
            style={{
              flex: layout.responseHeight ? `0 0 ${layout.responseHeight}px` : 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ResultSection
              result={resultProp}
              isExecuting={isExecuting}
              theme={theme}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DocDbPreviewPage;
