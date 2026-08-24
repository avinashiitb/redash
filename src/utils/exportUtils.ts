export const exportToCsv = (data: any[], columns: any[] = [], filename: string = "query_results") => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    alert("No data available to export to CSV.");
    return;
  }

  let colKeys: string[] = [];
  let colLabels: string[] = [];

  if (columns && columns.length > 0) {
    colKeys = columns.map((c) => (typeof c === "object" ? c.key || c.name || String(c) : String(c)));
    colLabels = columns.map((c) => (typeof c === "object" ? c.label || c.name || c.key || String(c) : String(c)));
  } else {
    // Infer column keys from first row object
    const firstRow = data[0];
    if (firstRow && typeof firstRow === "object") {
      colKeys = Object.keys(firstRow);
      colLabels = [...colKeys];
    } else {
      colKeys = ["value"];
      colLabels = ["Value"];
    }
  }

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    let str = typeof val === "object" ? JSON.stringify(val) : String(val);
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows: string[] = [];
  csvRows.push(colLabels.map(escapeCsv).join(","));

  for (const row of data) {
    if (typeof row === "object" && row !== null) {
      const values = colKeys.map((k) => escapeCsv(row[k]));
      csvRows.push(values.join(","));
    } else {
      csvRows.push(escapeCsv(row));
    }
  }

  const csvString = csvRows.join("\r\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = filename ? filename.replace(/\s+/g, "_").toLowerCase() : "query_results";
  link.download = `${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToJson = (data: any, filename: string = "query_results") => {
  if (!data) {
    alert("No data available to export to JSON.");
    return;
  }

  const jsonString = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = filename ? filename.replace(/\s+/g, "_").toLowerCase() : "query_results";
  link.download = `${safeName}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
