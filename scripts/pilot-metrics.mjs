/**
 * Métricas del piloto docente — KPIs desde Firestore
 *
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=... node scripts/pilot-metrics.mjs [--days 30]
 *
 * Mide los KPIs de la Fase 17:
 *   - Uso: planificaciones, generaciones, usuarios activos
 *   - Tasa de aprobación docente
 *   - Tiempo de generación (promedio/p95)
 *   - Costo IA por día
 *   - Advertencias más frecuentes (V-001 a V-012)
 *   - Cobertura por nivel y asignatura
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const days = parseInt(process.argv.find(a => a.startsWith('--days'))?.split('=')[1] || process.argv[process.argv.indexOf('--days') + 1], 10) || 30;
const since = new Date();
since.setDate(since.getDate() - days);
const sinceISO = since.toISOString();

console.log(`\n===========================================`);
console.log(`  PlanificaIA — Métricas del piloto`);
console.log(`  Período: últimos ${days} días (desde ${since.toISOString().split('T')[0]})`);
console.log('===========================================\n');

// 1. Planificaciones por estado
const plansSnap = await db.collection('plannings').get();
const byStatus = {};
let totalPlans = 0;
for (const d of plansSnap.docs) {
  const p = d.data();
  if (p.createdAt && new Date(p.createdAt) < since) continue;
  const st = p.status || 'draft';
  byStatus[st] = (byStatus[st] || 0) + 1;
  totalPlans++;
}
console.log('1) PLANIFICACIONES (período)');
console.log(`   Total: ${totalPlans}`);
for (const [k, v] of Object.entries(byStatus)) console.log(`   ${k}: ${v}`);
const approved = byStatus.approved || 0;
const approvable = (byStatus.draft || 0) + approved + (byStatus.archived || 0);
console.log(`   Tasa de aprobación: ${approvable ? Math.round((approved / approvable) * 100) : 0}%`);

// 2. Generaciones IA y costo
const costSnap = await db.collection('ai-costs').get();
let totalGen = 0, totalCost = 0, genWithTokens = 0;
const costByDay = {};
const providerCount = {};
let totalMs = 0, msCount = 0;
const msArr = [];
for (const d of costSnap.docs) {
  const c = d.data();
  if (c.createdAt && new Date(c.createdAt) < since) continue;
  totalGen++;
  totalCost += c.cost || 0;
  const day = (c.date || c.createdAt || '').slice(0, 10);
  costByDay[day] = (costByDay[day] || 0) + 1;
  providerCount[c.provider || '?'] = (providerCount[c.provider || '?'] || 0) + 1;
}
console.log('\n2) GENERACIONES IA');
console.log(`   Total: ${totalGen}`);
console.log(`   Costo total estimado: $${totalCost.toFixed(4)} USD`);
console.log(`   Costo promedio por generación: $${totalGen ? (totalCost / totalGen).toFixed(5) : 0} USD`);
console.log(`   Proveedores: ${Object.entries(providerCount).map(([k, v]) => `${k} (${v})`).join(', ')}`);

// 3. Tiempo de generación (desde audit-logs)
const auditSnap = await db.collection('audit-logs').get();
let genCount = 0;
for (const d of auditSnap.docs) {
  const a = d.data();
  if (a.action !== 'generate' || !a.durationMs) continue;
  if (a.createdAt && new Date(a.createdAt) < since) continue;
  msArr.push(a.durationMs);
  totalMs += a.durationMs;
  msCount++;
}
if (msCount) {
  const avg = totalMs / msCount;
  const sorted = [...msArr].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  console.log('\n3) TIEMPO DE GENERACIÓN');
  console.log(`   Promedio: ${(avg / 1000).toFixed(1)}s (n=${msCount})`);
  console.log(`   p95: ${(p95 / 1000).toFixed(1)}s`);
}

// 4. Cobertura por nivel/asignatura (plannings)
const byLevelSubj = {};
for (const d of plansSnap.docs) {
  const p = d.data();
  if (p.createdAt && new Date(p.createdAt) < since) continue;
  const key = `${p.level || '?'} / ${p.subject || '?'}`;
  byLevelSubj[key] = (byLevelSubj[key] || 0) + 1;
}
console.log('\n4) COBERTURA (nivel / asignatura)');
Object.entries(byLevelSubj).sort().forEach(([k, v]) => console.log(`   ${k}: ${v}`));

// 5. Advertencias más frecuentes
const warnCount = {};
for (const d of plansSnap.docs) {
  const p = d.data();
  if (p.createdAt && new Date(p.createdAt) < since) continue;
  (p.warnings || []).forEach(w => {
    const key = `${w.ruleId || w.rule || '?'} [${w.type || '?'}]`;
    warnCount[key] = (warnCount[key] || 0) + 1;
  });
}
console.log('\n5) ADVERTENCIAS PEDAGÓGICAS MÁS FRECUENTES');
Object.entries(warnCount).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`   ${v}x  ${k}`));

// 6. Feedback del piloto
const fbSnap = await db.collection('feedback').get();
if (!fbSnap.empty) {
  let fbCount = 0; const ratings = { quality: [], pedagogic: [], ease: [], rating: [] };
  for (const d of fbSnap.docs) {
    const f = d.data();
    if (f.createdAt && new Date(f.createdAt) < since) continue;
    fbCount++;
    ['quality', 'pedagogic', 'ease', 'rating'].forEach(k => { if (f[k]) ratings[k].push(f[k]); });
  }
  console.log('\n6) FEEDBACK DOCENTE');
  console.log(`   Respuestas: ${fbCount}`);
  for (const [k, arr] of Object.entries(ratings)) {
    if (arr.length) console.log(`   ${k}: promedio ${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)}/5 (n=${arr.length})`);
  }
}

// 7. Adopción de módulos nuevos (U6-U13): gamificación y prompts externos
const gamSnap = await db.collection('gamified-experiences').get();
let gamCount = 0; const gamByStatus = {};
for (const d of gamSnap.docs) {
  const g = d.data();
  if (g.createdAt && new Date(g.createdAt) < since) continue;
  gamCount++;
  gamByStatus[g.status || 'draft'] = (gamByStatus[g.status || 'draft'] || 0) + 1;
}
let gamParticipants = 0;
try {
  const partsSnap = await db.collectionGroup('participants').get();
  for (const d of partsSnap.docs) {
    const p = d.data();
    if (p.joinedAt && new Date(p.joinedAt) < since) continue;
    if (p.status === 'active') gamParticipants++;
  }
} catch (e) { /* collectionGroup sin índice: se reporta 0 */ }
let gamEvidences = 0;
try {
  const evSnap = await db.collectionGroup('evidence').get();
  gamEvidences = evSnap.docs.length;
} catch (e) { /* collectionGroup sin índice */ }
const badgeSnap = await db.collection('badge-awards').get();
let gamBadges = 0;
for (const d of badgeSnap.docs) {
  const b = d.data();
  if (b.earnedAt && new Date(b.earnedAt) < since) continue;
  gamBadges++;
}
console.log('\n7) ADOPCIÓN MÓDULOS NUEVOS (U6-U13)');
console.log(`   Experiencias gamificadas: ${gamCount}`);
for (const [k, v] of Object.entries(gamByStatus)) console.log(`     ${k}: ${v}`);
console.log(`   Participantes activos (collectionGroup): ${gamParticipants}`);
console.log(`   Evidencias enviadas (collectionGroup): ${gamEvidences}`);
console.log(`   Insignias otorgadas: ${gamBadges}`);

const extSnap = await db.collection('external-prompts').get();
let extCount = 0; const extByTool = {};
for (const d of extSnap.docs) {
  const e = d.data();
  if (e.createdAt && new Date(e.createdAt) < since) continue;
  extCount++;
  extByTool[e.tool || 'generic'] = (extByTool[e.tool || 'generic'] || 0) + 1;
}
console.log(`   Prompts externos generados: ${extCount}`);
for (const [k, v] of Object.entries(extByTool)) console.log(`     ${k}: ${v}`);

console.log('\n===========================================\n');
process.exit(0);
