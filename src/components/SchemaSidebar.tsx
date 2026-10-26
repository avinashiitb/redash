import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Table2,
  Key,
  Columns,
  Zap,
  Copy,
  Check,
  PanelRightClose,
} from "lucide-react";
import { ipc } from "../ipc";
import { isDbMatch } from "../utils/docUtils";

// Reusable inline copy button shown on row hover
const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // navigator.clipboard doesn't work inside Electron webviews.
    // Use the execCommand fallback which works in all contexts.
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.focus();
    el.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
    document.body.removeChild(el);
  };
  return (
    <button
      onClick={handleCopy}
      title={`Copy "${text}"`}
      className="copy-btn"
      style={{
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        background: "none",
        border: "none",
        cursor: "pointer",
        borderRadius: 3,
        color: copied ? "var(--accent)" : "var(--fg-3)",
        padding: 0,
        flexShrink: 0,
        transition: "color 0.15s",
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
};

interface SchemaSidebarProps {
  connections: any[];
  selectedConnectionId: number | null;
  onSelectConnection?: (id: number | null) => void;
  selectedDatabase?: string | null;
  onSelectDatabase?: (db: string | null) => void;
  onToggleSidebar?: () => void;
}

const SchemaSidebar: React.FC<SchemaSidebarProps> = ({
  connections,
  selectedConnectionId,
  onSelectConnection,
  selectedDatabase,
  onSelectDatabase,
  onToggleSidebar,
}) => {
  const [isConnDropdownOpen, setIsConnDropdownOpen] = useState(false);
  const connDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        connDropdownRef.current &&
        !connDropdownRef.current.contains(event.target as Node)
      ) {
        setIsConnDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [expandedTables, setExpandedTables] = useState<boolean>(true);
  const [expandedViews, setExpandedViews] = useState<boolean>(false);
  const [expandedProcs, setExpandedProcs] = useState<boolean>(false);
  const [openTable, setOpenTable] = useState<string | null>("customers");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [dbsExpanded, setDbsExpanded] = useState<boolean>(true);

  const [databases, setDatabases] = useState<string[]>([]);
  const [dbSearch, setDbSearch] = useState("");
  const [loadingDatabases, setLoadingDatabases] = useState(false);

  const safeConnections = Array.isArray(connections) ? connections : [];
  const selectedConnection = safeConnections.find(
    (c) => c.id === selectedConnectionId,
  );

  useEffect(() => {
    if (selectedConnectionId) {
      loadDatabases();
    } else {
      setDatabases([]);
      if (onSelectDatabase) onSelectDatabase(null);
      setTables([]);
    }
    setDbSearch("");
    setTableSearch("");
  }, [selectedConnectionId]);

  const loadDatabases = async () => {
    setLoadingDatabases(true);
    try {
      const dbs = await ipc.invoke('get-databases', {
        configId: selectedConnectionId,
      });
      if (Array.isArray(dbs) && dbs.length > 0) {
        setDatabases(dbs);
        // Priority: 1) already-selected DB (from saved state), 2) pinned DB in connection, 3) first in list
        const pinned = selectedConnection?.database;
        const alreadyValid = selectedDatabase && dbs.some(d => isDbMatch(d, selectedDatabase));
        const defaultDb = alreadyValid
          ? selectedDatabase
          : (pinned && dbs.some(d => isDbMatch(d, pinned))
              ? dbs.find(d => isDbMatch(d, pinned))
              : dbs[0]);
        if (onSelectDatabase) onSelectDatabase(defaultDb || null);
        // Force load the schema for the selected default DB
        loadSchema(defaultDb || null);
      } else {
        setDatabases([]);
        if (onSelectDatabase) onSelectDatabase(null);
        loadSchema(null);
      }
    } catch (e) {
      console.error(e);
      setDatabases([]);
      if (onSelectDatabase) onSelectDatabase(null);
      loadSchema(null);
    } finally {
      setLoadingDatabases(false);
    }
  };

  useEffect(() => {
    if (selectedDatabase !== null || databases.length === 0) {
      if (selectedConnectionId) {
        loadSchema(selectedDatabase);
      }
    }
    setTableSearch("");
  }, [selectedDatabase]);

  const loadSchema = async (dbName: string | null = selectedDatabase || null) => {
    setLoading(true);
    try {
      const result = await ipc.invoke("get-database-tables", {
        configId: selectedConnectionId,
        database: dbName,
      });
      if (result && result.error) {
        console.error("Backend error:", result.error);
        setTables([]);
      } else {
        setTables(Array.isArray(result) ? result : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const allTables = tables.filter((t) => t.type === 'table' || !t.type);
  const dbViews = tables.filter((t) => t.type === 'view');
  const dbProcs = tables.filter((t) => t.type === 'procedure' || t.type === 'function');

  const filteredTables = allTables.filter((table) => {
    const q = tableSearch.toLowerCase();
    if (!q) return true;
    if (table.name.toLowerCase().includes(q)) return true;
    if (
      table.columns &&
      Array.isArray(table.columns) &&
      table.columns.some((col: any) => col.name.toLowerCase().includes(q))
    ) {
      return true;
    }
    return false;
  });

  return (
    <aside
      className="sidebar right"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}
    >
      {selectedConnection ? (
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, position: "relative", minWidth: 0 }} ref={connDropdownRef}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: isConnDropdownOpen ? "var(--bg-3)" : "var(--bg-2)",
                  cursor: safeConnections.length > 0 ? "pointer" : "default",
                  userSelect: "none",
                  transition: "all 0.15s ease",
                }}
                onClick={() => {
                  if (safeConnections.length > 0) {
                    setIsConnDropdownOpen((v) => !v);
                  }
                }}
                title={safeConnections.length > 0 ? "Click to switch connection" : "Connection details"}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {selectedConnection?.type ? selectedConnection.type.slice(0, 2).toUpperCase() : "DB"}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--fg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedConnection ? selectedConnection.name : "Select connection"}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        boxShadow: "0 0 5px #10b981",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <div
                    className="muted mono"
                    style={{
                      fontSize: 9.5,
                      color: "var(--fg-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedConnection
                      ? `${selectedConnection.type || selectedConnection.kind || "mysql"}${selectedConnection.host ? ` · ${selectedConnection.host.split("@").pop()}` : ""}`
                      : "No active connection"}
                  </div>
                </div>
                <ChevronDown
                  size={12}
                  style={{
                    color: "var(--fg-3)",
                    flexShrink: 0,
                    transform: isConnDropdownOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s ease",
                  }}
                />
              </div>

              {/* Dropdown Menu */}
              {isConnDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: "var(--bg-1)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    boxShadow: "var(--shadow, 0 8px 24px rgba(0,0,0,0.25))",
                    zIndex: 1000,
                    padding: 4,
                    maxHeight: 220,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {safeConnections.map((c) => {
                    const isSelected = c.id === selectedConnection?.id;
                    const cHost = c.host ? c.host.split("@").pop() : "localhost";
                    return (
                      <button
                        key={c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectConnection) onSelectConnection(c.id);
                          setIsConnDropdownOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 4,
                          border: isSelected ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
                          background: isSelected ? "rgba(16, 185, 129, 0.1)" : "transparent",
                          color: isSelected ? "#10b981" : "var(--fg)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "var(--font-ui)",
                          width: "100%",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "var(--bg-2)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: isSelected ? "#10b981" : "var(--fg-3)",
                            opacity: isSelected ? 1 : 0.4,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: isSelected ? 600 : 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{
                              fontSize: 9.5,
                              color: "var(--fg-3)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            className="mono"
                          >
                            {c.type || "sql"} · {cHost}
                          </div>
                        </div>
                        {isSelected && <Check size={12} style={{ color: "#10b981", flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              className={`btn btn-icon btn-ghost ${loading ? 'spin' : ''}`}
              title="Refresh"
              style={{ height: 26, width: 26, flexShrink: 0 }}
              onClick={() => loadSchema()}
            >
              <RefreshCw size={11} className={loading ? "spin" : ""} />
            </button>
            {onToggleSidebar && (
              <button
                className="btn btn-icon btn-ghost"
                title="Hide Database Sidebar"
                style={{ height: 26, width: 26, flexShrink: 0 }}
                onClick={onToggleSidebar}
              >
                <PanelRightClose size={12} />
              </button>
            )}
          </div>
          
          {/* ── Databases tree — replaces dropdown ── */}
          <div style={{ marginTop: 10 }}>
            {/* Section header */}
            <div
              className="tree-row"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', borderRadius: 4, userSelect: 'none' }}
              onClick={() => setDbsExpanded(v => !v)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, flexShrink: 0, color: 'var(--fg-3)' }}>
                {dbsExpanded
                  ? <ChevronDown size={11} />
                  : <ChevronRight size={11} />}
              </span>
              <Database size={11} style={{ color: 'var(--fg-2)', strokeWidth: 1.6, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>Databases</span>
              <span style={{ fontSize: 10, opacity: 0.55, background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 10, fontFamily: 'var(--font-mono, monospace)' }}>
                {loadingDatabases ? '…' : databases.length}
              </span>
            </div>

            {/* Database rows */}
            {dbsExpanded && (
              <div style={{ marginTop: 2, maxHeight: '180px', overflowY: 'auto' }}>
                {databases.length > 0 && (
                  <div style={{ padding: '2px 8px 4px 20px' }}>
                    <input
                      type="text"
                      placeholder="Search databases..."
                      value={dbSearch}
                      onChange={(e) => setDbSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '3px 6px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-2)',
                        color: 'var(--fg)',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                )}
                {loadingDatabases ? (
                  <div style={{ padding: '4px 20px', fontSize: 11, color: 'var(--fg-3)' }}>Loading…</div>
                ) : databases.length === 0 ? (
                  <div style={{ padding: '4px 20px', fontSize: 11, color: 'var(--fg-3)' }}>No databases found</div>
                ) : (
                  (() => {
                    const filteredDbs = databases.filter((db) => db.toLowerCase().includes(dbSearch.toLowerCase()));
                    if (filteredDbs.length === 0) {
                      return <div style={{ padding: '4px 20px', fontSize: 11, color: 'var(--fg-3)' }}>No matching databases</div>;
                    }
                    return filteredDbs.map((db) => {
                      const isActive = db === selectedDatabase || isDbMatch(db, selectedDatabase);
                      return (
                        <div
                          key={db}
                          onClick={() => onSelectDatabase && onSelectDatabase(db)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '4px 8px 4px 20px',
                            borderRadius: 4, cursor: 'pointer', fontSize: 11.5,
                            background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent',
                            color: isActive ? '#10b981' : 'var(--fg-1)',
                            fontWeight: isActive ? 600 : 400,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)'; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          {/* Cylinder / db icon */}
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <ellipse cx="12" cy="6" rx="8" ry="2.5"/>
                            <path d="M4 6v12c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V6"/>
                            <path d="M4 12c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5"/>
                          </svg>
                          <span className="mono" style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{db.includes('||') ? db.split('||')[0] : db}</span>
                          {isActive && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-1)",
          }}
        >
          <div className="row gap-2">
            <div className="muted mono" style={{ fontSize: 10 }}>
              No connection
            </div>
          </div>
        </div>
      )}

      <div
        className="tree"
        style={{ flex: 1, overflowY: "auto", width: "100%" }}
      >
        {!selectedConnectionId ? (
          <div
            style={{ padding: 24, textAlign: "center", color: "var(--fg-3)" }}
          >
            <Database size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>No connection selected</p>
          </div>
        ) : loading ? (
          <div
            style={{ padding: 24, textAlign: "center", color: "var(--fg-3)" }}
          >
            Loading schema...
          </div>
        ) : (
          <React.Fragment>
            <div
              className="tree-row"
              onClick={() => setExpandedTables(!expandedTables)}
            >
              <span className="tree-chev">
                {expandedTables ? (
                  <ChevronDown size={11} />
                ) : (
                  <ChevronRight size={11} />
                )}
              </span>
              <Table2
                size={12}
                style={{ color: "var(--fg-2)", marginRight: 6 }}
              />
              <span style={{ fontWeight: 600 }}>Tables</span>
              <span className="tree-count">{allTables.length}</span>
            </div>

            {expandedTables && (
              <React.Fragment>
                {allTables.length > 0 && (
                  <div style={{ padding: '2px 8px 4px 22px' }}>
                    <input
                      type="text"
                      placeholder="Search tables..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '3px 6px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-2)',
                        color: 'var(--fg)',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                )}
                {allTables.length === 0 ? (
                  <div style={{ padding: '4px 20px', fontSize: 11, color: 'var(--fg-3)' }}>
                    No tables found
                  </div>
                ) : filteredTables.length === 0 ? (
                  <div style={{ padding: '4px 20px', fontSize: 11, color: 'var(--fg-3)' }}>
                    No matching tables
                  </div>
                ) : (
                  filteredTables.map((table, idx) => {
                    const isOpen = openTable === table.name;
                    const rowKey = `t-${table.name}`;
                    return (
                      <React.Fragment key={idx}>
                        <div
                          className={`tree-row indent-1 ${isOpen ? "active" : ""}`}
                          onClick={() => setOpenTable(isOpen ? null : table.name)}
                          onMouseEnter={() => setHoveredRow(rowKey)}
                          onMouseLeave={() => setHoveredRow(null)}
                          style={{ position: 'relative' }}
                        >
                          <span className="tree-chev">
                            {isOpen ? (
                              <ChevronDown size={10} />
                            ) : (
                              <ChevronRight size={10} />
                            )}
                          </span>
                          <Table2
                            size={11}
                            style={{ color: "var(--fg-3)", marginRight: 6 }}
                          />
                          <span className="mono" style={{ fontSize: 11.5 }}>
                            {table.name}
                          </span>
                          {hoveredRow === rowKey ? (
                            <CopyBtn text={table.name} />
                          ) : (
                            <span className="tree-count">
                              {table.columns?.length || 0}
                            </span>
                          )}
                        </div>

                        {isOpen &&
                          table.columns?.map((col: any, cIdx: number) => {
                            const colKey = `col-${table.name}-${col.name}`;
                            return (
                              <div
                                key={cIdx}
                                className="tree-row indent-2"
                                onMouseEnter={() => setHoveredRow(colKey)}
                                onMouseLeave={() => setHoveredRow(null)}
                              >
                                <span className="tree-chev"></span>
                                {col.isPrimary ? (
                                  <Key
                                    size={10}
                                    style={{ color: "var(--warn)", marginRight: 6 }}
                                  />
                                ) : (
                                  <span style={{ width: 10, marginRight: 6 }}></span>
                                )}
                                <span
                                  className="mono"
                                  style={{ fontSize: 11, color: "var(--fg-1)" }}
                                >
                                  {col.name}
                                </span>
                                {hoveredRow === colKey ? (
                                  <CopyBtn text={col.name} />
                                ) : (
                                  <span
                                    className="tree-count"
                                    style={{ marginLeft: "auto", fontSize: 9.5 }}
                                  >
                                    {col.type}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </React.Fragment>
            )}

            <div
              className="tree-row"
              onClick={() => setExpandedViews(!expandedViews)}
            >
              <span className="tree-chev">
                {expandedViews ? (
                  <ChevronDown size={11} />
                ) : (
                  <ChevronRight size={11} />
                )}
              </span>
              <Columns
                size={12}
                style={{ color: "var(--fg-2)", marginRight: 6 }}
              />
              <span style={{ fontWeight: 600 }}>Views</span>
              <span className="tree-count">{dbViews.length}</span>
            </div>

            {expandedViews &&
              dbViews.map((view, idx) => {
                const isOpen = openTable === view.name;
                const rowKey = `v-${view.name}`;
                return (
                  <React.Fragment key={idx}>
                    <div
                      className={`tree-row indent-1 ${isOpen ? "active" : ""}`}
                      onClick={() => setOpenTable(isOpen ? null : view.name)}
                      onMouseEnter={() => setHoveredRow(rowKey)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <span className="tree-chev">
                        {isOpen ? (
                          <ChevronDown size={10} />
                        ) : (
                          <ChevronRight size={10} />
                        )}
                      </span>
                      <Columns
                        size={11}
                        style={{ color: "var(--fg-3)", marginRight: 6 }}
                      />
                      <span className="mono" style={{ fontSize: 11.5 }}>
                        {view.name}
                      </span>
                      {hoveredRow === rowKey ? (
                        <CopyBtn text={view.name} />
                      ) : (
                        <span className="tree-count">
                          {view.columns?.length || 0}
                        </span>
                      )}
                    </div>

                    {isOpen &&
                      view.columns?.map((col: any, cIdx: number) => {
                        const colKey = `vcol-${view.name}-${col.name}`;
                        return (
                          <div
                            key={cIdx}
                            className="tree-row indent-2"
                            onMouseEnter={() => setHoveredRow(colKey)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            <span className="tree-chev"></span>
                            <span style={{ width: 10, marginRight: 6 }}></span>
                            <span
                              className="mono"
                              style={{ fontSize: 11, color: "var(--fg-1)" }}
                            >
                              {col.name}
                            </span>
                            {hoveredRow === colKey ? (
                              <CopyBtn text={col.name} />
                            ) : (
                              <span
                                className="tree-count"
                                style={{ marginLeft: "auto", fontSize: 9.5 }}
                              >
                                {col.type}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </React.Fragment>
                );
              })}

            <div
              className="tree-row"
              onClick={() => setExpandedProcs(!expandedProcs)}
            >
              <span className="tree-chev">
                {expandedProcs ? (
                  <ChevronDown size={11} />
                ) : (
                  <ChevronRight size={11} />
                )}
              </span>
              <Zap size={12} style={{ color: "var(--fg-2)", marginRight: 6 }} />
              <span style={{ fontWeight: 600 }}>Procedures</span>
              <span className="tree-count">{dbProcs.length}</span>
            </div>

            {expandedProcs &&
              dbProcs.map((proc, idx) => {
                return (
                  <div key={idx} className="tree-row indent-1">
                    <span className="tree-chev"></span>
                    <Zap
                      size={11}
                      style={{ color: "var(--fg-3)", marginRight: 6 }}
                    />
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {proc.name}
                    </span>
                  </div>
                );
              })}
          </React.Fragment>
        )}
      </div>
    </aside>
  );
};

export default SchemaSidebar;
