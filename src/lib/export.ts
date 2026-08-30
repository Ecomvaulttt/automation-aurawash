export type ExportValue = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportValue>;

const normalize = (value: ExportValue) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
};

export function downloadFile(filename: string, content: string, type: string) {
  downloadBlob(filename, new Blob([content], { type }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: ExportRow[]) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const escapeCell = (value: ExportValue) => {
    const text = normalize(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(";")),
  ].join("\n");
}
