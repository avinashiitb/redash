import React, { useState, useEffect, useRef, useCallback } from "react";
import DBTopbar from "../components/DBTopbar";
import QueryEditor from "../components/QueryEditor";
import ResultSection from "../components/ResultSection";
import SchemaSidebar from "../components/SchemaSidebar";
import ConnectionManagement from "../components/ConnectionManagement";
import { ipc } from "../ipc";
import { exportToCsv, exportToJson } from "../utils/exportUtils";
import { extractSavedData } from "../utils/docUtils";
import "./DbQueryPage.css";

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
  const isDragging = useRef(false);
  const [editorHeight, setEditorHeight] = useState(44);

  // Right panel horizontal resize
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const isDraggingRight = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const newHeightPercent = ((e.clientY - rect.top) / rect.height) * 100;
    if (newHeightPercent > 10 && newHeightPercent < 90) {
      setEditorHeight(newHeightPercent);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = 'row-resize';
  }, [handleMouseMove, handleMouseUp]);

  // Right panel horizontal resize handlers
  const handleRightMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRight.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 180 && newWidth <= 520) setRightPanelWidth(newWidth);
  }, []);

  const handleRightMouseUp = useCallback(() => {
    isDraggingRight.current = false;
    document.removeEventListener('mousemove', handleRightMouseMove);
    document.removeEventListener('mouseup', handleRightMouseUp);
    document.body.style.cursor = 'default';
  }, [handleRightMouseMove]);

  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.addEventListener('mousemove', handleRightMouseMove);
    document.addEventListener('mouseup', handleRightMouseUp);
    document.body.style.cursor = 'col-resize';
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
        fileName={fileName}
        breadcrumbs={breadcrumbs}
        onExport={handleExport}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
      />

      <div className="body">
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
            <main className="db-main" ref={mainRef}>
              <div
                className="editor"
                style={{
                  flex: `0 0 ${editorHeight}%`,
                  minHeight: 0,
                  minWidth: 0,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <QueryEditor value={query} onChange={setQuery} schemaTables={[]} selectedConnectionId={selectedConnectionId} selectedDatabase={selectedDatabase} onExecute={handleRunQuery} />
              </div>

              <div 
                className="splitter-h" 
                onMouseDown={handleMouseDown}
                style={{ cursor: 'row-resize', height: '4px', zIndex: 10, position: 'relative' }}
              ></div>

              <div className="col" style={{ flex: 1, minHeight: 0, height: 'calc(100% - ' + editorHeight + '%)', display: 'flex', flexDirection: 'column' }}>
                <ResultSection result={result} isExecuting={isExecuting} fileName={fileName} theme={theme as 'light' | 'dark'} />
              </div>
            </main>

            <div
              style={{
                width: 4,
                cursor: 'col-resize',
                background: 'transparent',
                flexShrink: 0,
                position: 'relative',
                zIndex: 10,
              }}
              onMouseDown={handleRightMouseDown}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            />

            <aside
              className="right-panel"
              style={{ width: rightPanelWidth, flex: `0 0 ${rightPanelWidth}px` }}
            >
              <SchemaSidebar
                key={sidebarRefreshKey}
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                selectedDatabase={selectedDatabase}
                onSelectDatabase={setSelectedDatabase}
              />
            </aside>
          </React.Fragment>
        )}
      </div>
    </div>
  );
};

export default DbQueryPage;
