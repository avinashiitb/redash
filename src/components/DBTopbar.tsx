import React, { useState, useRef, useEffect } from "react";
import {
  Database,
  Bolt,
  Sparkles,
  Play,
  Folder,
  Upload,
  Download,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import "./DBTopbar.css";

interface DBTopbarProps {
  connections?: any[];
  selectedConnectionId?: number | null;
  onSelectConnection?: (id: number | null) => void;
  theme?: string;
  onToggleTheme?: () => void;
  view?: string;
  setView?: (v: string) => void;
  isExecuting?: boolean;
  onExecute?: () => void;
  onFormat?: () => void;
  showFormat?: boolean;
  fileName?: string;
  breadcrumbs?: { label: string; isFile?: boolean }[];
  onExport?: () => void;
  onExportCsv?: () => void;
  onExportJson?: () => void;
}

const DBTopbar: React.FC<DBTopbarProps> = ({
  view = "query",
  setView,
  isExecuting = false,
  onExecute,
  onFormat,
  showFormat = true,
  fileName = "Untitled query",
  breadcrumbs = [],
  onExport,
  onExportCsv,
  onExportJson,
}) => {
  const [showPathToast, setShowPathToast] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setShowPathToast(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setShowPathToast(false);
  };

  const handleScroll = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setShowPathToast(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) > 0) return;

    if (e.deltaY !== 0) {
      const el = e.currentTarget;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;

      if ((el.scrollLeft <= 0 && e.deltaY < 0) || (el.scrollLeft >= maxScroll && e.deltaY > 0)) {
        return;
      }
      el.scrollLeft += e.deltaY;
    }
  };

  const fullPath = React.useMemo(() => {
    if (breadcrumbs.length > 0) {
      return breadcrumbs.map((b) => b.label).join(" / ");
    }
    return fileName || "Untitled";
  }, [breadcrumbs, fileName]);

  return (
    <header className="header" style={{ position: "relative" }}>
      {/* Scrollable Fixed-Width Title (350px) */}
      <nav
        className="topbar-title-scroll"
        style={{
          width: 350,
          minWidth: 350,
          maxWidth: 350,
          flex: "0 0 350px",
          display: "flex",
          alignItems: "center",
          gap: 0,
          fontSize: 12,
          overflowX: "auto",
          overflowY: "hidden",
          flexWrap: "nowrap",
          userSelect: "none",
          cursor: "default",
          scrollbarWidth: "none",
          overscrollBehaviorX: "contain",
        }}
        onWheel={handleWheel}
        onScroll={handleScroll}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="file path"
        title={fullPath}
      >
        <Folder size={11} style={{ marginRight: 6, opacity: 0.7, color: "var(--fg-3)", flexShrink: 0 }} />
        {(breadcrumbs.length > 0
          ? breadcrumbs
          : [{ label: fileName || "Untitled", isFile: true }]
        ).map((seg, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <span style={{ color: "var(--fg-3)", opacity: 0.5, margin: "0 4px", fontSize: 13, userSelect: "none", flexShrink: 0 }}>›</span>
            )}
            {!seg.isFile && (
              <span
                style={{
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--fg-3)",
                  cursor: "default",
                  flexShrink: 0,
                }}
                title={seg.label}
              >
                {seg.label}
              </span>
            )}
            {seg.isFile && (
              <span
                style={{
                  whiteSpace: "nowrap",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--fg)",
                  cursor: "default",
                  flexShrink: 0,
                }}
                title={seg.label}
              >
                {seg.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Hover Toast with Complete Path */}
      {showPathToast && (
        <div
          style={{
            position: "fixed",
            top: 44,
            left: 14,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 6,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            color: "var(--fg)",
            fontSize: 11.5,
            fontFamily: "var(--font-mono, monospace)",
            pointerEvents: "none",
            animation: "fadeSlideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <Folder size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{fullPath}</span>
        </div>
      )}

      {/* Center Segmented Control: Query / Connections */}
      {setView && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            zIndex: 5,
          }}
        >
          <div className="seg" style={{ padding: "1px 2px", height: 26 }}>
            <button
              className={view === "query" ? "on" : ""}
              onClick={() => setView("query")}
              style={{ height: 22, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Bolt size={11} /> Query
            </button>
            <button
              className={view === "connections" ? "on" : ""}
              onClick={() => setView("connections")}
              style={{ height: 22, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Database size={11} /> Connections
            </button>
          </div>
        </div>
      )}

      <div className="grow"></div>

      {view === "query" && (
        <React.Fragment>
          <button
            className="btn btn-primary"
            style={{ marginRight: 8 }}
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
          {showFormat && (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 8 }}
              onClick={onFormat}
            >
              <Sparkles size={11} /> Format
            </button>
          )}
        </React.Fragment>
      )}

      <span className="vdiv" style={{ margin: "0 8px" }}></span>

      {(onExport || onExportCsv || onExportJson) && (
        <div style={{ position: "relative" }} ref={exportMenuRef}>
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            title="Export Options"
          >
            <Upload size={12} />
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
                    width: "100%",
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
                    width: "100%",
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
                    width: "100%",
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
                  <span>Export as File</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default DBTopbar;
