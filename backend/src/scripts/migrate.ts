import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const root = fileURLToPath(new URL(__dirname , '..'));
const neonSql = neon(process.env.DATABASE_URL!);

// Split SQL into statements by semicolons not inside strings/comments/dollar-quoted bodies.
function splitSqlStatements(text: string): string[] {
  const out: string[] = [];
  let buf = '';

  let inSingle = false;        // inside '...'
  let inDouble = false;        // inside "..."
  let inLineComment = false;   // after --
  let inBlockComment = false;  // inside /* ... */
  let inDollarTag: string | null = null; // $$ or $tag$

  const isDollarTagChar = (c: string) =>
    (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z') ||
    (c >= '0' && c <= '9') ||
    c === '_';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1] ?? '';

    // ===== Dollar-quoted body =====
    if (inDollarTag !== null) {
      if (ch === '$') {
        const tag = inDollarTag;
        const endLen = tag.length + 2; // $ + tag + $
        const slice = text.slice(i, i + endLen);
        if (slice === `$${tag}$`) {
          buf += slice;
          i += endLen - 1;
          inDollarTag = null;
          continue;
        }
      }
      buf += ch;
      continue;
    }

    // ===== Inside single-quoted string =====
    if (inSingle) {
      if (ch === "'" && next === "'") {
        buf += "''";
        i++;
        continue;
      }
      if (ch === "'") {
        inSingle = false;
        buf += ch;
        continue;
      }
      buf += ch;
      continue;
    }

    // ===== Inside double-quoted identifier =====
    if (inDouble) {
      if (ch === '"' && next === '"') {
        buf += '""';
        i++;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
        buf += ch;
        continue;
      }
      buf += ch;
      continue;
    }

    // ===== Comments / entry into quoted sections (only when not already in one) =====
    if (!inLineComment && !inBlockComment) {
      // Enter block comment
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      // Enter line comment
      if (ch === '-' && next === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      // Enter single-quoted string
      if (ch === "'") {
        inSingle = true;
        buf += ch;
        continue;
      }
      // Enter double-quoted identifier
      if (ch === '"') {
        inDouble = true;
        buf += ch;
        continue;
      }
      // Enter dollar-quoted string: $tag$ ... $tag$ or $$ ... $$
      if (ch === '$') {
        let j = i + 1;
        while (isDollarTagChar(text[j] ?? '')) j++;
        if (text[j] === '$') {
          const tag = text.slice(i + 1, j); // may be ''
          inDollarTag = tag;
          const opener = text.slice(i, j + 1); // $tag$
          buf += opener;
          i = j;
          continue;
        }
      }
    }

    // Leave block comment
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
        continue;
      }
      continue; // swallow chars in block comment
    }

    // Leave line comment at newline
    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
        buf += ch; // keep newline if desired
      }
      continue; // swallow chars in line comment
    }

    // ===== Statement split =====
    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt.length > 0) out.push(stmt);
      buf = '';
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);

  // Remove comment-only lines from each statement then drop empties
  return out
    .map(s => s.replace(/^\s*--.*$/gm, '').replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, '').trim())
    .filter(s => s.length > 0);
}

const files = [
  '0000_extensions.sql',
  '0001_schema.sql',
  '0002_constraints.sql',
];

async function run() {
  for (const f of files) {
    const p = join(root, 'drizzle', f);
    const text = await readFile(p, 'utf8');

    console.log(`Applying ${f}...`);
    const statements = splitSqlStatements(text); // string[]

    for (const stmt of statements) {
      // const stmt = statements[i]; // stmt: string
      try {
        await neonSql(stmt); // Neon serverless: one statement per call
      } catch (e) {
        console.error(`Error in ${f}:\n${stmt}\n`);
        throw e;
      }
    }
    console.log(`OK: ${f}`);
  }
  console.log('Migrations applied.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
