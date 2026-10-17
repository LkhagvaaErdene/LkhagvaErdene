export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// null, undefined, хоосон утгыг "-" болгож харуулах, XSS хамгаалах функц.
export function safeValue(value) {
  return escapeHtml(value ?? "-");
}

// JSON key → хүний уншихад ойлгомжтой title болгох функц. Жишээ нь: "proximates" → "Proximates", "collection_information" → "Collection Information" гэх мэт.
export function titleFromKey(key) {
  return escapeHtml(
    String(key ?? "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase()),
  );
}
