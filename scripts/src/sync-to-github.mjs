/**
 * sync-to-github.mjs
 * Syncs all project source files to the configured GitHub repository.
 * Skips files that haven't changed (by comparing SHA).
 * Run via: node scripts/src/sync-to-github.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const WORKSPACE = '/home/runner/workspace';
const REPO = process.env.GITHUB_REPO || 'Munachilouisa/Cos-106-lab-assessment';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('❌  GITHUB_TOKEN secret is not set. Add it via the Secrets panel.');
  process.exit(1);
}

const HEADERS = {
  'Authorization': `token ${TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'replit-sync-script'
};

/** Paths to exclude from syncing */
function shouldExclude(rel) {
  return (
    rel.startsWith('.git/') || rel === '.git' ||
    rel.includes('/node_modules/') || rel.startsWith('node_modules/') ||
    rel.endsWith('.tsbuildinfo') ||
    rel === 'pnpm-lock.yaml' ||
    rel.startsWith('.local/') ||
    rel.startsWith('.agents/') ||
    rel.startsWith('.cache/') ||
    rel.startsWith('artifacts/api-server/dist/') ||
    rel.startsWith('artifacts/mockup-sandbox/dist/')
  );
}

function getAllFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (shouldExclude(rel)) continue;
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(full, base));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/** Compute git-compatible blob SHA for a buffer */
function gitBlobSha(buf) {
  const header = Buffer.from(`blob ${buf.length}\0`);
  const combined = Buffer.concat([header, buf]);
  return crypto.createHash('sha1').update(combined).digest('hex');
}

async function getExistingFile(filePath) {
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  return res.json();
}

async function uploadFile(filePath, existing) {
  const fullPath = path.join(WORKSPACE, filePath);
  const content = fs.readFileSync(fullPath);
  const base64 = content.toString('base64');

  const localSha = gitBlobSha(content);
  if (existing && existing.sha === localSha) {
    return 'unchanged';
  }

  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}`;
  const body = {
    message: existing ? `Update ${filePath}` : `Add ${filePath}`,
    content: base64,
    branch: BRANCH,
    ...(existing ? { sha: existing.sha } : {})
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const j = await res.json();
    console.error(`  ❌  FAILED ${filePath}: ${j.message}`);
    return 'failed';
  }
  return existing ? 'updated' : 'added';
}

async function deleteFile(filePath, sha) {
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: HEADERS,
    body: JSON.stringify({ message: `Remove ${filePath}`, sha, branch: BRANCH })
  });
  return res.ok;
}

async function getRepoTree() {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map();
  for (const item of (data.tree || [])) {
    if (item.type === 'blob') map.set(item.path, item.sha);
  }
  return map;
}

async function main() {
  console.log(`\n🔄  Syncing to GitHub: ${REPO} (${BRANCH})\n`);

  // Load repo state once
  console.log('  Fetching repo tree...');
  const repoTree = await getRepoTree();
  console.log(`  Remote has ${repoTree.size} files\n`);

  const localFiles = new Set(getAllFiles(WORKSPACE));
  console.log(`  Local has ${localFiles.size} files to consider\n`);

  let added = 0, updated = 0, unchanged = 0, failed = 0;

  for (const filePath of localFiles) {
    const remoteSha = repoTree.get(filePath);
    const fullPath = path.join(WORKSPACE, filePath);
    const content = fs.readFileSync(fullPath);
    const localSha = gitBlobSha(content);

    // Skip if unchanged
    if (remoteSha && remoteSha === localSha) {
      unchanged++;
      continue;
    }

    const existing = remoteSha ? { sha: remoteSha } : null;
    const result = await uploadFile(filePath, existing);

    if (result === 'added') { console.log(`  ✅  Added:   ${filePath}`); added++; }
    else if (result === 'updated') { console.log(`  📝  Updated: ${filePath}`); updated++; }
    else if (result === 'unchanged') { unchanged++; }
    else { failed++; }

    // Small delay to stay within GitHub rate limits
    await new Promise(r => setTimeout(r, 80));
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`  ✅  Added:     ${added}`);
  console.log(`  📝  Updated:   ${updated}`);
  console.log(`  ⏭️   Unchanged: ${unchanged}`);
  if (failed > 0) console.log(`  ❌  Failed:    ${failed}`);
  console.log(`\n  🔗  https://github.com/${REPO}`);
  console.log('─────────────────────────────────────────\n');

  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
