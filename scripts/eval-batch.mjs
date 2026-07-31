// Evaluación por batch (S-4): corre la rúbrica de calidad sobre el dataset
// (scripts/eval-dataset.mjs) y emite un reporte. Replica las reglas V-001..V-016
// y evaluateQuality de functions/index.js porque ese módulo llama initializeApp().
//
// Uso: node scripts/eval-batch.mjs
// Salidas: reports/eval-report-<ts>.json y reports/eval-report-<ts>.md
import { dataset } from './eval-dataset.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Reglas de validación (duplicado de functions/index.js) ───

const METHODOLOGY_KEYWORDS = {
  'abp': ['proyecto', 'problema', 'investiga', 'indag'],
  'proyecto': ['proyecto', 'investiga', 'planifica', 'elabora'],
  'cooperativ': ['equipo', 'grupo', 'cooper', 'colabor'],
  'taller': ['taller', 'manipul', 'construye', 'elabora'],
  'laboratorio': ['laboratorio', 'experimenta', 'observa', 'experien'],
  'juego': ['juego', 'jug', 'dinamica'],
  'expositiv': ['expone', 'presenta', 'explic'],
  'montessori': ['material', 'montessori', 'autonomia', 'manipul'],
};

const VALIDATION_RULES = [
  { id: 'V-001', type: 'critical', check: (p) => p.type === 'evaluation' ? (p.evaluation?.indicators?.length > 0) : (p.activities?.length > 0) },
  { id: 'V-004', type: 'critical', check: (p) => p.type === 'evaluation' ? (p.evaluation?.criteria?.length > 0) : (p.assessment?.criteria?.length > 0) },
  { id: 'V-007', type: 'warning', check: (p) => {
    if (p.type === 'unit') return p.unit?.classes?.length > 0 && p.unit.classes.some(c => c.activities?.some(a => a.moment === 'cierre'));
    if (p.type === 'monthly') return p.unit?.weeks?.length > 0;
    if (p.type === 'annual') return p.unit?.months?.length > 0;
    if (p.type === 'evaluation') return (p.evaluation?.rubric?.length > 0) || (p.evaluation?.instrument?.length > 0);
    return p.activities?.some(a => a.moment === 'cierre');
  }},
  { id: 'V-009', type: 'warning', check: (p) => p.type === 'evaluation' ? (p.evaluation?.feedbackStrategy?.length > 0) : (p.assessment?.feedbackStrategy?.length > 0) },
  { id: 'V-006', type: 'warning', check: (p) => {
    if (p.type === 'unit') {
      const first = p.unit?.classes?.[0];
      if (!first) return true;
      const total = (first.activities || []).reduce((s, a) => s + (a.duration || 0), 0);
      return total >= first.duration * 0.8 && total <= first.duration * 1.1;
    }
    if (p.type === 'monthly') {
      const weeks = p.unit?.weeks || [];
      if (weeks.length === 0) return true;
      return weeks.every(w => {
        const total = (w.activities || []).reduce((s, a) => s + (a.duration || 0), 0);
        return w.duration ? (total >= w.duration * 0.6 && total <= w.duration * 1.1) : true;
      });
    }
    if (p.type === 'evaluation') return true;
    const total = (p.activities || []).reduce((s, a) => s + (a.duration || 0), 0);
    return total >= p.duration * 0.8 && total <= p.duration * 1.1;
  }},
  { id: 'V-013', type: 'warning', check: (p) => {
    if (!p.methodology || p.type === 'evaluation') return true;
    const method = String(p.methodology).toLowerCase();
    const family = Object.keys(METHODOLOGY_KEYWORDS).find(k => method.includes(k));
    if (!family) return true;
    const text = [
      ...(p.activities || []).map(a => `${a.description || ''} ${a.title || ''}`),
      ...(p.unit?.classes || []).map(c => `${c.title || ''} ${c.purpose || ''}`),
      ...(p.unit?.weeks || []).map(w => `${w.topic || ''}`),
      p.purpose || '',
    ].join(' ').toLowerCase();
    return METHODOLOGY_KEYWORDS[family].some(kw => text.includes(kw));
  }},
  { id: 'V-014', type: 'warning', check: (p) => {
    if (p.type === 'evaluation') return true;
    if (!p.barriers || !String(p.barriers).trim()) return true;
    const hasDiff = String(p.differentiation || '').trim().length >= 15;
    const hasDua = !!p.dua && ['representacion', 'accionExpresion', 'implicacion'].some(k => (p.dua[k] || []).length > 0);
    return hasDiff || hasDua;
  }},
  { id: 'V-015', type: 'warning', check: (p) => {
    if (p.type === 'unit') return p.unit?.classes?.every(c => {
      const ms = new Set((c.activities || []).map(a => a.moment));
      return ms.has('inicio') && ms.has('desarrollo') && ms.has('cierre');
    });
    if (p.type === 'monthly' || p.type === 'annual' || p.type === 'evaluation') return true;
    const ms = new Set((p.activities || []).map(a => a.moment));
    return ms.has('inicio') && ms.has('desarrollo') && ms.has('cierre');
  }},
  { id: 'V-016', type: 'warning', check: (p) => {
    if (p.type === 'annual' || p.type === 'evaluation') return true;
    const acts = p.type === 'unit' ? (p.unit?.classes || []).flatMap(c => c.activities || [])
      : p.type === 'monthly' ? (p.unit?.weeks || []).flatMap(w => w.activities || [])
      : (p.activities || []);
    if (!acts.length) return true;
    return acts.every(a => String(a.description || '').trim().length >= 40);
  }},
];

