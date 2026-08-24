import React, { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { ipc } from "../ipc";
import "./QueryEditor.css";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  schemaTables?: any[];
  selectedConnectionId?: number | null;
  selectedDatabase?: string | null;
  onExecute?: () => void;
}

// SQL keywords for base completions
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "TABLE", "DROP", "ALTER", "ADD", "COLUMN",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "ON",
  "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET", "DISTINCT",
  "AS", "CASE", "WHEN", "THEN", "ELSE", "END",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST",
  "LIKE", "BETWEEN", "EXISTS", "UNION", "ALL", "INTERSECT", "EXCEPT",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE", "NOT NULL", "DEFAULT",
  "INDEX", "VIEW", "TRIGGER", "PROCEDURE", "FUNCTION", "BEGIN", "COMMIT", "ROLLBACK",
];

const QueryEditor: React.FC<QueryEditorProps> = ({
  value,
  onChange,
  selectedConnectionId,
  selectedDatabase,
  onExecute,
}) => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const providerRef = useRef<any>(null);
  const schemaRef = useRef<any[]>([]);

  // Fetch the schema whenever connection/db changes
  useEffect(() => {
    if (!selectedConnectionId) {
      schemaRef.current = [];
      return;
    }
    ipc
      .invoke("get-database-tables", { configId: selectedConnectionId, database: selectedDatabase })
      .then((tables: any) => {
        schemaRef.current = Array.isArray(tables) ? tables.filter((t: any) => t.type === "table" || t.type === "view") : [];
      })
      .catch(() => {
        schemaRef.current = [];
      });
  }, [selectedConnectionId, selectedDatabase]);

  const registerCompletions = (monaco: any) => {
    // Dispose previous provider to avoid duplicate registrations
    if (providerRef.current) {
      providerRef.current.dispose();
    }

    providerRef.current = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [".", "(", ","],
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];
        const schema: any[] = schemaRef.current || [];

        // ── SQL keywords ──────────────────────────────────────────────
        SQL_KEYWORDS.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: "SQL Keyword",
            range,
            sortText: "z" + kw, // push below schema items
          });
        });

        // ── Table names with snippet (SELECT * FROM table) ────────────
        schema.forEach((table: any) => {
          if (!table || !table.name) return; // Skip invalid tables

          const columnsArray = Array.isArray(table.columns) ? table.columns : [];
          
          const getColName = (c: any) => {
            if (!c) return "";
            if (typeof c === "string") return c;
            return c.name || "";
          };

          const cols = columnsArray.map(getColName).filter(Boolean).join(", ");

          // Table name completion
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table.name,
            detail: `Table (${columnsArray.length} columns)`,
            documentation: cols ? `Columns: ${cols}` : undefined,
            range,
            sortText: "a" + table.name,
          });

          // SELECT snippet for each table
          suggestions.push({
            label: `SELECT * FROM ${table.name}`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `SELECT ${cols ? cols : "*"} FROM ${table.name}`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: "Quick SELECT",
            documentation: `Select all columns from ${table.name}`,
            range,
            sortText: "b" + table.name,
          });

          // ── Column names (Commented out for testing large schemas) ──
          /*
          columnsArray.forEach((col: any) => {
            const colName = getColName(col);
            if (!colName) return; // Skip empty column names to prevent Monaco crashes

            const isPrimary = col && typeof col === "object" ? !!col.isPrimary : false;
            const fkTarget = col && typeof col === "object" ? col.fkTarget : null;
            const fkCol = col && typeof col === "object" ? col.fkCol : null;
            const colType = col && typeof col === "object" ? col.type || "" : "";

            const pkBadge = isPrimary ? " 🔑" : "";
            const fkBadge = fkTarget ? ` → ${fkTarget}.${fkCol || 'id'}` : "";

            suggestions.push({
              label: colName,
              kind: isPrimary
                ? monaco.languages.CompletionItemKind.Variable
                : fkTarget
                ? monaco.languages.CompletionItemKind.Reference
                : monaco.languages.CompletionItemKind.Field,
              insertText: colName,
              detail: `${table.name}.${colName} ${colType}${pkBadge}${fkBadge}`,
              documentation: `Column of table "${table.name}"`,
              range,
              sortText: "c" + table.name + "." + colName,
            });

            // Qualified form: table.column
            suggestions.push({
              label: `${table.name}.${colName}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `${table.name}.${colName}`,
              detail: `${colType}${pkBadge}${fkBadge}`,
              range,
              sortText: "d" + table.name + "." + colName,
            });
          });
          */
        });

        return { suggestions };
      },
    });
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom themes with explicit colors so suggest widget text is never invisible.
    // CSS variables on the host page bleed into Monaco's overlay — hard-coding fixes this.
    monaco.editor.defineTheme("db-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "2563eb", fontStyle: "bold" },
        { token: "string", foreground: "059669" },
        { token: "number", foreground: "d97706" },
        { token: "comment", foreground: "9ca0a8", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#16181b",
        "editorSuggestWidget.background": "#ffffff",
        "editorSuggestWidget.border": "#e3e5e8",
        "editorSuggestWidget.foreground": "#16181b",
        "editorSuggestWidget.selectedBackground": "#dbeafe",
        "editorSuggestWidget.selectedForeground": "#1e40af",
        "editorSuggestWidget.highlightForeground": "#059669",
        "editorSuggestWidget.focusHighlightForeground": "#047857",
      },
    });

    monaco.editor.defineTheme("db-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "60a5fa", fontStyle: "bold" },
        { token: "string", foreground: "34d399" },
        { token: "number", foreground: "fbbf24" },
        { token: "comment", foreground: "565a61", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#15171a",
        "editor.foreground": "#e6e7e8",
        "editorSuggestWidget.background": "#1b1d20",
        "editorSuggestWidget.border": "#26292e",
        "editorSuggestWidget.foreground": "#e6e7e8",
        "editorSuggestWidget.selectedBackground": "#1e3a5f",
        "editorSuggestWidget.selectedForeground": "#93c5fd",
        "editorSuggestWidget.highlightForeground": "#10b981",
        "editorSuggestWidget.focusHighlightForeground": "#34d399",
      },
    });

    monaco.editor.setTheme(isDark ? "db-dark" : "db-light");

    if (onExecute) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onExecute();
      });
    }

    registerCompletions(monaco);
  };

  // Re-register completions when connection/db changes (schema updates)
  useEffect(() => {
    if (monacoRef.current) {
      registerCompletions(monacoRef.current);
    }
    return () => {
      if (providerRef.current) {
        providerRef.current.dispose();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnectionId, selectedDatabase]);

  return (
    <div className="query-editor-container">
      <div className="editor-wrapper">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme={isDark ? "db-dark" : "db-light"}
          value={value}
          onMount={handleEditorMount}
          onChange={(val) => onChange(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: "on",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            acceptSuggestionOnEnter: "off",  // Tab accepts, Enter always inserts newline
            tabCompletion: "on",
            wordBasedSuggestions: "off",
            fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
            quickSuggestions: { other: true, comments: false, strings: true },
            suggestOnTriggerCharacters: true,
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showClasses: true,   // tables
              showFields: true,    // columns
              showVariables: true, // PK columns
              filterGraceful: true,
              insertMode: "replace",
            },
          }}
        />
      </div>
    </div>
  );
};

export default QueryEditor;
