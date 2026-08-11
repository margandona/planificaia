// U17: seed de config/feature-flags (doc único, admin-write) para despliegue gradual.
// Escribe un doc idempotente con los flags apagados por defecto y permite activar
// cada flag, con rollout porcentual (0-100) y allowlist de pilotos.
// Fuente única de los defaults: FEATURE_FLAGS en functions/logic.js.
// Uso:
//   node scripts/seed-feature-flags.mjs
//   node scripts/seed-feature-flags.mjs --methodologyRecommendationsEnabled
//   node scripts/seed-feature-flags.mjs --gamificationModuleEnabled --rollout gamificationModuleEnabled=25
//   node scripts/seed-feature-flags.mjs --externalPromptGeneratorEnabled --allow externalPromptGeneratorEnabled=uid1,uid2
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_FLAGS } from '../functions/logic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = process.env.FIREBASE_SA_PATH || join(__dirname, '..', 'planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json');

const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const args = process.argv.slice(2);
const flags = { ...FEATURE_FLAGS };
const rollout = {};
const allowlist = {};

for (const arg of args) {
  if (arg.startsWith('--rollout')) {
    const eq = arg.indexOf('=');
    const spec = arg.slice('--rollout'.length + 1).replace(/^=/, '');
    const [key, pctRaw] = spec.split('=');
    if (key in flags) {
      const pct = Number(pctRaw);
      if (Number.isFinite(pct) && pct >= 0 && pct <= 100) rollout[key] = pct;
    }
    continue;
  }
  if (arg.startsWith('--allow')) {
    const spec = arg.slice('--allow'.length + 1).replace(/^=/, '');
    const eq = spec.indexOf('=');
    const key = eq >= 0 ? spec.slice(0, eq) : spec;
    const list = eq >= 0 ? spec.slice(eq + 1) : '';
    if (key in flags && list) allowlist[key] = list.split(',').map(s => s.trim()).filter(Boolean);
    continue;
  }
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    if (key in flags) flags[key] = true;
  }
}

const docData = { ...flags };
if (Object.keys(rollout).length) docData.rollout = rollout;
if (Object.keys(allowlist).length) docData.allowlist = allowlist;
docData.updatedAt = new Date().toISOString();

await db.collection('config').doc('feature-flags').set(docData);
console.log('config/feature-flags actualizado:');
console.log(JSON.stringify(docData, null, 2));
