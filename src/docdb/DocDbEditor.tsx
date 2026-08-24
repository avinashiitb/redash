import React, { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";

interface DocDbEditorProps {
  value: string;
  onChange: (value: string) => void;
  collections?: any[];
  language?: string;
  onExecute?: () => void;
}

const MONGO_KEYWORDS = [
  "db", "aggregate", "find", "findOne", "insertOne", "insertMany",
  "updateOne", "updateMany", "deleteOne", "deleteMany", "countDocuments",
  "limit", "sort", "skip", "toArray", "ISODate", "ObjectId",
  // Pipeline Operators
  "$match", "$group", "$project", "$unwind", "$lookup", "$sort", "$limit",
  "$skip", "$addFields", "$replaceRoot", "$facet", "$bucket",
  // Group Operators
  "$sum", "$avg", "$min", "$max", "$push", "$addToSet", "$first", "$last",
  // Field Operators
  "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$ne", "$eq", "$or", "$and", "$not",
];

const DocDbEditor: React.FC<DocDbEditorProps> = ({
  value,
  onChange,
  collections = [],
  language,
  onExecute,
}) => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const providerRef = useRef<any>(null);
  const collectionsRef = useRef<any[]>([]);

  useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);

  const registerCompletions = (monaco: any, lang: string) => {
    if (providerRef.current) {
      providerRef.current.dispose();
    }

    if (lang !== "javascript") {
      return;
    }

    providerRef.current = monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: [".", "$", "{", "[", ","],
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];
        const cols = collectionsRef.current;

        // ── MongoDB Keywords ─────────────────────────────────────────
        MONGO_KEYWORDS.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: "MongoDB Keyword",
            range,
            sortText: "z" + kw,
          });
        });

        // ── Collections (db.collection) ──────────────────────────────
        cols.forEach((c) => {
          suggestions.push({
            label: `db.${c.name}`,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `db.${c.name}`,
            detail: `Collection (${c.documentCount || 0} docs)`,
            range,
            sortText: "a" + c.name,
          });

          // Sample aggregate snippet
          suggestions.push({
            label: `db.${c.name}.aggregate`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `db.${c.name}.aggregate([\n\t{ $match: { \${1:status}: '\${2:fulfilled}' } },\n\t{ $group: { _id: '\$\${3:customer_id}', total: { $sum: '\$\${4:price}' } } }\n])`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: "Snippet: Aggregate pipeline",
            range,
            sortText: "b" + c.name,
          });

          // Sample find snippet
          suggestions.push({
            label: `db.${c.name}.find`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `db.${c.name}.find({ \${1:status}: '\${2:fulfilled}' })`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: "Snippet: Find documents",
            range,
            sortText: "c" + c.name,
          });
        });

        return { suggestions };
      },
    });
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom themes matching database look & feel
    monaco.editor.defineTheme("db-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "059669", fontStyle: "bold" },
        { token: "string", foreground: "2563eb" },
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
      },
    });

    monaco.editor.defineTheme("db-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "10b981", fontStyle: "bold" },
        { token: "string", foreground: "60a5fa" },
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
      },
    });

    monaco.editor.setTheme(isDark ? "db-dark" : "db-light");

    if (onExecute) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onExecute();
      });
    }

    registerCompletions(monaco, language || "javascript");
  };

  useEffect(() => {
    if (monacoRef.current) {
      registerCompletions(monacoRef.current, language || "javascript");
    }
  }, [language]);

  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="docdb-editor-wrapper" style={{ height: "100%" }}>
      <Editor
        height="100%"
        language={language || "javascript"}
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
          fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
          quickSuggestions: { other: true, comments: false, strings: true },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "off",
          tabCompletion: "on",
          wordBasedSuggestions: "off",
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showClasses: true,
            filterGraceful: true,
            insertMode: "replace",
          },
        }}
      />
    </div>
  );
};

export default DocDbEditor;
