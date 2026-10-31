import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import DBTopbar from "../components/DBTopbar";
import QueryEditor from "../components/QueryEditor";
import ResultSection from "../components/ResultSection";
import SchemaSidebar from "../components/SchemaSidebar";
import ConnectionManagement from "../components/ConnectionManagement";
import { ipc } from "../ipc";
import { exportToCsv, exportToJson } from "../utils/exportUtils";
import { extractSavedData } from "../utils/docUtils";
import "./DbQueryPage.css";

function extractResultStats(result: any): { hasResponse: boolean; rowCount: number; isError: boolean; data: any } {
  if (!result) return { hasResponse: false, rowCount: 0, isError: false, data: null };
  if (result.error) return { hasResponse: true, rowCount: 0, isError: true, data: null };

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
  } else if (result?.data) {
    data = result.data;
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
      data,
    };
  }

  if (result.data || result.columns || typeof result.executionTime === "number") {
    return { hasResponse: true, rowCount: 1, isError: false, data: result.data || result };
  }

  return { hasResponse: false, rowCount: 0, isError: false, data: null };
}

interface DbQueryPageProps {
  theme: string;
  onToggleTheme: () => void;
  fileId?: string;
  initialData?: any;
  onDataChange?: (data: any) => void;
  layout?: string;
  onToggleLayout?: () => void;
  connections: any[];
  selectedConnectionId: number | null;
  setSelectedConnectionId: (id: number | null) => void;
  selectedDatabase: string | null;
  setSelectedDatabase: (db: string | null) => void;
  onRefreshConnections: () => void;
}

