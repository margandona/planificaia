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

// ─── Lógica de validación/rúbrica (B12): importada desde functions/logic.js ───

import {
  METHODOLOGY_KEYWORDS,
  VALIDATION_RULES,
  getRuleDescription,
  runPedagogicalAudit,
  QUALITY_CRITERIA,
  collectPlanningText,
  hasPII,
  scoreCriterion,
  evaluateQuality,
  PROMPT_INJECTION_PATTERNS,
  detectPromptInjection
} from '../functions/logic.js';
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
