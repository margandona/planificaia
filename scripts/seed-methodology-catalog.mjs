// U2: seed del catálogo metodológico (17 + PVISIBLE) a Firestore.
// Colección: methodology-catalog -> documento {code} (determinista → idempotente).
// Fuente única: METHODOLOGY_CATALOG en functions/logic.js (sección 13 del plan).
// Uso: node scripts/seed-methodology-catalog.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METHODOLOGY_CATALOG } from '../functions/logic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = process.env.FIREBASE_SA_PATH || join(__dirname, '..', 'planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json');

const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const collection = db.collection('methodology-catalog');
let written = 0;
for (const method of METHODOLOGY_CATALOG) {
  await collection.doc(method.code).set({
    ...method,
    active: true,
    updatedAt: new Date().toISOString(),
  });
  written++;
}
console.log(`Catálogo metodológico guardado (${written} docs en methodology-catalog):`);
METHODOLOGY_CATALOG.forEach(m => console.log(`  ${m.code} - ${m.name}${m.legacyKeys.length ? ` (legacy: ${m.legacyKeys.join(', ')})` : ''}`));
