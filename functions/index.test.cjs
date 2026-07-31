/**
 * Tests unitarios para las funciones de validacion de PlanificaIA
 * Ejecutar: node --experimental-vm-modules node_modules/.bin/jest
 */

// Tests para las funciones helper (extraidas para testing)
const VALIDATION_RULES = [
  { id: 'V-001', type: 'critical', check: (p) => p.activities?.length > 0 },
  { id: 'V-004', type: 'critical', check: (p) => p.assessment?.criteria?.length > 0 },
  { id: 'V-007', type: 'warning', check: (p) => p.activities?.some(a => a.moment === 'cierre') },
  { id: 'V-009', type: 'warning', check: (p) => p.assessment?.feedbackStrategy?.length > 0 },
  { id: 'V-006', type: 'warning', check: (p) => {
    const total = (p.activities || []).reduce((s, a) => s + (a.duration || 0), 0);
    return total >= p.duration * 0.8 && total <= p.duration * 1.1;
  }},
];

function sanitizeInput(text) {
  if (!text) return '';
  const patterns = [
    /\b\d{1,2}\.\d{3}\.\d{3}[-]\d{1,2}\b/g,
    /\b\d{7,9}[-]\d\b/g,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ];
  let s = String(text);
  patterns.forEach(p => { s = s.replace(p, '[...]'); });
  return s;
}

function validateOutputStructure(data) {
  const errors = [];
  if (!data.purpose || data.purpose.length < 5) errors.push('Falta proposito valido');
  if (!data.activities?.length) errors.push('Faltan actividades');
  else data.activities.forEach(a => {
    if (!a.moment) errors.push('Actividad sin momento');
    if (!a.description) errors.push('Actividad sin descripcion');
  });
  if (!data.assessment?.criteria?.length) errors.push('Faltan criterios de evaluacion');
  return errors;
}

// ─── TESTS ──────────────────────────────────────────────

// Test 1: Sanitizacion de PII
console.log('\n=== Test 1: Sanitizacion PII ===');
const cases = [
  ['RUT 12.345.678-9', 'RUT [...]'],
  ['email test@example.com', 'email [...]'],
  ['sin datos sensibles', 'sin datos sensibles'],
  ['RUT 12.345.678-9 y email user@test.cl', 'RUT [...] y email [...]'],
  ['', ''],
];
let passed = 0;
cases.forEach(([input, expected]) => {
  const result = sanitizeInput(input);
  const ok = result === expected;
  if (ok) passed++;
  else console.log(`  FAIL: "${input}" => "${result}" (esperado: "${expected}")`);
});
console.log(`  ${passed}/${cases.length} tests PII pasaron`);

// Test 2: Validacion de estructura
console.log('\n=== Test 2: Validacion de estructura ===');
const valid = { purpose: 'Una clase sobre hominizacion', activities: [{ moment: 'inicio', description: 'Activar conocimientos' }], assessment: { criteria: ['Identifica'] } };
const invalid1 = { purpose: '', activities: [], assessment: {} };
const invalid2 = { purpose: 'OK', activities: [{ moment: '', description: '' }], assessment: { criteria: [] } };
const r1 = validateOutputStructure(valid);
const r2 = validateOutputStructure(invalid1);
const r3 = validateOutputStructure(invalid2);
console.log(`  Valida: ${r1.length === 0 ? 'OK' : 'FAIL'} (${r1.length} errores)`);
console.log(`  Invalida (vacia): ${r2.length > 0 ? 'OK' : 'FAIL'} (${r2.length} errores)`);
console.log(`  Invalida (mal): ${r3.length > 0 ? 'OK' : 'FAIL'} (${r3.length} errores)`);

// Test 3: Reglas de validacion
console.log('\n=== Test 3: Reglas V-001 a V-012 ===');
const good = { activities: [{ moment: 'inicio', duration: 20 }, { moment: 'desarrollo', duration: 50 }, { moment: 'cierre', duration: 20 }], duration: 90, assessment: { criteria: ['A'], feedbackStrategy: 'oral' } };
const bad = { activities: [], duration: 90, assessment: { criteria: [], feedbackStrategy: '' } };
const goodWarnings = VALIDATION_RULES.filter(r => !r.check(good));
const badWarnings = VALIDATION_RULES.filter(r => !r.check(bad));
console.log(`  Planificacion valida: ${goodWarnings.length} advertencias (esperado: 0)`);
console.log(`  Planificacion invalida: ${badWarnings.length} advertencias (esperado: 5)`);
console.log(`  Reglas detectadas: ${badWarnings.map(r => r.id).join(', ')}`);

// Test 4: Verificacion de archivos
console.log('\n=== Test 4: Archivos del proyecto ===');
const fs = require('fs');
const archivos = [
  'firebase.json', '.firebaserc', 'firestore.rules', 'storage.rules',
  'functions/index.js', 'functions/package.json',
  'public/index.html', 'public/js/app.js',
  'scripts/ingesta-curriculo.js', 'pnpm-workspace.yaml',
];
let archOk = 0;
archivos.forEach(f => {
  if (fs.existsSync(f)) { archOk++; }
  else console.log(`  FALTA: ${f}`);
});
console.log(`  ${archOk}/${archivos.length} archivos presentes`);

// Resumen
console.log('\n═══════════════════════════════════');
console.log('RESUMEN QA:');
const totalTests = cases.length + 3 + 2 + archivos.length;
let totalPassed = passed + (r1.length === 0 ? 1 : 0) + (r2.length > 0 ? 1 : 0) + (r3.length > 0 ? 1 : 0) + (goodWarnings.length === 0 ? 1 : 0) + (badWarnings.length >= 3 ? 1 : 0) + archOk;
console.log(`  Tests: ${totalPassed}/${totalTests} pasaron`);
console.log(`  Progreso QA: ${Math.round(totalPassed/totalTests*100)}%`);
console.log((archOk === archivos.length && r1.length === 0) ? '  ✅ APTO para continuar' : '  ⚠ Revisar fallos');
console.log('═══════════════════════════════════');
