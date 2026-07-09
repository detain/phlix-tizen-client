#!/usr/bin/env node
/**
 * add-copyright.mjs - Idempotent copyright-header injector for phlix-tizen-client.
 * Re-run produces zero diff when all files already have the header.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const COPYRIGHT = ' * @copyright 2026 Joe Huss <detain@interserver.net>';

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'vendor', '.git', 'coverage', '.github', 'build']);
const EXCLUDE_FILES = new Set([]);
const TS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const VUE_EXT = '.vue';

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(full, files);
    } else {
      const ext = extname(entry.name);
      const base = basename(entry.name);
      if ((TS_EXTS.has(ext) || ext === VUE_EXT) && !EXCLUDE_FILES.has(base)) {
        files.push(full);
      }
    }
  }
  return files;
}

function isShebang(line) {
  return line.startsWith('#!');
}

// Find the line index (0-based) where a TS/JS docblock ends (contains star-slash)
function findDocblockEnd(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('*/')) return i;
  }
  return -1;
}

// Inject copyright into an existing TS/JS docblock /** ... */
// Returns null if no top-level docblock OR copyright already present.
// Only considers /** at the very start of the file (after optional shebang)
// to avoid misinterpreting TypeScript type expressions like `TokenTarget & { */ }`.
function injectTsDocblock(content) {
  const lines = content.split('\n');

  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  // Only consider /** that appears at the very start of the file (after shebang)
  if (lines.length <= offset || !lines[offset].includes('/**')) return null;

  const docStart = offset;
  const docEnd = findDocblockEnd(lines, docStart);
  if (docEnd === -1) return null;

  const block = lines.slice(docStart, docEnd + 1).join('\n');
  if (block.toLowerCase().includes('detain@interserver.net')) return null;

  // Find the best insertion point: after the last non-empty, non-marker content line
  let insertAfter = docStart + 1;
  for (let i = docStart + 1; i < docEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed === '*/' || trimmed.startsWith('* @')) break;
    insertAfter = i;
  }

  const out = [...lines];
  out.splice(insertAfter + 1, 0, COPYRIGHT);
  return out.join('\n');
}

// Prepend a new TS/JS docblock at the top (after any shebang).
function prependTsDocblock(content) {
  const lines = content.split('\n');
  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  const docblock = [
    '/**',
    ' * Tizen TV client entry point and boot glue.',
    ' *',
    COPYRIGHT,
    ' */',
    '',
  ];

  return [...lines.slice(0, offset), ...docblock, ...lines.slice(offset)].join('\n');
}

function processTsFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.toLowerCase().includes('detain@interserver.net')) return null;
  return injectTsDocblock(content) ?? prependTsDocblock(content);
}

// Inject copyright into an existing Vue <script> block.
// Finds the <script> tag, then looks for a docblock inside.
function injectVueScriptDocblock(content) {
  const lines = content.split('\n');

  // Find <script> line
  let scriptStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<script')) {
      scriptStart = i;
      break;
    }
  }
  if (scriptStart === -1) return null;

  // Find the end of <script> line (may have attributes like lang="ts")
  let scriptLineEnd = scriptStart;
  for (let i = scriptStart; i < lines.length; i++) {
    if (lines[i].includes('>')) {
      scriptLineEnd = i;
      break;
    }
  }

  // Look for /** after <script> line
  let docStart = -1;
  for (let i = scriptLineEnd + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (trimmed.includes('/**')) {
      docStart = i;
      break;
    }
    // If we hit something else before finding /**, no top-level docblock
    if (!trimmed.startsWith('//') && trimmed !== '*' && !trimmed.startsWith('*')) {
      break;
    }
  }

  if (docStart === -1) return null;

  const docEnd = findDocblockEnd(lines, docStart);
  if (docEnd === -1) return null;

  const block = lines.slice(docStart, docEnd + 1).join('\n');
  if (block.toLowerCase().includes('detain@interserver.net')) return null;

  // Find the best insertion point
  let insertAfter = docStart + 1;
  for (let i = docStart + 1; i < docEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed === '*/' || trimmed.startsWith('* @')) break;
    insertAfter = i;
  }

  const out = [...lines];
  out.splice(insertAfter + 1, 0, COPYRIGHT);
  return out.join('\n');
}

// Prepend a docblock at the start of the <script> block content
function prependVueScriptDocblock(content) {
  const lines = content.split('\n');

  // Find <script> line
  let scriptStart = -1;
  let scriptLineEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<script')) {
      scriptStart = i;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('>')) {
          scriptLineEnd = j;
          break;
        }
      }
      break;
    }
  }

  if (scriptStart === -1 || scriptLineEnd === -1) return null;

  const docblock = [
    '/**',
    ' * Renderless host for spatial navigation.',
    ' *',
    COPYRIGHT,
    ' */',
    '',
  ];

  // Insert docblock right after the <script ... > line
  const out = [...lines];
  out.splice(scriptLineEnd + 1, 0, ...docblock);
  return out.join('\n');
}

function processVueFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.toLowerCase().includes('detain@interserver.net')) return null;
  return injectVueScriptDocblock(content) ?? prependVueScriptDocblock(content);
}

// ---- Main ----
const srcFiles = walk('src');

let changed = 0;
let skipped = 0;
const touched = [];

for (const file of srcFiles) {
  const ext = extname(file);
  let newContent = null;

  if (ext === VUE_EXT) {
    newContent = processVueFile(file);
  } else if (TS_EXTS.has(ext)) {
    newContent = processTsFile(file);
  }

  if (newContent !== null) {
    writeFileSync(file, newContent, 'utf8');
    changed++;
    touched.push(file);
    console.log('ADDED: ' + file);
  } else {
    skipped++;
    console.log('SKIP:  ' + file);
  }
}

console.log(`\nDone: ${changed} file(s) updated, ${skipped} skipped.`);
if (touched.length > 0) {
  console.log('\nTouched:');
  for (const f of touched) console.log('  ' + f);
}