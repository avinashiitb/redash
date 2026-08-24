import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  Download,
  Check,
  Filter,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import "./ResultSection.css";
import { exportToCsv, exportToJson } from "../utils/exportUtils";

interface ResultSectionProps {
  result: any;
  isExecuting: boolean;
  theme?: "light" | "dark";
  fileName?: string;
}

const ResultSection: React.FC<ResultSectionProps> = ({
  result,
  isExecuting,
  theme,
  fileName,
}) => {
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [expandedJson, setExpandedJson] = useState<{
    title: string;
    data: any;
  } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filterText, setFilterText] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isDark = theme ? theme === "dark" : document.documentElement.getAttribute("data-theme") === "dark";

  // Reset pagination when result changes
  useEffect(() => {
    setCurrentPage(1);
  }, [result]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  let data: any[] = [];
  if (Array.isArray(result)) {
    data = result;
  } else if (result && typeof result === "object" && !result.error) {
    if (Array.isArray(result.data)) {
      data = result.data;
    } else if (result.data !== undefined && result.data !== null) {
      data = typeof result.data === "object" ? [result.data] : [{ value: result.data }];
    } else if (Array.isArray(result.rows)) {
      data = result.rows;
    } else if (Array.isArray(result.records)) {
      data = result.records;
    } else if (Object.keys(result).length > 0) {
      data = [result];
    }
  } else if (result !== undefined && result !== null && typeof result !== "object") {
    data = [{ value: result }];
  }

  let columns: any[] = result?.columns || [];
  if (columns.length === 0 && data.length > 0) {
    const firstRow = data[0];
    if (typeof firstRow === "object" && firstRow !== null) {
      columns = Object.keys(firstRow);
    } else {
      columns = ["value"];
    }
  }
  const executionTime = result?.executionTime || result?.duration || 0;

  const filteredData = React.useMemo(() => {
    if (!filterText.trim()) return data;
    const lower = filterText.toLowerCase();
    return data.filter((row: any) => {
      if (typeof row !== "object" || row === null) return String(row).toLowerCase().includes(lower);
      return Object.values(row).some((val) => String(val).toLowerCase().includes(lower));
    });
  }, [data, filterText]);

  const totalRows = filteredData.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const paginatedData = React.useMemo(() => {
    return filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredData, currentPage, pageSize]);

  if (!result && !isExecuting) {
    return (
      <div
        className="table-wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-3)",
          height: "100%",
        }}
      >
        <p>Run a query to see results here.</p>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="table-wrap" style={{ padding: 24, color: "var(--warn)", height: "100%" }}>
        <h4>Error executing query</h4>
        <p>{result.error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, flex: 1, width: "100%" }}>
      <div className="results-bar">
        <div className="seg">
          <button
            className={viewMode === "table" ? "on" : ""}
            onClick={() => setViewMode("table")}
          >
            <Table size={11} style={{ marginRight: 4 }} /> Table
          </button>
          <button
            className={viewMode === "json" ? "on" : ""}
            onClick={() => setViewMode("json")}
          >
            <span
              style={{ fontSize: 11, marginRight: 4, fontFamily: "monospace" }}
            >
              {"{}"}
            </span>{" "}
            JSON
          </button>
        </div>
        <span className="vdiv" style={{ margin: "0 6px" }} />

        {isExecuting ? (
          <span className="stat" style={{ color: "var(--accent-color)" }}>
            <span className="pulsing-dot" style={{ marginRight: 6 }} /> Running
            query...
          </span>
        ) : (
          <React.Fragment>
            <span className="stat">
              <b>{data.length}</b> rows
            </span>
            <span className="dim">·</span>
            <span className="stat">
              <b>{Math.round(executionTime)}</b> ms
            </span>
            <span className="dim">·</span>
            <span className="stat">
              <Check size={11} style={{ color: "var(--accent)" }} /> success
            </span>
          </React.Fragment>
        )}

        <div className="grow" />

        <div
          className="row gap-2"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "2px 8px",
            height: 24,
          }}
        >
          <Filter size={11} style={{ color: "var(--fg-3)" }} />
          <input
            placeholder="Filter rows…"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              color: "var(--fg)",
              fontSize: 11,
              width: 140,
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ position: "relative" }} ref={exportMenuRef}>
          <button
            className="btn btn-ghost"
            onClick={() => setIsExportOpen(!isExportOpen)}
            title="Export Options"
          >
            <Download size={11} style={{ marginRight: 4 }} /> Export
          </button>

          {isExportOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 6,
                width: 150,
                background: "var(--bg-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                boxShadow: "var(--shadow)",
                zIndex: 100,
                padding: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--fg)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  width: "100%",
                }}
                onClick={() => {
                  exportToCsv(data, columns, fileName || "query_results");
                  setIsExportOpen(false);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FileSpreadsheet size={12} style={{ opacity: 0.8 }} />
                <span>Export as CSV</span>
              </button>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--fg)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  width: "100%",
                }}
                onClick={() => {
                  exportToJson(data && data.length > 0 ? data : result, fileName || "query_results");
                  setIsExportOpen(false);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FileCode size={12} style={{ opacity: 0.8 }} />
                <span>Export as JSON</span>
              </button>
            </div>
          )}
        </div>

        <button className="btn btn-icon btn-ghost">
          <MoreHorizontal size={12} />
        </button>
      </div>

      {viewMode === "table" && data.length === 0 && (
        <div
          className="table-wrap"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--fg-3)",
            flex: 1,
          }}
        >
          <p>No rows returned</p>
        </div>
      )}

      {viewMode === "table" && data.length > 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="table-wrap" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <table className="dt">
              <thead>
                <tr>
                  <th className="row-num"></th>
                  {columns.map((c: any, i: number) => {
                    const key = typeof c === "object" ? (c.key || c.name || String(c)) : c;
                    const label = typeof c === "object" ? (c.label || c.name || c.key || String(c)) : c;
                    const type = typeof c === "object" ? c.type : "";
                    return (
                      <th key={key || i}>
                        {label}
                        {type && <span className="col-type">{type}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row: any, i: number) => (
                  <tr
                    key={i}
                    className="row-in"
                    style={{ animationDelay: `${i * 8}ms` }}
                  >
                    <td className="row-num">{(currentPage - 1) * pageSize + i + 1}</td>
                    {columns.map((c: any, j: number) => {
                      const key = typeof c === "object" ? (c.key || c.name || String(c)) : c;
                      const label = typeof c === "object" ? (c.label || c.name || c.key || String(c)) : c;
                      const val = (typeof row === "object" && row !== null) ? row[key] : (key === "value" ? row : undefined);
                      const isNum = typeof val === "number";
                      const isObj = val !== null && typeof val === "object";

                      let isJsonStr = false;
                      let parsedObj = val;

                      if (
                        typeof val === "string" &&
                        (val.trim().startsWith("{") || val.trim().startsWith("["))
                      ) {
                        try {
                          parsedObj = JSON.parse(val);
                          isJsonStr = true;
                        } catch (e) {}
                      }

                      const isComplex = isObj || isJsonStr;

                      let displayVal: string | React.ReactNode = "";
                      if (isNum) {
                        displayVal = val.toLocaleString("en-US", {
                          minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
                          maximumFractionDigits: 2,
                        });
                      } else if (isComplex) {
                        const strPreview = JSON.stringify(parsedObj);
                        displayVal = (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              cursor: "pointer",
                              color: "var(--accent)",
                              width: "100%",
                              overflow: "hidden",
                            }}
                            onClick={() =>
                              setExpandedJson({
                                title: String(label || key),
                                data: parsedObj,
                              })
                            }
                          >
                            <span
                              style={{
                                opacity: 0.7,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {strPreview}
                            </span>
                          </div>
                        );
                      } else {
                        displayVal = String(
                          val === null || val === undefined ? "" : val,
                        );
                      }

                      return (
                        <td
                          key={j}
                          className={isNum ? "num" : "str"}
                          style={{
                            maxWidth: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div className="pagination-info">
              Showing <b>{totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}</b> to{" "}
              <b>{Math.min(totalRows, currentPage * pageSize)}</b> of{" "}
              <b>{totalRows}</b> rows
            </div>

            <div className="pagination-controls">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>

              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First Page"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="pagination-pages">
                Page <b>{currentPage}</b> of <b>{totalPages || 1}</b>
              </span>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                title="Last Page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === "json" && (
        <div className="json-wrapper" style={{ flex: 1, height: "calc(100% - 42px)", minHeight: 0 }}>
          <Editor
            height="100%"
            defaultLanguage="json"
            theme={isDark ? "vs-dark" : "light"}
            value={JSON.stringify(result?.data !== undefined ? result.data : result, null, 2)}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "var(--font-mono, monospace)",
              lineNumbers: "off",
              folding: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      )}

      {expandedJson && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "80%",
              height: "80%",
              background: "var(--bg)",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{ fontFamily: "monospace", color: "var(--accent)" }}
                >
                  {"{ }"}
                </span>
                {expandedJson.title}
              </h3>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setExpandedJson(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, padding: 16 }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                theme={isDark ? "vs-dark" : "light"}
                value={JSON.stringify(expandedJson.data, null, 2)}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultSection;
