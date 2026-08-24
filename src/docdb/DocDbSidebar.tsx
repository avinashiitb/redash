import React, { useState, useEffect } from "react";
import { Search, RefreshCw, Sparkles } from "lucide-react";
import { ipc } from "../ipc";
import { isDbMatch } from "../utils/docUtils";

interface DocDbSidebarProps {
  collections: any[];
  onSelectCollection: (colName: string) => void;
  selectedCollection: string | null;
  connection?: any;
  database?: string | null;
  onSelectDatabase?: (db: string | null) => void;
  onRefresh?: () => void;
}

const DUMMY_COLLECTIONS = [
  {
    name: "orders",
    documentCount: 4200000,
    columns: [
      { name: "_id", type: "id" },
      { name: "order_no", type: "string" },
      {
        name: "customer",
        type: "object",
        properties: [
          { name: "email", type: "string" },
          { name: "name", type: "string" },
          { name: "country", type: "string" }
        ]
      },
      {
        name: "line_items",
        type: "array",
        properties: [
          { name: "product_id", type: "id" },
          { name: "sku", type: "string" },
          { name: "qty", type: "number" },
          { name: "unit_cents", type: "number" },
          { name: "total_cents", type: "number" },
          { name: "options", type: "object", properties: [] }
        ]
      },
      { name: "status", type: "string" },
      { name: "total_cents", type: "number" },
      { name: "currency", type: "string" },
      { name: "placed_at", type: "date" },
      { name: "tags", type: "array", isArrayOfStrings: true },
      { name: "meta", type: "object", properties: [] }
    ]
  },
  { name: "customers", documentCount: 128400 },
  { name: "products", documentCount: 18200 },
  { name: "events", documentCount: 86400000 },
  { name: "sessions", documentCount: 1800000 },
  { name: "posts", documentCount: 12000 },
  { name: "reviews", documentCount: 220400 },
  { name: "carts", documentCount: 442000 },
  { name: "payments", documentCount: 3800000 },
  { name: "shipments", documentCount: 3800000 },
  { name: "audit_log", documentCount: 12400000 },
  { name: "fs.files", documentCount: 9400 }
];

