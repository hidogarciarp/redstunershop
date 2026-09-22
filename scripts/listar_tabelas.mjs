import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8');
let oldUrl = '', oldKey = '';
env.split('\n').forEach((l) => {
  const line = l.trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) oldUrl = line.split('=')[1].replace(/["']/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) oldKey = line.split('=')[1].replace(/["']/g, '').trim();
  if (!oldKey && line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) oldKey = line.split('=')[1].replace(/["']/g, '').trim();
});

const sb = createClient(oldUrl, oldKey);

function getFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.next' || item === '.git') continue;
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) getFiles(full, files);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(item)) files.push(full);
  }
  return files;
}

const files = getFiles('.');
const tableSet = new Set();
const re = /\.from\(['"]([a-zA-Z0-9_-]+)['"]\)/g;

for (const f of files) {
  const code = fs.readFileSync(f, 'utf-8');
  let m;
  while ((m = re.exec(code)) !== null) {
    tableSet.add(m[1]);
  }
}

async function check() {
  const results = [];
  for (const t of Array.from(tableSet).sort()) {
    try {
      const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        results.push({ table: t, count: 'ERRO / NÃO EXISTE', error: error.message });
      } else {
        results.push({ table: t, count });
      }
    } catch (e) {
      results.push({ table: t, count: 'FALHA' });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

check();
