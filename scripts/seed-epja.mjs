/**
 * Seed de los OA de EPJA (Educación de Personas Jóvenes y Adultas)
 * Fuente: Anexo 2 de las Bases Curriculares EPJA 2024 (matriz completa de OA)
 * Archivo: scripts/epja-oa.json (156 OA: Formación General + Instrumental + Diferenciada)
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/seed-epja.mjs --dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/seed-epja.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(__dirname, 'epja-oa.json'), 'utf-8'));

const SOURCE_VERSION = '2024';
const MAX_BATCH = 400;

// ID determinístico (mismo patrón que scrape-curriculum.mjs) → ingesta idempotente
function docId(subject, level, type, code) {
  return [subject, level, type, code]
    .map(part => part.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('_');
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (!dryRun && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Requiere GOOGLE_APPLICATION_CREDENTIALS para escribir en Firestore');
  process.exit(1);
}

let db = null;
if (!dryRun) {
  initializeApp();
  db = getFirestore();
}

const bySubjectLevel = new Map();
for (const r of RAW) {
  const k = `${r.subject}|${r.level}`;
  if (!bySubjectLevel.has(k)) bySubjectLevel.set(k, []);
  bySubjectLevel.get(k).push(r);
}

console.log(`EPJA — ${RAW.length} OA en ${bySubjectLevel.size} combinaciones asignatura/nivel${dryRun ? ' (DRY RUN)' : ''}\n`);

let total = 0;
for (const [k, oas] of [...bySubjectLevel.entries()].sort()) {
  const [subject, level] = k.split('|');
  const oasSorted = [...oas].sort((a, b) => parseInt(a.code.replace(/\D/g, '')) - parseInt(b.code.replace(/\D/g, '')));
  if (dryRun) {
    const first = oasSorted[0];
    console.log(`  ${subject}/${level}: ${oasSorted.length} OA (${oasSorted.map(o => o.code).join(', ')})`);
    console.log(`    ej. ${first.code}: ${first.text.slice(0, 70)}… [${first.axis}]`);
    continue;
  }

  const writes = oasSorted.map(oa => {
    const ref = db.collection('curriculum').doc(docId(subject, level, 'oa', oa.code));
    const data = {
      code: oa.code,
      text: oa.text,
      axis: oa.axis || '',
      level,
      subject,
      source: `Bases Curriculares EPJA ${SOURCE_VERSION}`,
      version: SOURCE_VERSION,
      isActive: true,
      validFrom: new Date('2024-01-01').toISOString(),
      validTo: null,
      createdAt: new Date().toISOString(),
    };
    return [ref, data];
  });

  for (let i = 0; i < writes.length; i += MAX_BATCH) {
    const batch = db.batch();
    writes.slice(i, i + MAX_BATCH).forEach(([ref, data]) => batch.set(ref, data));
    await batch.commit();
  }
  console.log(`  [OK] ${subject}/${level}: ${oasSorted.length} OA`);
  total += oasSorted.length;
}

if (!dryRun) console.log(`\nIngesta EPJA completada: ${total} OA.`);
process.exit(0);