const DocDbSidebar: React.FC<DocDbSidebarProps> = ({
  collections = [],
  onSelectCollection,
  selectedCollection,
  connection,
  database,
  onSelectDatabase,
  onRefresh,
}) => {
  const [filter, setFilter] = useState("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [dbSearch, setDbSearch] = useState("");
  const [loadingDatabases, setLoadingDatabases] = useState(false);

  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({
    orders: true, // Default expanded to match screenshot
  });
  const [expandedSubObjects, setExpandedSubObjects] = useState<Record<string, boolean>>({
    "orders.customer": true,
    "orders.line_items": true,
  });
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [viewsExpanded, setViewsExpanded] = useState(false);
  const [indexesExpanded, setIndexesExpanded] = useState(false);
  const [dbsExpanded, setDbsExpanded] = useState(true);
  const [showNewDbInput, setShowNewDbInput] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [creatingDb, setCreatingDb] = useState(false);

  // Load available databases when connection changes
  useEffect(() => {
    if (!connection?.id) {
      setDatabases([]);
      return;
    }
    const fetchDbs = async () => {
      setLoadingDatabases(true);
      try {
        const dbs = await ipc.invoke('get-databases', { configId: connection.id });
        if (Array.isArray(dbs) && dbs.length > 0) {
          setDatabases(dbs);
          // Auto-select: pick the first DB if nothing is selected yet
          if (onSelectDatabase) {
            const pinned = connection?.database;
            const alreadyValid = database && dbs.some(d => isDbMatch(d, database));
            const best = alreadyValid
              ? database
              : ((pinned && dbs.some(d => isDbMatch(d, pinned))) ? dbs.find(d => isDbMatch(d, pinned)) : dbs[0]);
            onSelectDatabase(best || null);
          }
        } else {
          setDatabases([]);
        }
      } catch (e) {
        setDatabases([]);
      } finally {
        setLoadingDatabases(false);
      }
    };
    fetchDbs();
  }, [connection?.id]);

  const handleCreateDb = async () => {
    const name = newDbName.trim();
    if (!name || !connection?.id) return;
    setCreatingDb(true);
    try {
      // Create a placeholder collection to force MongoDB to create the database
      await ipc.invoke('execute-query', {
        configId: connection.id,
        database: name,
        query: `db.createCollection("_placeholder")`
      });
      // Refresh the database list and select the new db
      const dbs = await ipc.invoke('get-databases', { configId: connection.id });
      if (Array.isArray(dbs) && dbs.length > 0) {
        setDatabases(dbs);
      }
      if (onSelectDatabase) onSelectDatabase(name);
      if (onRefresh) onRefresh();
      setNewDbName("");
      setShowNewDbInput(false);
    } catch (e) {
      console.error('Failed to create database:', e);
    } finally {
      setCreatingDb(false);
    }
  };

  const toggleCollection = (colName: string) => {
    setExpandedCols((prev) => ({
      ...prev,
      [colName]: !prev[colName],
    }));
  };

  const toggleSubObject = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubObjects((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const formatCount = (count: number) => {
    if (!count) return "0";
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
    if (count >= 1000) return (count / 1000).toFixed(1) + "k";
    return count.toString();
  };

  const renderBadge = (type: string, isArray: boolean, isArrayOfStrings?: boolean) => {
    let text = "S";
    let bg = "rgba(16, 185, 129, 0.133)";
    let color = "rgb(16, 185, 129)";

    const normType = type?.toLowerCase();
    if (normType === "id") {
      text = "id";
      bg = "rgba(168, 85, 247, 0.133)";
      color = "rgb(168, 85, 247)";
    } else if (normType === "string") {
      text = "S";
      bg = "rgba(16, 185, 129, 0.133)";
      color = "rgb(16, 185, 129)";
    } else if (normType === "number") {
      text = "#";
      bg = "rgba(245, 158, 11, 0.133)";
      color = "rgb(245, 158, 11)";
    } else if (normType === "date") {
      text = "D";
      bg = "rgba(236, 72, 153, 0.133)";
      color = "rgb(236, 72, 153)";
    } else if (normType === "boolean") {
      text = "B";
      bg = "rgba(96, 165, 250, 0.133)";
      color = "rgb(96, 165, 250)";
    } else if (normType === "object") {
      text = "{}";
      bg = "rgba(96, 165, 250, 0.133)";
      color = "rgb(96, 165, 250)";
    } else if (normType === "array") {
      if (isArrayOfStrings) {
        text = "S";
        bg = "rgba(16, 185, 129, 0.133)";
        color = "rgb(16, 185, 129)";
      } else {
        text = "{}";
        bg = "rgba(96, 165, 250, 0.133)";
        color = "rgb(96, 165, 250)";
      }
    }

    return (
      <span style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: color,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "9px",
        fontWeight: 700,
        flex: "0 0 16px",
        position: "relative"
      }}>
        {text}
        {isArray && (
          <span style={{
            position: "absolute",
            right: -3,
            top: -3,
            width: 8,
            height: 8,
            borderRadius: 2,
            background: "var(--bg-1)",
            border: `1px solid ${color}`,
            color: color,
            fontSize: "7px",
            lineHeight: "6px",
            textAlign: "center",
            fontWeight: 700
          }}>
            []
          </span>
        )}
      </span>
    );
  };

  const getIndicatorBar = (fieldName: string) => {
    let width = "100%";
    let color = "var(--accent)";
    let pct = "100%";
    
    if (fieldName === "name") {
      width = "98%";
      color = "var(--warn)";
      pct = "98%";
    } else if (fieldName === "options") {
      width = "42%";
      color = "var(--warn)";
      pct = "42%";
    } else if (fieldName === "tags") {
      width = "34%";
      color = "var(--warn)";
      pct = "34%";
    } else if (fieldName === "meta") {
      width = "62%";
      color = "var(--warn)";
      pct = "62%";
    }
    
    return (
      <span title={`${pct} present`} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto", flexShrink: 0 }}>
        <span style={{ display: "inline-block", width: 18, height: 4, borderRadius: 2, background: "var(--bg-3)", overflow: "hidden", position: "relative" }}>
          <span style={{ position: "absolute", inset: 0, width, background: color }} />
        </span>
      </span>
    );
  };

  const getCollectionBadges = (colName: string) => {
    switch (colName) {
      case "orders":
        return <span className="dim mono" title="sharded · key _id" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>⌥</span>;
      case "events":
        return <span className="dim mono" title="sharded · key {user_id:1, ts:1}" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>⌥</span>;
      case "sessions":
        return <span className="dim mono" title="TTL 30d" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>⏱</span>;
      case "carts":
        return <span className="dim mono" title="TTL 7d" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>⏱</span>;
      case "payments":
      case "shipments":
        return <span className="dim mono" title="sharded · key " style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>⌥</span>;
      case "audit_log":
        return (
          <>
            <span className="dim mono" title="sharded · key " style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>⌥</span>
            <span className="dim mono" title="TTL 90d" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>⏱</span>
          </>
        );
      case "fs.files":
        return <span className="dim mono" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>sys</span>;
      default:
        return null;
    }
  };

  const renderField = (field: any, path: string, depth = 1) => {
    const isObject = field.type === "object" && field.properties;
    const isArrayOfObjects = field.type === "array" && field.properties;
    const hasChildren = isObject || isArrayOfObjects;
    const currentPath = `${path}.${field.name}`;
    const isExpanded = expandedSubObjects[currentPath];

    const hasBlueDot = ["order_no", "email", "placed_at", "status"].includes(field.name);
    const label = field.name === "_id" ? "PK" : (field.name === "order_no" ? "UQ" : null);

    return (
      <div key={field.name}>
        <div
          className="tree-row"
          style={{
            paddingLeft: depth * 12 + 12,
            gap: 6,
            height: 24,
            display: "flex",
            alignItems: "center"
          }}
          onClick={(e) => hasChildren && toggleSubObject(currentPath, e)}
        >
          <span className="tree-chev" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, cursor: hasChildren ? "pointer" : "default" }}>
            {hasChildren ? (
              isExpanded ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                  <path d="M6 9l6 6 6-6"></path>
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                  <path d="M9 6l6 6-6 6"></path>
                </svg>
              )
            ) : null}
          </span>

          {renderBadge(field.type, field.type === "array", field.isArrayOfStrings)}

          <span className="mono" style={{ fontSize: 11, color: field.name === "_id" ? "var(--warn)" : "var(--fg-1)" }}>
            {field.name}
          </span>

          {hasBlueDot && (
            <span title="Indexed" style={{ fontSize: 9, color: "var(--info)", marginLeft: -2 }}>●</span>
          )}

          {label && (
            <span className="dim mono" style={{ fontSize: 9, marginLeft: 2 }}>{label}</span>
          )}

          {getIndicatorBar(field.name)}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {field.properties.map((subField: any) => renderField(subField, currentPath, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Determine actual items
  const activeCollections = collections.length > 0 ? collections : DUMMY_COLLECTIONS;

  // Filter collections
  const filteredCollections = activeCollections.filter((c) => {
    const search = filter.toLowerCase();
    if (c.name.toLowerCase().includes(search)) return true;
    return (c.columns || []).some((col: any) => col.name.toLowerCase().includes(search));
  });

  return (
    <aside className="docdb-sidebar" style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-1)", borderLeft: "1px solid var(--border)" }}>
      {/* Premium Connection Info top area */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "rgba(16, 185, 129, 0.14)",
            color: "rgb(16, 185, 129)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            fontWeight: 700,
          }}>
            Mg
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {connection?.name || "events_cluster"}
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-3)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {connection?.type || "mongo"} · {activeCollections.length} collections {database ? `· ${database.includes('||') ? database.split('||')[0] : database}` : ""}
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-3)", display: "inline-flex", padding: 4, borderRadius: 4 }}
              title="Refresh Schema"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        {/* Search exploration box */}
        <div style={{ position: "relative", marginTop: 8 }}>
          <input
            type="text"
            className="docdb-search-input"
            placeholder="Filter collections, fields..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ paddingLeft: 28, paddingRight: 32, width: "100%", height: 28, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11.5, color: "var(--fg)", outline: "none" }}
          />
          <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)" }} />
          <span className="kbd" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, opacity: 0.6, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 3px" }}>⌘K</span>
        </div>
      </div>

      {/* Main scrolling schema section */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }} className="tree">

        {/* ── Databases Section ───────────────────────────────────────── */}
        <div
          className="tree-row"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", cursor: "pointer", borderRadius: 4 }}
          onClick={() => setDbsExpanded(!dbsExpanded)}
        >
          <span className="tree-chev" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 12 }}>
            {dbsExpanded ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i"><path d="M6 9l6 6 6-6"></path></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i"><path d="M9 6l6 6-6 6"></path></svg>
            )}
          </span>
          {/* cylinder icon = database */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i" style={{ color: "var(--fg-2)" }}>
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path>
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"></path>
          </svg>
          <span style={{ fontWeight: 600 }}>Databases</span>
          <span className="tree-count" style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6, background: "var(--bg-3)", padding: "1px 5px", borderRadius: 10 }}>
            {loadingDatabases ? "…" : databases.length}
          </span>
          {/* + New Database button */}
          {connection?.id && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowNewDbInput(v => !v); setNewDbName(""); }}
              title="Create new database"
              style={{
                background: showNewDbInput ? "var(--accent-soft)" : "none",
                border: "none",
                cursor: "pointer",
                color: showNewDbInput ? "var(--accent)" : "var(--fg-3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: 3,
                flexShrink: 0,
                marginLeft: 4,
                fontSize: 16,
                lineHeight: 1,
                fontWeight: 300,
              }}
            >
              +
            </button>
          )}
        </div>

        {dbsExpanded && (
          <div style={{ marginTop: 2, marginBottom: 4, maxHeight: '180px', overflowY: 'auto' }}>
            {databases.length > 0 && (
              <div style={{ padding: "2px 8px 4px 20px" }}>
                <input
                  type="text"
                  placeholder="Search databases..."
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "3px 6px",
                    fontSize: "11px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-2)",
                    color: "var(--fg)",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            )}
            {loadingDatabases ? (
              <div style={{ padding: "6px 20px", fontSize: 11, color: "var(--fg-3)" }}>Loading databases...</div>
            ) : databases.length === 0 ? (
              <div style={{ padding: "6px 20px", fontSize: 11, color: "var(--fg-3)" }}>No databases found</div>
            ) : (
              (() => {
                const filteredDbs = databases.filter((db) => db.toLowerCase().includes(dbSearch.toLowerCase()));
                if (filteredDbs.length === 0) {
                  return <div style={{ padding: "6px 20px", fontSize: 11, color: "var(--fg-3)" }}>No matching databases</div>;
                }
                return filteredDbs.map((db) => {
                  const isActive = db === database || isDbMatch(db, database);
                  return (
                    <div
                      key={db}
                      className={`tree-row indent-1 ${isActive ? "active" : ""}`}
                      onClick={() => onSelectDatabase && onSelectDatabase(db)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "4px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 11.5,
                        background: isActive ? "rgba(16, 185, 129, 0.08)" : "transparent",
                        color: isActive ? "#10b981" : "var(--fg-1)",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, marginRight: 6 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <ellipse cx="12" cy="6" rx="8" ry="2.5"></ellipse>
                          <path d="M4 6v12c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V6"></path>
                          <path d="M4 12c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5"></path>
                        </svg>
                      </span>
                      <span className="mono" style={{ fontSize: "11px", flex: 1, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{db.includes('||') ? db.split('||')[0] : db}</span>
                      {isActive && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#10b981", flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* ── New Database inline input ─────────────────────────────────── */}
        {showNewDbInput && (
          <div style={{ padding: "4px 8px 8px 20px" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                autoFocus
                type="text"
                placeholder="Database name…"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateDb();
                  if (e.key === "Escape") { setShowNewDbInput(false); setNewDbName(""); }
                }}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  fontSize: 11,
                  borderRadius: 4,
                  border: "1px solid var(--accent)",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleCreateDb}
                disabled={!newDbName.trim() || creatingDb}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "none",
                  background: newDbName.trim() ? "var(--accent)" : "var(--bg-3)",
                  color: newDbName.trim() ? "var(--accent-fg, #fff)" : "var(--fg-3)",
                  cursor: newDbName.trim() ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                {creatingDb ? "Creating…" : "Create"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 4 }}>
              Press Enter · Esc to cancel
            </div>
          </div>
        )}

        {/* ── Collections Section ─────────────────────────────────────── */}
        <div style={{ height: 1, background: "var(--border)", margin: "4px 0 6px" }} />
        <div
          className="tree-row"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", cursor: "pointer", borderRadius: 4 }}
          onClick={() => setCollectionsExpanded(!collectionsExpanded)}
        >
          <span className="tree-chev" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 12 }}>
            {collectionsExpanded ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i"><path d="M6 9l6 6 6-6"></path></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i"><path d="M9 6l6 6-6 6"></path></svg>
            )}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i" style={{ color: "var(--fg-2)" }}>
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          </svg>
          <span style={{ fontWeight: 600 }}>Collections</span>
          {database && <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)", marginLeft: 2 }}>· {database.includes('||') ? database.split('||')[0] : database}</span>}
          <span className="tree-count" style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6, background: "var(--bg-3)", padding: "1px 5px", borderRadius: 10 }}>{filteredCollections.length}</span>
        </div>

        {collectionsExpanded && (
          <div style={{ marginTop: 2 }}>
            {filteredCollections.map((c) => {
              const isSelected = selectedCollection === c.name;
              const isExpanded = expandedCols[c.name];

              return (
                <div key={c.name} className="docdb-tree-node" style={{ marginBottom: 2 }}>
                  <div
                    className={`tree-row indent-1 ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      onSelectCollection(c.name);
                      toggleCollection(c.name);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11.5,
                      background: isSelected ? "rgba(16, 185, 129, 0.08)" : "transparent",
                      color: isSelected ? "#10b981" : "var(--fg-1)",
                      fontWeight: isSelected ? 600 : 500
                    }}
                  >
                    <span className="tree-chev" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, marginRight: 2 }}>
                      {isExpanded ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                          <path d="M6 9l6 6 6-6"></path>
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                          <path d="M9 6l6 6-6 6"></path>
                        </svg>
                      )}
                    </span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i" style={{ color: "var(--fg-3)", marginRight: 6 }}>
                      <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                      <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                      <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                      <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                    </svg>
                    <span className="mono" style={{ fontSize: "11.5px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                    {getCollectionBadges(c.name)}
                    {c.documentCount !== undefined && (
                      <span className="tree-count" style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6, fontFamily: "var(--font-mono, monospace)" }}>
                        {formatCount(c.documentCount)}
                      </span>
                    )}
                  </div>

                  {isExpanded && c.columns && c.columns.length > 0 && (
                    <div style={{ marginTop: 2, marginBottom: 4 }}>
                      {c.columns.map((col: any) => renderField(col, c.name, 1))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Views Header */}
        <div
          className="tree-row"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", cursor: "pointer", borderRadius: 4, marginTop: 8 }}
          onClick={() => setViewsExpanded(!viewsExpanded)}
        >
          <span className="tree-chev" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 11 }}>
            {viewsExpanded ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                <path d="M6 9l6 6 6-6"></path>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                <path d="M9 6l6 6-6 6"></path>
              </svg>
            )}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i" style={{ color: "var(--fg-2)" }}>
            <rect x="4" y="4" width="6" height="16" rx="1"></rect>
            <rect x="14" y="4" width="6" height="16" rx="1"></rect>
          </svg>
          <span style={{ fontWeight: 600 }}>Views</span>
          <span className="tree-count" style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6, background: "var(--bg-3)", padding: "1px 5px", borderRadius: 10 }}>2</span>
        </div>

        {/* Indexes Header */}
        <div
          className="tree-row"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", cursor: "pointer", borderRadius: 4, marginTop: 8 }}
          onClick={() => setIndexesExpanded(!indexesExpanded)}
        >
          <span className="tree-chev" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 11 }}>
            {indexesExpanded ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                <path d="M6 9l6 6 6-6"></path>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="i">
                <path d="M9 6l6 6-6 6"></path>
              </svg>
            )}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" strokeLinecap="round" strokeLinejoin="round" className="i" style={{ color: "var(--fg-2)" }}>
            <path d="M4 6h16M4 12h12M4 18h8"></path>
            <circle cx="20" cy="12" r="1.5" fill="currentColor"></circle>
          </svg>
          <span style={{ fontWeight: 600 }}>Indexes</span>
          <span className="tree-count" style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6, background: "var(--bg-3)", padding: "1px 5px", borderRadius: 10 }}>6</span>
        </div>
      </div>

      {/* Premium Ask AI Banner at bottom */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-1)", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-1)", fontSize: 11.5, fontWeight: 500 }}>
          <Sparkles size={13} style={{ color: "var(--accent-color)" }} />
          <span>Ask AI about schema</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style={{ opacity: 0.6 }}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
      </div>
    </aside>
  );
};

export default DocDbSidebar;
