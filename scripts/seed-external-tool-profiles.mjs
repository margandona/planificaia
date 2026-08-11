// U11: seed de perfiles de herramientas externas a Firestore.
// Colección: external-tool-profiles -> documento {tool} (determinista → idempotente).
// Fuente única: EXTERNAL_TOOL_PROFILES en functions/logic.js (secciones 23-26).
// Uso: node scripts/seed-external-tool-profiles.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTERNAL_TOOL_PROFILES } from '../functions/logic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = process.env.FIREBASE_SA_PATH || join(__dirname, '..', 'planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json');

const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const collection = db.collection('external-tool-profiles');
let written = 0;
for (const profile of EXTERNAL_TOOL_PROFILES) {
  await collection.doc(profile.tool).set({
    ...profile,
    active: profile.active,
    updatedAt: new Date().toISOString(),
  });
  written++;
}
console.log(`Perfiles externos guardados (${written} docs en external-tool-profiles):`);
EXTERNAL_TOOL_PROFILES.forEach(p => console.log(`  ${p.tool} - ${p.name}${p.active ? '' : ' (inactivo)'}`));