function getRuleDescription(id) {
  const descriptions = {
    'V-001': 'No hay actividades definidas',
    'V-004': 'La evaluación no tiene criterios',
    'V-007': 'No hay actividad de cierre',
    'V-009': 'No hay estrategia de retroalimentación',
    'V-006': 'Duración de actividades no coincide',
    'V-013': 'Las actividades no reflejan la metodología declarada',
    'V-014': 'Barreras sin alternativas (diferenciación o DUA)',
    'V-015': 'Faltan momentos de inicio o desarrollo',
    'V-016': 'Descripciones de actividades demasiado breves',
  };
  return descriptions[id] || 'Desconocida';
}

function runPedagogicalAudit(planning) {
  return VALIDATION_RULES
    .filter(rule => !rule.check(planning))
    .map(rule => ({ type: rule.type, ruleId: rule.id, description: getRuleDescription(rule.id) }));
}

// ─── Rúbrica de calidad (duplicado de functions/index.js) ───

const QUALITY_CRITERIA = {
  curricular: { label: 'Alineación curricular', weight: 0.25 },
  pedagogica: { label: 'Precisión pedagógica', weight: 0.15 },
  coherencia: { label: 'Coherencia', weight: 0.15 },
  factibilidad: { label: 'Factibilidad', weight: 0.10 },
  edad: { label: 'Adecuación etaria', weight: 0.10 },
  inclusion: { label: 'Inclusión', weight: 0.10 },
  evaluacion: { label: 'Evaluación', weight: 0.05 },
  seguridad: { label: 'Seguridad', weight: 0.05 },
};

function collectPlanningText(planning) {
  const parts = [
    planning.purpose,
    planning.differentiation,
    planning.methodology,
    ...(planning.activities || []).map(a => `${a.title || ''} ${a.description || ''}`),
    ...(planning.unit?.classes || []).map(c => `${c.purpose || ''} ${(c.activities || []).map(a => `${a.title || ''} ${a.description || ''}`).join(' ')}`),
    ...(planning.unit?.weeks || []).map(w => `${w.topic || ''} ${(w.activities || []).map(a => `${a.title || ''} ${a.description || ''}`).join(' ')}`),
    planning.assessment ? (planning.assessment.criteria || []).join(' ') + ' ' + (planning.assessment.feedbackStrategy || '') : '',
  ];
  return parts.filter(Boolean).join(' \n');
}

function hasPII(text) {
  if (!text) return false;
  const patterns = [
    /\b\d{1,2}\.\d{3}\.\d{3}[-]\d{1,2}\b/g,
    /\b\d{7,9}[-]\d\b/g,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ];
  return patterns.some(p => p.test(String(text)));
}

function scoreCriterion(base, deductions = []) {
  let s = base;
  for (const d of deductions) s -= d;
  return Math.max(0, Math.min(5, Math.round(s * 100) / 100));
}

