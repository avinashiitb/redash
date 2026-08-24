import React, { useState, useRef, useEffect } from "react";
import {
  Database,
  Bolt,
  Sparkles,
  Play,
  ChevronDown,
  Check,
  Folder,
  Sun,
  Moon,
  Settings,
  Download,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import "./DBTopbar.css";

interface DBTopbarProps {
  connections: any[];
  selectedConnectionId: number | null;
  onSelectConnection: (id: number | null) => void;
  theme?: string;
  onToggleTheme?: () => void;
  view?: string;
  setView?: (v: string) => void;
  isExecuting?: boolean;
  onExecute?: () => void;
  fileName?: string;
  breadcrumbs?: { label: string; isFile?: boolean }[];
  onExport?: () => void;
  onExportCsv?: () => void;
  onExportJson?: () => void;
}

const DBTopbar: React.FC<DBTopbarProps> = ({
  connections,
  selectedConnectionId,
  onSelectConnection,
  theme = "light",
  onToggleTheme,
  view = "query",
  setView,
  isExecuting = false,
  onExecute,
  fileName = "Untitled",
  breadcrumbs = [],
  onExport,
  onExportCsv,
  onExportJson,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const safeConnections = Array.isArray(connections) ? connections : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedConnection = safeConnections.find(
    (c) => c.id === selectedConnectionId,
  );

  let hostName = "localhost";
  if (selectedConnection) {
    if (selectedConnection.host) {
      hostName = selectedConnection.host;
    } else if (selectedConnection.connection_string) {
      try {
        const match = selectedConnection.connection_string.match(/@([^:/]+)/);
        if (match && match[1]) {
          hostName = match[1];
        }
      } catch (e) {}
    }
  }

  return (
    <header className="header">
      <div className="row gap-1 dim" style={{ fontSize: 11 }}>
        {breadcrumbs.length > 0 ? (
          breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
              <span
                className="row gap-1"
                style={{ color: b.isFile ? "var(--fg)" : "var(--fg-2)" }}
              >
                {b.isFile ? (
                  <span className="dot" style={{ background: "var(--accent)" }} />
                ) : (
                  <Folder size={11} />
                )}
                {b.label}
              </span>
            </React.Fragment>
          ))
        ) : (
          <React.Fragment>
            <Folder size={11} />
            <span>queries</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span className="dot" style={{ background: "var(--accent)" }} />
            <span style={{ color: "var(--fg)" }}>{fileName}</span>
          </React.Fragment>
        )}
      </div>

      {setView && (
        <React.Fragment>
          <span className="vdiv" style={{ margin: "0 8px" }} />
          <div className="seg">
            <button
              className={view === "query" ? "on" : ""}
              onClick={() => setView("query")}
            >
              <Bolt size={11} /> Query
            </button>
            <button
              className={view === "connections" ? "on" : ""}
              onClick={() => setView("connections")}
            >
              <Database size={11} /> Connections
            </button>
          </div>
        </React.Fragment>
      )}

      <div className="grow" />

      {selectedConnection && (
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            className="chip row gap-1"
            style={{
              padding: "0 8px",
              height: 26,
              cursor: "pointer",
              background: isDropdownOpen ? "var(--bg-3)" : "var(--bg-2)",
            }}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className="dot"></span>
            <span
              className="badge"
              style={{
                fontSize: 10,
                color: "var(--warn)",
                background: "rgba(245, 158, 11, 0.1)",
                padding: "1px 6px",
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              My
            </span>
            <b style={{ color: "var(--fg)", fontWeight: 600 }}>
              {selectedConnection.name}
            </b>
            <span className="dim">·</span>
            <span className="dim mono" style={{ fontSize: 10 }}>
              {hostName}
            </span>
            <ChevronDown
              size={12}
              style={{ marginLeft: 4, color: "var(--fg-3)" }}
            />
          </button>

          {isDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 6,
                width: 240,
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
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Switch Connection
              </div>
              {safeConnections.map((c) => {
                let cHost = "localhost";
                if (c.host) cHost = c.host;
                else if (c.connection_string) {
                  try {
                    const match = c.connection_string.match(/@([^:/]+)/);
                    if (match && match[1]) cHost = match[1];
                  } catch (e) {}
                }
                return (
                  <button
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: 4,
                      background:
                        c.id === selectedConnection.id
                          ? "var(--accent-soft)"
                          : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "var(--fg)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                    }}
                    onClick={() => {
                      onSelectConnection(c.id);
                      setIsDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (c.id !== selectedConnection.id)
                        e.currentTarget.style.background = "var(--bg-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (c.id !== selectedConnection.id)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 11,
                          color:
                            c.id === selectedConnection.id
                              ? "var(--accent)"
                              : "var(--fg)",
                        }}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--fg-3)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {cHost}
                      </span>
                    </div>
                    {c.id === selectedConnection.id && (
                      <Check size={12} style={{ color: "var(--accent)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "query" && (
        <React.Fragment>
          <button className="btn btn-ghost" style={{ marginLeft: 8 }}>
            <Sparkles size={11} /> Format
          </button>
          <button
            className="btn btn-primary"
            style={{ marginLeft: 8 }}
            onClick={onExecute}
            disabled={isExecuting}
          >
            <Play size={11} fill={isExecuting ? "none" : "currentColor"} />
            {isExecuting ? "Running..." : "Run"}
            <span
              className="kbd"
              style={{
                background: "rgba(0,0,0,0.15)",
                borderColor: "transparent",
                color: "#fff",
                marginLeft: 4,
              }}
            >
              ⌘↵
            </span>
          </button>
        </React.Fragment>
      )}

      <span className="vdiv" style={{ margin: "0 8px" }}></span>

      {(onExport || onExportCsv || onExportJson) && (
        <div style={{ position: "relative" }} ref={exportMenuRef}>
          <button className="btn btn-icon btn-ghost" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} title="Export Options">
            <Download size={12} />
          </button>

          {isExportMenuOpen && (
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
              {onExportCsv && (
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
                    width: "100%"
                  }}
                  onClick={() => {
                    onExportCsv();
                    setIsExportMenuOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <FileSpreadsheet size={11} style={{ opacity: 0.8 }} />
                  <span>Export as CSV</span>
                </button>
              )}
              {onExportJson && (
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
                    width: "100%"
                  }}
                  onClick={() => {
                    onExportJson();
                    setIsExportMenuOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <FileCode size={11} style={{ opacity: 0.8 }} />
                  <span>Export as JSON</span>
                </button>
              )}
              {onExport && (
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
                    width: "100%"
                  }}
                  onClick={() => {
                    onExport();
                    setIsExportMenuOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Download size={11} style={{ opacity: 0.8 }} />
                  <span>Export as .ds</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <button className="btn btn-icon btn-ghost" onClick={onToggleTheme}>
        {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
      </button>

      <button className="btn btn-icon btn-ghost">
        <Settings size={12} />
      </button>
    </header>
  );
};

export default DBTopbar;