const DbQueryPage: React.FC<DbQueryPageProps> = ({
  theme,
  onToggleTheme,
  fileId,
  connections,
  selectedConnectionId,
  setSelectedConnectionId,
  selectedDatabase,
  setSelectedDatabase,
  onRefreshConnections,
}) => {


  const [query, setQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [view, setView] = useState("query");
  const [isLoaded, setIsLoaded] = useState(false);
  const [contentDoc, setContentDoc] = useState<any>(null);
  const [fileName, setFileName] = useState("Untitled Query");
  const [breadcrumbs, setBreadcrumbs] = useState<{ label: string; isFile?: boolean }[]>([]);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  const mainRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  // Dynamic response height & manual drag
  const [customResponseHeight, setCustomResponseHeight] = useState<number | null>(null);
  const [responseViewMode, setResponseViewMode] = useState<"table" | "json">("table");
  const [mainHeight, setMainHeight] = useState<number>(() => {
    return typeof window !== "undefined" ? Math.max(400, window.innerHeight - 100) : 600;
  });

  useEffect(() => {
    const updateHeight = () => {
      if (mainRef.current) {
        const h = mainRef.current.clientHeight;
        if (h > 0) setMainHeight(h);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    if (mainRef.current) {
      ro.observe(mainRef.current);
    }
    window.addEventListener("resize", updateHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [view]);

  const hasResponse = useMemo(() => {
    if (isExecuting) return true;
    return extractResultStats(result).hasResponse;
  }, [result, isExecuting]);

  // Whenever a new query result arrives, reset manual resize so it auto-fits the new content
  useEffect(() => {
    setCustomResponseHeight(null);
  }, [result]);

  const handleResponseViewModeChange = useCallback((mode: "table" | "json") => {
    setResponseViewMode(mode);
    setCustomResponseHeight(null);
  }, []);

  const autoResponseHeight = useMemo(() => {
    if (!hasResponse) return 0;

    // Requirement: at least 30% min height when there is a response
    const minAllowedHeight = Math.max(140, Math.round(mainHeight * 0.30));
    // Maximum allowed height: leaves at least 100px for the query editor
    const maxAllowedHeight = Math.max(minAllowedHeight, Math.round(mainHeight * 0.78));

    if (isExecuting) return minAllowedHeight;

    const stats = extractResultStats(result);
    if (stats.isError || stats.rowCount === 0) {
      return minAllowedHeight;
    }

    let neededContentHeight = minAllowedHeight;

    if (responseViewMode === "json") {
      // Calculate content height for JSON
      let jsonLines = 10;
      try {
        const rawData = stats.data !== null && stats.data !== undefined ? stats.data : result;
        const sample = Array.isArray(rawData) ? rawData.slice(0, 100) : rawData;
        const jsonStr = JSON.stringify(sample, null, 2);
        if (jsonStr) {
          jsonLines = jsonStr.split("\n").length;
        }
      } catch (e) {
        jsonLines = Math.max(10, stats.rowCount * 4);
      }

      // Toolbar is ~36px, monaco editor lines (~19px per line), padding/margins ~24px
      const baseJsonHeight = 36 + (jsonLines * 19) + 24;
      // Add 30% extra height
      neededContentHeight = baseJsonHeight * 1.30;
    } else {
      // Calculate content height for Table view
      // Toolbar: 36px
      // <thead> header: 32px
      // Table rows: ~34px per row (up to 15 visible rows)
      // Pagination bar (if > 10 rows): ~44px
      // Horizontal scrollbar & padding safety buffer: ~24px
      const visibleRows = Math.min(stats.rowCount, 15);
      const rowsHeight = visibleRows * 34;
      const paginationHeight = stats.rowCount > 10 ? 44 : 0;
      const baseTableHeight = 36 + 32 + rowsHeight + paginationHeight + 24;
      // Add 30% extra height
      neededContentHeight = baseTableHeight * 1.30;
    }

    // Dynamic height: at least 30% min, expanding up to maxAllowedHeight
    return Math.min(maxAllowedHeight, Math.max(minAllowedHeight, Math.round(neededContentHeight)));
  }, [hasResponse, isExecuting, result, mainHeight, responseViewMode]);

  const activeResponseHeight = customResponseHeight !== null ? customResponseHeight : autoResponseHeight;

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
    return () => clearTimeout(timer);
  }, [hasResponse, activeResponseHeight]);

  // Right panel horizontal resize & toggle
  const [showSidebar, setShowSidebar] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const lastPanelWidth = useRef(280);
  const isDraggingRight = useRef(false);
  const [activeDrag, setActiveDrag] = useState<'h' | 'v' | null>(null);

  const toggleSidebar = useCallback(() => {
    setShowSidebar((prev) => {
      const next = !prev;
      if (next) {
        setRightPanelWidth(lastPanelWidth.current || 280);
      } else {
        if (rightPanelWidth > 0) {
          lastPanelWidth.current = rightPanelWidth;
        }
        setRightPanelWidth(0);
      }
      return next;
    });
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }, [rightPanelWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const newHeight = rect.bottom - e.clientY;
    const minHeight = Math.max(60, Math.round(rect.height * 0.15));
    const maxHeight = Math.max(minHeight, rect.height - 100);
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      setCustomResponseHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
    setActiveDrag(null);
    window.dispatchEvent(new Event("resize"));
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setActiveDrag('h');
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [handleMouseMove, handleMouseUp]);

  const containerRightRef = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  // Right panel horizontal resize handlers
  const handleRightMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRight.current) return;
    const clientX = e.clientX;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(() => {
      const containerRight = containerRightRef.current || (containerRef.current?.getBoundingClientRect().right ?? window.innerWidth);
      const newWidth = containerRight - clientX;
      if (newWidth < 60) {
        setShowSidebar(false);
        setRightPanelWidth(0);
      } else {
        setShowSidebar(true);
        const clampedWidth = Math.min(600, Math.max(160, newWidth));
        setRightPanelWidth(clampedWidth);
        lastPanelWidth.current = clampedWidth;
      }
    });
  }, []);

  const handleRightMouseUp = useCallback(() => {
    isDraggingRight.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    document.removeEventListener('mousemove', handleRightMouseMove);
    document.removeEventListener('mouseup', handleRightMouseUp);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
    setActiveDrag(null);
    window.dispatchEvent(new Event("resize"));
  }, [handleRightMouseMove]);

  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    if (containerRef.current) {
      containerRightRef.current = containerRef.current.getBoundingClientRect().right;
    }
    setActiveDrag('v');
    document.addEventListener('mousemove', handleRightMouseMove);
    document.addEventListener('mouseup', handleRightMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [handleRightMouseMove, handleRightMouseUp]);

  useEffect(() => {
    const loadState = async () => {
      try {
        let savedData: any = null;
        const api = (window as any).pluginAPI;
        if (api) {
          if (fileId && api.getFileDetailsById) {
            const fileInfo = await api.getFileDetailsById(fileId);
            if (fileInfo && fileInfo.title) {
              setFileName(fileInfo.title);
            }
            // Fetch breadcrumb path
            if (api.getNestedPath) {
              api.getNestedPath({ fileId }).then((result: any) => {
                if (result) {
                  setBreadcrumbs([
                    ...result.folders.map((f: any) => ({ label: f.name, isFile: false })),
                    ...(result.file ? [{ label: result.file.title, isFile: true }] : []),
                  ]);
                }
              }).catch(() => {});
            }
          }
          if (fileId && api.getDocumentsByParentFile) {
            const data = await api.getDocumentsByParentFile(fileId);
            if (data && data.length > 0) {
              const document = data[0];
              setContentDoc(document);
              savedData = extractSavedData(document);
            }
          } else if (!api.getDocumentsByParentFile) {
            const raw = await ipc.invoke("load-data");
            savedData = extractSavedData({ blocks: [{ data: raw }] });
          }
        } else {
          const raw = await ipc.invoke("load-data");
          savedData = extractSavedData({ blocks: [{ data: raw }] });
        }

        if (savedData && (savedData.query !== undefined || savedData.result !== undefined)) {
          if (savedData.query !== undefined) setQuery(savedData.query);
          if (savedData.result !== undefined) setResult(savedData.result);
        } else {
          setQuery(
            "-- Write your SQL query here\nSELECT * FROM table_name LIMIT 10;",
          );
          setResult(null);
        }
      } catch (e) {
        console.error("Error loading plugin state:", e);
        setQuery(
          "-- Write your SQL query here\nSELECT * FROM table_name LIMIT 10;",
        );
      } finally {
        setIsLoaded(true);
      }
    };
    loadState();
  }, []);


  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(async () => {
      const payloadData = { query, result, selectedConnectionId, selectedDatabase };
      const api = (window as any).pluginAPI;
      if (api && api.updateDocument && fileId) {
        const blockType = contentDoc?.blocks?.[0]?.type || "redash";
        const updatedContents = {
          version: "1.0.0",
          time: Date.now(),
          blocks: [{ type: blockType, data: payloadData }],
          parent_file: fileId,
          _id: contentDoc?._id,
        };
        try {
          await api.updateDocument(fileId, [updatedContents]);
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          await ipc.invoke("save-data", payloadData);
        } catch (e) {
          console.error(e);
        }
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [query, result, selectedConnectionId, selectedDatabase, isLoaded, fileId, contentDoc]);

  const handleRunQuery = async () => {
    if (!selectedConnectionId) {
      alert("Please select a connection first");
      return;
    }
    setIsExecuting(true);
    try {
      const res = await ipc.invoke("execute-query", {
        configId: selectedConnectionId,
        query,
        database: selectedDatabase,
      });
      setResult(res);
      // Bump key so SchemaSidebar reloads its DB list (e.g. after CREATE DATABASE)
      if (!res?.error) setSidebarRefreshKey(k => k + 1);
    } catch (e: any) {
      setResult({ error: e.message || "Error executing query" });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunQueryRef = useRef(handleRunQuery);
  useEffect(() => {
    handleRunQueryRef.current = handleRunQuery;
  }, [handleRunQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunQueryRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleExport = () => {
    const payloadData = { query, result, selectedConnectionId, selectedDatabase, route: "sql" };
    const payload = {
      ...contentDoc,
      _id: contentDoc?._id || "",
      version: contentDoc?.version || "1.0.0",
      time: Date.now(),
      parent_file: fileId || contentDoc?.parent_file || "",
      blocks: [{ type: "redash", data: payloadData }],
      createdAt: contentDoc?.createdAt || Date.now(),
      updatedAt: Date.now(),
      fileType: contentDoc?.fileType || "redash"
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeFileName = fileName ? fileName.replace(/\s+/g, '_').toLowerCase() : 'sql_query';
    link.download = `${safeFileName}_export.ds`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    let rows: any[] = [];
    let cols: any[] = [];
    if (Array.isArray(result)) {
      rows = result;
    } else if (result?.data) {
      rows = result.data;
      cols = result.columns || [];
    }
    exportToCsv(rows, cols, fileName || "sql_query");
  };

  const handleFormat = () => {
    if (!query) return;
    try {
      const keywords = [
        "SELECT", "FROM", "WHERE", "AND", "OR", "GROUP BY", "ORDER BY",
        "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT JOIN", "RIGHT JOIN",
        "INNER JOIN", "FULL JOIN", "CROSS JOIN", "ON", "VALUES",
        "INSERT INTO", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE",
        "ALTER TABLE", "DROP TABLE", "UNION ALL", "UNION", "AS", "IN",
        "IS NULL", "IS NOT NULL", "BETWEEN", "LIKE", "DISTINCT"
      ];
      let formatted = query;
      keywords.forEach((kw) => {
        const regex = new RegExp(`\\b${kw}\\b`, "gi");
        formatted = formatted.replace(regex, kw);
      });
      if (!formatted.includes("\n") && formatted.length > 50) {
        const majorClauses = [
          "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT",
          "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "JOIN"
        ];
        majorClauses.forEach((mc) => {
          formatted = formatted.replace(new RegExp(`\\s+${mc}\\b`, "g"), `\n${mc}`);
        });
      }
      setQuery(formatted);
    } catch (e) {
      console.error("Format query failed:", e);
    }
  };

  const handleExportJson = () => {
    exportToJson(result?.data || result || [], fileName || "sql_query");
  };

  return (
    <div className="app">
      <DBTopbar
        connections={connections}
        selectedConnectionId={selectedConnectionId}
        onSelectConnection={setSelectedConnectionId}
        theme={theme}
        onToggleTheme={onToggleTheme}
        view={view}
        setView={setView}
        isExecuting={isExecuting}
        onExecute={handleRunQuery}
        onFormat={handleFormat}
        fileName={fileName}
        breadcrumbs={breadcrumbs}
        onExport={handleExport}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
      />

      <div className="body" ref={containerRef} style={{ position: "relative" }}>
        {view === "connections" ? (
          <main className="db-main">
            <div
              style={{
                flex: "1 1 0%",
                display: "flex",
                minWidth: 0,
                minHeight: 0,
              }}
            >
              <ConnectionManagement
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                selectedDatabase={selectedDatabase}
                onSelectDatabase={setSelectedDatabase}
                onSelectConnection={setSelectedConnectionId}
                onConnectionsChange={onRefreshConnections}
              />
            </div>
          </main>
        ) : (
          <React.Fragment>
            <main className="db-main" ref={mainRef} style={{ width: '100%', height: '100%' }}>
              <div
                className="editor"
                style={{
                  flex: "1 1 0%",
                  minHeight: 100,
                  borderBottom: hasResponse ? "1px solid var(--border)" : "none",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ flex: 1, minHeight: 0 }}>
                  <QueryEditor
                    value={query}
                    onChange={setQuery}
                    schemaTables={[]}
                    selectedConnectionId={selectedConnectionId}
                    selectedDatabase={selectedDatabase}
                    theme={theme as "light" | "dark"}
                    onExecute={handleRunQuery}
                  />
                </div>
              </div>

              {hasResponse && (
                <React.Fragment>
                  <div 
                    className="splitter-h" 
                    onMouseDown={handleMouseDown}
                    onDoubleClick={() => setCustomResponseHeight(null)}
                    title="Drag to resize, double-click to auto-fit content"
                  >
                    <div className="splitter-h-line" />
                    <div className="splitter-handle-h" title="Drag to resize, double-click to auto-fit content">
                      <svg width="18" height="6" viewBox="0 0 18 6" fill="none">
                        <circle cx="3" cy="1.5" r="1" fill="currentColor" />
                        <circle cx="9" cy="1.5" r="1" fill="currentColor" />
                        <circle cx="15" cy="1.5" r="1" fill="currentColor" />
                        <circle cx="3" cy="4.5" r="1" fill="currentColor" />
                        <circle cx="9" cy="4.5" r="1" fill="currentColor" />
                        <circle cx="15" cy="4.5" r="1" fill="currentColor" />
                      </svg>
                    </div>
                  </div>

                  <div
                    className="col"
                    style={{
                      flex: `0 0 ${activeResponseHeight}px`,
                      height: activeResponseHeight,
                      minHeight: 0,
                      maxHeight: '80%',
                      overflow: 'hidden',
                    }}
                  >
                    <ResultSection
                      result={result}
                      isExecuting={isExecuting}
                      fileName={fileName}
                      theme={theme as 'light' | 'dark'}
                      onClose={() => setResult(null)}
                      viewMode={responseViewMode}
                      onViewModeChange={handleResponseViewModeChange}
                    />
                  </div>
                </React.Fragment>
              )}
            </main>

            {showSidebar && rightPanelWidth > 0 && (
              <React.Fragment>
                <div
                  className="splitter-v"
                  onMouseDown={handleRightMouseDown}
                  onDoubleClick={toggleSidebar}
                  title="Drag to resize, double-click to collapse"
                >
                  <div className="splitter-v-line" />
                  <div className="splitter-handle-v" title="Resize sidebar">
                    <svg width="6" height="18" viewBox="0 0 6 18" fill="none">
                      <circle cx="1.5" cy="3" r="1" fill="currentColor" />
                      <circle cx="4.5" cy="3" r="1" fill="currentColor" />
                      <circle cx="1.5" cy="9" r="1" fill="currentColor" />
                      <circle cx="4.5" cy="9" r="1" fill="currentColor" />
                      <circle cx="1.5" cy="15" r="1" fill="currentColor" />
                      <circle cx="4.5" cy="15" r="1" fill="currentColor" />
                    </svg>
                  </div>
                </div>

                <aside
                  className="right-panel"
                  style={{ width: rightPanelWidth, flex: `0 0 ${rightPanelWidth}px` }}
                >
                  <SchemaSidebar
                    key={sidebarRefreshKey}
                    connections={connections}
                    selectedConnectionId={selectedConnectionId}
                    onSelectConnection={setSelectedConnectionId}
                    selectedDatabase={selectedDatabase}
                    onSelectDatabase={setSelectedDatabase}
                    onToggleSidebar={toggleSidebar}
                  />
                </aside>
              </React.Fragment>
            )}

            {(!showSidebar || rightPanelWidth === 0) && (
              <button
                onClick={toggleSidebar}
                title="Show Database Sidebar"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 10,
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRight: "none",
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                  padding: "8px 3px",
                  cursor: "pointer",
                  color: "var(--fg-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-3)")}
              >
                <ChevronLeft size={13} />
              </button>
            )}
          </React.Fragment>
        )}
      </div>

      {activeDrag && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            cursor: activeDrag === 'h' ? 'row-resize' : 'col-resize',
            userSelect: 'none',
          }}
        />
      )}
    </div>
  );
};

export default DbQueryPage;
