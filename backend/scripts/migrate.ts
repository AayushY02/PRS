import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const root = fileURLToPath(new URL('..', import.meta.url));
const sql = neon(process.env.DATABASE_URL!);

// Split SQL into statements by semicolons not inside strings or comments.
function splitSqlStatements(text: string): string[] {
  const out: string[] = [];
  let buf = '';

  let inSingle = false;       // inside '...'
  let inLineComment = false;  // after --
  let inBlockComment = false; // inside /* ... */

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    // Handle entering/leaving comments, but only if we're not inside a string
    if (!inSingle) {
      // enter block comment
      if (!inLineComment && !inBlockComment && ch === '/' && next === '*') {
        inBlockComment = true;
        i++; // consume '*'
        continue;
      }
      // leave block comment
      if (inBlockComment && ch === '*' && next === '/') {
        inBlockComment = false;
        i++; // consume '/'
        continue;
      }
      // enter line comment
      if (!inBlockComment && !inLineComment && ch === '-' && next === '-') {
        inLineComment = true;
        i++; // consume second '-'
        continue;
      }
      // end line comment at newline
      if (inLineComment && (ch === '\n' || ch === '\r')) {
        inLineComment = false;
        // keep the newline (not necessary)
        buf += ch;
        continue;
      }
      // while in any comment, skip chars
      if (inLineComment || inBlockComment) {
        continue;
      }
    }

    // Handle strings (single quotes) with '' escape
    if (!inLineComment && !inBlockComment) {
      if (ch === "'") {
        if (inSingle && next === "'") {
          // escaped quote inside string => keep both quotes
          buf += "''";
          i++;
          continue;
        }
        inSingle = !inSingle;
        buf += ch;
        continue;
      }
    }

    // Split on semicolon only if not inside string or comments
    if (ch === ';' && !inSingle && !inLineComment && !inBlockComment) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);

  // Remove pure comment statements / empties
  return out
    .map(s => s.replace(/^\s*--.*$/gm, '').trim())
    .filter((s): s is string => s.length > 0);
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
    const statements = splitSqlStatements(text);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await sql(stmt); // Neon serverless: one statement per call
      } catch (e) {
        console.error(`Error in ${f} [${i + 1}/${statements.length}]:\n${stmt}\n`);
        throw e;
      }
    }
    console.log(`OK: ${f}`);
  }
  console.log('Migrations applied.');
}

run().catch((e) => { console.error(e); process.exit(1); });
