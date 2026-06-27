// Minimal JSONC support (comments + trailing commas), no dependencies.
// Walks the string so // and /* */ inside string literals are preserved.
export function parseJsonc(text: string): unknown {
  let out = "";
  let inStr = false;
  let quote = "";
  let i = 0;
  // Track the last non-whitespace char emitted to out, so we can drop a
  // trailing comma right before a closing } or ] without corrupting strings.
  let lastNonWs = "";
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
      lastNonWs = c;
      i++;
      continue;
    }
    if (c === "\"" || c === "'") {
      inStr = true;
      quote = c;
      out += c;
      lastNonWs = c;
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
    // Drop a trailing comma before a closing bracket (outside strings).
    if ((c === "}" || c === "]") && lastNonWs === ",") {
      const cut = out.lastIndexOf(",");
      out = out.slice(0, cut) + out.slice(cut + 1);
    }
    out += c;
    if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r")
      lastNonWs = c;
    i++;
  }
  return JSON.parse(out);
}