function evaluateQuality(planning) {
  const audit = runPedagogicalAudit(planning);
  const warnIds = new Set(audit.filter(w => w.type === 'warning').map(w => w.ruleId));
  const critIds = new Set(audit.filter(w => w.type === 'critical').map(w => w.ruleId));
  const text = collectPlanningText(planning);
  const activities = planning.activities || [];
  const classes = planning.unit?.classes || [];

  let curricular = 5;
  if (!planning.learningObjectives?.length) curricular = scoreCriterion(2);
  else if (planning.learningObjectives.length === 1) curricular = scoreCriterion(4);
  if (critIds.has('V-004') && planning.type === 'evaluation') curricular = scoreCriterion(curricular, [1.5]);
  if (critIds.has('V-001')) curricular = scoreCriterion(curricular, [1.5]);

  let pedagogica = 5;
  if (warnIds.has('V-015')) pedagogica = scoreCriterion(pedagogica, [1.5]);
  if (warnIds.has('V-016')) pedagogica = scoreCriterion(pedagogica, [1.5]);
  if (warnIds.has('V-007')) pedagogica = scoreCriterion(pedagogica, [1]);
  if (critIds.has('V-001')) pedagogica = scoreCriterion(pedagogica, [2]);

  let coherencia = 5;
  if (warnIds.has('V-013')) coherencia = scoreCriterion(coherencia, [2]);
  if (!planning.purpose || planning.purpose.trim().length < 10) coherencia = scoreCriterion(coherencia, [1.5]);

  let factibilidad = 5;
  if (warnIds.has('V-006')) factibilidad = scoreCriterion(factibilidad, [2]);
  if (!planning.resources?.length && (planning.type === 'class' || planning.type === 'multigrade')) factibilidad = scoreCriterion(factibilidad, [0.5]);

  let edad = 5;
  if (!planning.level && !planning.levels?.length) edad = scoreCriterion(edad, [1.5]);
  if (planning.type === 'multigrade') {
    const hasTarget = (activities.length > 0 && activities.every(a => a.targetLevel)) || classes.length > 0;
    if (!hasTarget) edad = scoreCriterion(edad, [1]);
  }

  let inclusion = 5;
  if (warnIds.has('V-014')) inclusion = scoreCriterion(inclusion, [2.5]);
  if (!planning.differentiation?.trim() && !planning.dua) inclusion = scoreCriterion(inclusion, [1]);
  else if (planning.dua && !(planning.dua.representacion?.length || planning.dua.accionExpresion?.length || planning.dua.implicacion?.length)) inclusion = scoreCriterion(inclusion, [0.5]);

  let evaluacion = 5;
  if (critIds.has('V-004') || warnIds.has('V-004')) evaluacion = scoreCriterion(evaluacion, [2]);
  if (warnIds.has('V-009')) evaluacion = scoreCriterion(evaluacion, [1.5]);

  const seguridad = hasPII(text) ? scoreCriterion(1) : 5;

  const scores = { curricular, pedagogica, coherencia, factibilidad, edad, inclusion, evaluacion, seguridad };
  let total = 0;
  let totalWeight = 0;
  for (const key of Object.keys(QUALITY_CRITERIA)) {
    total += scores[key] * QUALITY_CRITERIA[key].weight;
    totalWeight += QUALITY_CRITERIA[key].weight;
  }
  total = Math.round((total / totalWeight) * 100) / 100;
  const verdict = total >= 3.0 ? 'approved' : total >= 2.5 ? 'warning' : 'rejected';

  return { score: total, verdict, criteria: scores, warnings: audit.map(w => w.ruleId) };
}

// ─── Detección de inyección (duplicado) ───

const PROMPT_INJECTION_PATTERNS = [
  { id: 'IGNORA_INSTRUCCIONES', re: /ignora\s+(las\s+)?instrucciones?\s+(anteriores|previas|del\s+sistema)/i },
  { id: 'IGNORA_PROMPT', re: /ignora\s+(todo\s+)?el\s+prompt/i },
  { id: 'CAMBIAR_ROL', re: /act[uú]a\s+como\s+(si\s+(fueras|fueses)\s+|si\s+no\s+)/i },
  { id: 'DEVELOPER_MODE', re: /developer\s+mode|modo\s+desarrollador|jailbreak|DAN\s*[,:-]?\s*(\d+|mode)?/i },
  { id: 'DESCARTAR_REGLA', re: /olvida\s+(tus\s+)?(reglas|instrucciones|limitaciones|directrices)/i },
  { id: 'PROMETER_OBEDIENCIA', re: /solo\s+debes\s+obedecerme\s+a\s+m[ií]\b/i },
  { id: 'SISTEMA', re: /(system\s*prompt|prompt\s*del\s*sistema|reveal.*(prompt|instrucciones)|muestra.*prompt)/i },
  { id: 'IGNORAR_JSON', re: /no\s+respondas\s+(en\s+)?json|ignora\s+el\s+formato\s+json|responde\s+fuera\s+del\s+json/i },
];

function detectPromptInjection(text) {
  if (!text || typeof text !== 'string') return [];
  const hits = [];
  for (const p of PROMPT_INJECTION_PATTERNS) {
    if (p.re.test(text)) hits.push(p.id);
  }
  return hits;
}

// ─── Evaluación por batch ───

