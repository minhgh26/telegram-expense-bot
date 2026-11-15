#!/usr/bin/env node
// Extracts file-name + code-block pairs from a Notion page fetched via
// mcp__claude_ai_Notion__notion-fetch, where the page stores each file as:
//
//   ### `path/to/file.ext`
//   ```lang
//   ...content...
//   ```
//
// A file's own content can legitimately contain a complete fenced code block
// of its own (a markdown doc showing a snippet). Closing on the *first* ```
// after the header truncates that file silently. Instead: bound each file by
// the *next* `### \`...\`` header (or end of content), then take everything
// between the *first* and *last* fence line inside that span. Nesting inside
// a span is then just literal file content, not a parse boundary.
//
// Notion also *transforms* content on the way out, so what comes back is not
// byte-identical to what went in. Two transforms are systematic enough to undo
// here, plus one escape that the exporting-commits-to-notion skill adds on the
// way in — see repair() for what they are and why undoing them is safe. All are
// counted and reported per file: the point is that the operator sees the
// repair, not that it happens quietly.
//
// Usage:
//   node extract.js <notion-fetch-result.json> <target-dir> [--list]
//
// <notion-fetch-result.json> is the file the fetch tool saves its result to
// when the page is too large to return inline (the tool's error message
// names the path). --list previews without writing.

const fs = require('fs');
const path = require('path');

const [srcPath, outDir, flag] = process.argv.slice(2);
const listOnly = flag === '--list';

if (!srcPath || !outDir) {
  console.error('Usage: node extract.js <notion-fetch-result.json> <target-dir> [--list]');
  process.exit(1);
}

// Notion auto-links every bare URL, so `https://x` comes back as `<https://x>`.
// This is not cosmetic: in a package-lock.json it makes `npm ci` read the
// resolved URL as a file path and fail outright; in an SVG it corrupts xmlns
// and the file stops rendering; in JSX it breaks every href. Angle brackets
// around a bare URL are a legal markdown autolink, so in a .md file this could
// in principle be the author's intent — but a page authored in Notion can't
// express that distinguishably, since Notion wraps bare URLs either way.
// Unwrap unconditionally and report the count.
const AUTOLINK = /<(https?:\/\/[^>\s]*)>/g;

// Notion's markdown parser closes a code block on any line starting with ```,
// so exporting-commits-to-notion puts a backslash in front of every content
// line that starts with ``` or with `### \`` (a line import would split on).
// A line that already started with backslashes got one more, so removing
// exactly one restores the original.
const ESCAPED = /^([ \t]*)\\(\\*(?:```|### `))/gm;

// Returns the repaired content plus what it had to repair.
function repair(code) {
  let unwrapped = 0;
  let out = code.replace(AUTOLINK, (_, url) => {
    unwrapped++;
    return url;
  });

  let unescaped = 0;
  out = out.replace(ESCAPED, (_, indent, rest) => {
    unescaped++;
    return indent + rest;
  });

  // Fence-bounded extraction takes the lines *between* the fences, which drops
  // the file's final newline. Nearly every tool that reads these files wants it
  // back — prettier --check fails without it, and POSIX expects it.
  let newline = false;
  if (out.length > 0 && !out.endsWith('\n')) {
    out += '\n';
    newline = true;
  }

  return { code: out, unwrapped, unescaped, newline };
}

const obj = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const text = obj.text ?? obj;
// Greedy, to the last </content>: a file in the page may contain the tag itself.
const contentMatch = text.match(/<content>([\s\S]*)<\/content>/);
const content = contentMatch ? contentMatch[1] : text;
const lines = content.split('\n');

const headerIdx = [];
for (let i = 0; i < lines.length; i++) {
  if (/^### `([^`]+)`\s*$/.test(lines[i])) headerIdx.push(i);
}

const files = [];
for (let h = 0; h < headerIdx.length; h++) {
  const start = headerIdx[h];
  const end = h + 1 < headerIdx.length ? headerIdx[h + 1] : lines.length;
  const name = lines[start].match(/^### `([^`]+)`\s*$/)[1];
  const chunk = lines.slice(start + 1, end);

  const fenceLines = [];
  for (let k = 0; k < chunk.length; k++) {
    if (/^```/.test(chunk[k])) fenceLines.push(k);
  }
  if (fenceLines.length < 2) {
    console.log(`WARN: fewer than 2 fence lines for "${name}" — skipped, inspect manually`);
    continue;
  }
  const raw = chunk.slice(fenceLines[0] + 1, fenceLines[fenceLines.length - 1]).join('\n');
  const { code, unwrapped, unescaped, newline } = repair(raw);
  files.push({ name, code, unwrapped, unescaped, newline });
}

const status = files.length === headerIdx.length ? 'OK' : 'MISMATCH';
console.log(`${status}: ${files.length} file blocks parsed from ${headerIdx.length} headers.`);
if (status === 'MISMATCH') {
  console.log('Do not proceed to write until this is resolved — a header failed to parse.');
}
for (const f of files) {
  const notes = [];
  if (f.unwrapped) notes.push(`${f.unwrapped} URL${f.unwrapped === 1 ? '' : 's'} unwrapped`);
  if (f.unescaped) notes.push(`${f.unescaped} escaped line${f.unescaped === 1 ? '' : 's'} restored`);
  if (f.newline) notes.push('trailing newline');
  const suffix = notes.length ? ` [${notes.join(', ')}]` : '';
  console.log(' -', f.name, `(${f.code.length} chars)${suffix}`);
}

const urlTotal = files.reduce((n, f) => n + f.unwrapped, 0);
const urlFiles = files.filter((f) => f.unwrapped).length;
const nlFiles = files.filter((f) => f.newline).length;
const escTotal = files.reduce((n, f) => n + f.unescaped, 0);
const escFiles = files.filter((f) => f.unescaped).length;
if (urlTotal || nlFiles || escTotal) {
  console.log(
    `Repaired: ${urlTotal} angle-wrapped URL(s) across ${urlFiles} file(s); ` +
      `${escTotal} escaped line(s) across ${escFiles} file(s); ` +
      `${nlFiles} file(s) given a trailing newline.`
  );
}

if (!listOnly) {
  for (const f of files) {
    const outPath = path.join(outDir, f.name);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, f.code, 'utf8');
  }
  console.log('Written to', outDir);
}
