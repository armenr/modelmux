// Minimal JSONC support (comments + trailing commas), no dependencies.
// Walks the string so // and /* */ inside string literals are preserved.
export function parseJsonc(text: string): unknown {
  let out = "";
  let inStr = false;
  let quote = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote)
        inStr = false;
      i++;
      continue;
    }
    if (c === "\"" || c === "'") {
      inStr = true;
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // remove trailing commas before } or ]
  out = out.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(out);
}