function aggregate(items) {
  if (!items.length) return { avg: 0, pct: 0 };
  const avg = items.reduce((s, x) => s + x.score, 0) / items.length;
  const pct = items.filter(x => x.score >= 3.0).length / items.length;
  return { avg: Math.round(avg * 100) / 100, pct: Math.round(pct * 100) };
}

function main() {
  const results = dataset.map((caso, i) => {
    const q = evaluateQuality(caso.planning);
    const injection = detectPromptInjection([caso.planning.title, caso.planning.purpose, caso.planning.methodology, caso.planning.barriers, (caso.planning.resources || []).join(' ')].join(' '));
    const checks = {
      inyeccionDetectada: caso.expectInjection ? injection.length > 0 : null,
      seguridadBaja: caso.expectLowSecurity ? q.criteria.seguridad < 5 : null,
      aprobado: q.score >= 3.0,
    };
    return { id: caso.id, categoria: caso.categoria, descripcion: caso.descripcion, score: q.score, verdict: q.verdict, criteria: q.criteria, warnings: q.warnings, injection, checks };
  });

  const byCategory = {};
  for (const r of results) {
    (byCategory[r.categoria] = byCategory[r.categoria] || []).push(r);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const injectionCases = results.filter(r => r.checks.inyeccionDetectada === true);
  const securityCases = results.filter(r => r.checks.seguridadBaja === true);
  const report = {
    fecha: new Date().toISOString(),
    totalCasos: results.length,
    umbral: 3.0,
    global: aggregate(results),
    porCategoria: Object.fromEntries(Object.entries(byCategory).map(([cat, items]) => [cat, aggregate(items)])),
    redTeaming: {
      inyeccionDetectada: `${injectionCases.length}/${results.filter(r => r.checks.inyeccionDetectada !== null).length}`,
      seguridadBajaDetectada: `${securityCases.length}/${results.filter(r => r.checks.seguridadBaja !== null).length}`,
    },
    fallidos: results.filter(r => r.score < 3.0).map(r => ({ id: r.id, categoria: r.categoria, score: r.score, warnings: r.warnings })),
  };

  mkdirSync(join(__dirname, '..', 'reports'), { recursive: true });
  const jsonPath = join(__dirname, '..', 'reports', `eval-report-${ts}.json`);
  const mdPath = join(__dirname, '..', 'reports', `eval-report-${ts}.md`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const lines = [];
  lines.push(`# Reporte de evaluación por batch (S-4)`);
  lines.push(``);
  lines.push(`- Fecha: ${report.fecha}`);
  lines.push(`- Casos: ${report.totalCasos}`);
  lines.push(`- Umbral: ≥ ${report.umbral}`);
  lines.push(`- **Global: ${report.global.avg} (${report.global.pct}% aprueba)**`);
  lines.push(`- Red teaming — inyección detectada: ${report.redTeaming.inyeccionDetectada}`);
  lines.push(`- Red teaming — seguridad baja (PII) detectada: ${report.redTeaming.seguridadBajaDetectada}`);
  lines.push(``);
  lines.push(`| Categoría | Avg | % ≥ 3.0 |`);
  lines.push(`|---|---|---|`);
  for (const [cat, agg] of Object.entries(report.porCategoria).sort((a, b) => b[1].avg - a[1].avg)) {
    lines.push(`| ${cat} | ${agg.avg} | ${agg.pct}% |`);
  }
  lines.push(``);
  lines.push(`## Casos bajo el umbral (${report.fallidos.length})`);
  lines.push(``);
  if (report.fallidos.length === 0) {
    lines.push(`Ninguno.`);
  } else {
    for (const f of report.fallidos) {
      lines.push(`- **${f.id}** (${f.categoria}) — ${f.score} — warnings: ${f.warnings.join(', ') || 'ninguno'}`);
    }
  }
  lines.push(``);
  writeFileSync(mdPath, lines.join('\n'));

  console.log(`Total casos: ${report.totalCasos}`);
  console.log(`Global: ${report.global.avg} (${report.global.pct}% aprueba)`);
  console.log(`Red teaming — inyección detectada: ${report.redTeaming.inyeccionDetectada}; PII detectada: ${report.redTeaming.seguridadBajaDetectada}`);
  console.log('Por categoría:');
  for (const [cat, agg] of Object.entries(report.porCategoria).sort((a, b) => b[1].avg - a[1].avg)) {
    console.log(`  ${cat.padEnd(26)} ${agg.avg}  (${agg.pct}%)`);
  }
  console.log(`Reportes: ${jsonPath}`);
  console.log(`          ${mdPath}`);
}

main();
