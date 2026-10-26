import React, { useState, useEffect, useRef, useCallback } from "react";
import DBTopbar from "../components/DBTopbar";
import DocDbSidebar from "./DocDbSidebar";
import DocDbEditor from "./DocDbEditor";
import ResultSection from "../components/ResultSection";
import DocDbConnectionsView from "./DocDbConnectionsView";
import { ipc } from "../ipc";
import { exportToCsv, exportToJson } from "../utils/exportUtils";
import { extractSavedData } from "../utils/docUtils";
import "./DocDbPage.css";

interface DocDbPageProps {
  theme: string;
  onToggleTheme: () => void;
  fileId?: string;
  connections: any[];
  selectedConnectionId: number | null;
  setSelectedConnectionId: (id: number | null) => void;
  selectedDatabase: string | null;
  setSelectedDatabase: (db: string | null) => void;
  onRefreshConnections: () => void;
}

const DocDbPage: React.FC<DocDbPageProps> = ({
  theme,
  onToggleTheme,
  fileId,
  connections,
  selectedConnectionId,
  setSelectedConnectionId,
  selectedDatabase,
  setSelectedDatabase: _setSelectedDatabase,
  onRefreshConnections,
}) => {
  const [query, setQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [executionTime, setExecutionTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [view, setView] = useState("query");
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [contentDoc, setContentDoc] = useState<any>(null);
  const [fileName, setFileName] = useState("Untitled MongoDB Query");
  const [breadcrumbs, setBreadcrumbs] = useState<{ label: string; isFile?: boolean }[]>([]);

  const mainRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [editorHeight, setEditorHeight] = useState(50);

  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const isDraggingRight = useRef(false);
  const [activeDrag, setActiveDrag] = useState<'h' | 'v' | null>(null);

  // Resize handlers
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const newHeightPercent = ((e.clientY - rect.top) / rect.height) * 100;
    if (newHeightPercent > 15 && newHeightPercent < 85) {
      setEditorHeight(newHeightPercent);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "";
    setActiveDrag(null);
    window.dispatchEvent(new Event("resize"));
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setActiveDrag("h");
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, handleMouseUp]);

  const containerRightRef = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  const handleRightMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRight.current) return;
    const clientX = e.clientX;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(() => {
      const containerRight = containerRightRef.current || (containerRef.current?.getBoundingClientRect().right ?? window.innerWidth);
      const newWidth = containerRight - clientX;
      if (newWidth >= 160 && newWidth <= 600) setRightPanelWidth(newWidth);
    });
  }, []);

  const handleRightMouseUp = useCallback(() => {
    isDraggingRight.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    document.removeEventListener("mousemove", handleRightMouseMove);
    document.removeEventListener("mouseup", handleRightMouseUp);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "";
    setActiveDrag(null);
    window.dispatchEvent(new Event("resize"));
  }, [handleRightMouseMove]);

  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    if (containerRef.current) {
      containerRightRef.current = containerRef.current.getBoundingClientRect().right;
    }
    setActiveDrag("v");
    document.addEventListener("mousemove", handleRightMouseMove);
    document.addEventListener("mouseup", handleRightMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleRightMouseMove, handleRightMouseUp]);

  // Load and save state
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
          } else {
            const raw = await ipc.invoke("load-data");
            savedData = extractSavedData({ blocks: [{ data: raw }] });
          }
        } else {
          const raw = await ipc.invoke("load-data");
          savedData = extractSavedData({ blocks: [{ data: raw }] });
        }

        if (savedData && (savedData.query !== undefined || savedData.results !== undefined || savedData.result !== undefined)) {
          if (savedData.query !== undefined) setQuery(savedData.query);
          if (savedData.results !== undefined) {
            setResults(Array.isArray(savedData.results) ? savedData.results : [savedData.results]);
          } else if (savedData.result !== undefined) {
            setResults(Array.isArray(savedData.result) ? savedData.result : [savedData.result]);
          }
          if (savedData.executionTime !== undefined) setExecutionTime(savedData.executionTime);
        } else {
          const isElastic = selectedDatabase?.toLowerCase().includes("elastic") || selectedDatabase?.toLowerCase().includes("opensearch");
          if (isElastic) {
            setQuery('{\n  "size": 10,\n  "query": {\n    "match_all": {}\n  }\n}');
          } else {
            setQuery("// Query MongoDB using JavaScript syntax\ndb.orders.find({ status: 'fulfilled' }).limit(10);");
          }
        }
      } catch (e) {
        console.error("Failed to load state", e);
        const isElastic = selectedDatabase?.toLowerCase().includes("elastic") || selectedDatabase?.toLowerCase().includes("opensearch");
        if (isElastic) {
          setQuery('{\n  "size": 10,\n  "query": {\n    "match_all": {}\n  }\n}');
        } else {
          setQuery("// Query MongoDB using JavaScript syntax\ndb.orders.find({ status: 'fulfilled' }).limit(10);");
        }
      } finally {
        setIsLoaded(true);
      }
    };
    loadState();
  }, [fileId]);

  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(async () => {
      const payloadData = { query, results, executionTime, selectedConnectionId, selectedDatabase };
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
  }, [query, results, executionTime, selectedConnectionId, selectedDatabase, isLoaded, fileId, contentDoc]);

  // Fetch MongoDB collections/schema
  const loadCollections = async () => {
    if (!selectedConnectionId) return;
    try {
      const cols = await ipc.invoke("get-database-tables", {
        configId: selectedConnectionId,
        database: selectedDatabase,
      });
      setCollections(Array.isArray(cols) ? cols : []);
    } catch (e) {
      console.error("Failed to fetch MongoDB collections", e);
      setCollections([]);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [selectedConnectionId, selectedDatabase]);

  const lastDatabaseRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedDatabase) {
      const isElastic = selectedDatabase.toLowerCase().includes("elastic") || selectedDatabase.toLowerCase().includes("opensearch");
      setFileName(isElastic ? "Untitled Elasticsearch Query" : "Untitled MongoDB Query");
    }
  }, [selectedDatabase]);

  useEffect(() => {
    if (!isLoaded || !selectedDatabase) return;
    const prevDb = lastDatabaseRef.current;
    lastDatabaseRef.current = selectedDatabase;

    if (prevDb && prevDb !== selectedDatabase) {
      const prevWasElastic = prevDb.toLowerCase().includes("elastic") || prevDb.toLowerCase().includes("opensearch");
      const currentIsElastic = selectedDatabase.toLowerCase().includes("elastic") || selectedDatabase.toLowerCase().includes("opensearch");
      
      if (prevWasElastic !== currentIsElastic) {
        const mongoDefault = "// Query MongoDB using JavaScript syntax\ndb.orders.find({ status: 'fulfilled' }).limit(10);";
        const elasticDefault = '{\n  "size": 10,\n  "query": {\n    "match_all": {}\n  }\n}';
        
        if (!query || query.trim() === "" || query === mongoDefault || query === elasticDefault) {
          if (currentIsElastic) {
            setQuery(elasticDefault);
          } else {
            setQuery(mongoDefault);
          }
        }
      }
    }
  }, [selectedDatabase, isLoaded, query]);

  const handleSelectCollection = (colName: string) => {
    setSelectedCollection(colName);
    // Auto-populate initial simple query in editor
    setQuery(`db.${colName}.find({}).limit(10);`);
  };

  const handleRunQuery = async () => {
    if (!selectedConnectionId || isExecuting) return;
    setIsExecuting(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await ipc.invoke("execute-query", {
        configId: selectedConnectionId,
        query,
        database: selectedDatabase,
      });
      const end = performance.now();
      setExecutionTime(end - start);
      if (res && res.error) {
        setError(res.error);
        setResults([]);
      } else {
        setResults(Array.isArray(res) ? res : [res]);
      }
    } catch (err: any) {
      const end = performance.now();
      setExecutionTime(end - start);
      setError(err?.message || "Failed to execute query.");
      setResults([]);
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
    const payloadData = { query, results, executionTime, error, selectedConnectionId, selectedDatabase, route: "docdb" };
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
    const safeFileName = fileName ? fileName.replace(/\s+/g, '_').toLowerCase() : 'docdb_query';
    link.download = `${safeFileName}_export.ds`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    exportToCsv(results, [], fileName || "docdb_query");
  };

  const handleExportJson = () => {
    exportToJson(results, fileName || "docdb_query");
  };

  const isElastic = selectedDatabase?.toLowerCase().includes("elastic") || selectedDatabase?.toLowerCase().includes("opensearch");
  const editorLanguage = isElastic ? "json" : "javascript";

  return (
    <div className="docdb-container">
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

      <div className="docdb-main-layout" ref={containerRef}>
        {view === "connections" ? (
          <main className="db-main" style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
            <DocDbConnectionsView
              connections={connections}
              selectedConnectionId={selectedConnectionId}
              selectedDatabase={selectedDatabase}
              onSelectConnection={setSelectedConnectionId}
              onConnectionsChange={onRefreshConnections}
              onSelectCollection={handleSelectCollection}
              onSwitchToQuery={() => setView("query")}
            />
          </main>
        ) : (
          <React.Fragment>
            <main className="db-main" ref={mainRef}>
              <div
                className="editor"
                style={{
                  height: `${editorHeight}%`,
                  minHeight: "100px",
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--bg-1)",
                }}
              >
                <DocDbEditor value={query} onChange={setQuery} collections={collections} language={editorLanguage} onExecute={handleRunQuery} />
              </div>

              {/* Horizontal divider row resize */}
              <div 
                className="splitter-h" 
                onMouseDown={handleMouseDown}
              >
                <div className="splitter-h-line" />
                <div className="splitter-handle-h" title="Resize panel">
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

              <div className="col" style={{ flex: 1, minHeight: 0, height: 'calc(100% - ' + editorHeight + '%)', display: 'flex', flexDirection: 'column' }}>
                <ResultSection
                  result={results.length > 0 || error ? { data: results, error, executionTime } : null}
                  isExecuting={isExecuting}
                  fileName={fileName}
                  theme={theme as 'light' | 'dark'}
                />
              </div>
            </main>

            {/* Vertical divider panel resize */}
            <React.Fragment>
              <div
                className="splitter-v"
                onMouseDown={handleRightMouseDown}
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

              <div style={{ width: rightPanelWidth, flex: `0 0 ${rightPanelWidth}px` }}>
                <DocDbSidebar
                  collections={collections}
                  onSelectCollection={handleSelectCollection}
                  selectedCollection={selectedCollection}
                  connection={connections.find((c) => c.id === selectedConnectionId)}
                  database={selectedDatabase}
                  onSelectDatabase={_setSelectedDatabase}
                  onRefresh={loadCollections}
                />
              </div>
            </React.Fragment>
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

export default DocDbPage;
