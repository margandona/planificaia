/**
 * Scraper de curriculumnacional.cl — Objetivos de Aprendizaje oficiales Mineduc
 *
 * Uso:
 *   node scripts/scrape-curriculum.mjs --dry-run          # valida parser (incluye parvularia + OAT)
 *   node scripts/scrape-curriculum.mjs --subjects matematica,lenguaje   # ingesta selectiva
 *   node scripts/scrape-curriculum.mjs                    # ingesta completa (12 asignaturas x niveles)
 *   node scripts/scrape-curriculum.mjs --oat              # ingesta OAT de landings de nivel
 *   node scripts/scrape-curriculum.mjs --oat --dry-run    # valida parser OAT
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS para escribir en Firestore.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Configuración de URLs ───────────────────────────────
// Grupo curricular -> niveles. Cada nivel: [levelKey, levelSlug, subjectSlugOverrides?]
// Los overrides son para 3o-4o medio, donde los slugs de asignatura cambian por nivel.
const GROUPS = {
  'educacion-parvularia': [
    ['sc-sala-cuna', 'sc-sala-cuna'],
    ['nm-nivel-medio', 'nm-nivel-medio'],
    ['nt-nivel-transicion', 'nt-nivel-transicion'],
  ],
  '1o-6o-basico': [
    ['1-basico', '1-basico'],
    ['2-basico', '2-basico'],
    ['3-basico', '3-basico'],
    ['4-basico', '4-basico'],
    ['5-basico', '5-basico'],
    ['6-basico', '6-basico'],
  ],
  '7o-basico-2o-medio': [
    ['7-basico', '7-basico'],
    ['8-basico', '8-basico'],
    ['1-medio', '1-medio'],
    ['2-medio', '2-medio'],
  ],
  '3o-4o-medio': [
    [    '3-medio', '3-medio-fg', {
      'matematica': 'matematica-3o-medio',
      'lenguaje-y-comunicacion': 'lengua-literatura-3o-medio',
      'ciencias-naturales': 'ambiente-sostenibilidad',
      'historia-geografia-ciencias-sociales': 'chile-region-latinoamericana',
      'ingles': 'ingles-3o-medio',
      'filosofia': 'filosofia-3-medio',
      'educacion-ciudadana': 'educacion-ciudadana-3-medio',
      'artes-visuales': 'artes-visuales',
      'musica': 'musica',
      'educacion-fisica-salud': 'educacion-fisica-salud-1',
    }],
    ['4-medio', '4-medio-fg', {
      'matematica': 'matematica-4o-medio',
      'lenguaje-y-comunicacion': 'lengua-literatura-4o-medio',
      'ciencias-naturales': 'bienestar-salud',
      'historia-geografia-ciencias-sociales': 'mundo-global',
      'ingles': 'ingles-4o-medio',
      'filosofia': 'filosofia-4o-medio',
      'educacion-ciudadana': 'educacion-ciudadana-4-medio',
      'artes-visuales': 'artes-visuales',
      'musica': 'musica',
      'educacion-fisica-salud': 'educacion-fisica-salud-2',
    }],
  ],
};

// Slug de asignatura por grupo (cambian en media: lenguaje y ciencia se dividen)
const SUBJECT_SLUGS = {
  'educacion-parvularia': {
    'desarrollo-personal-social': 'desarrollo-personal-social',
    'comunicacion-integral': 'comunicacion-integral',
    'interaccion-comprension-entorno': 'interaccion-comprension-entorno',
  },
  '1o-6o-basico': {
    'matematica': 'matematica',
    'lenguaje-y-comunicacion': 'lenguaje-comunicacion',
    'ciencias-naturales': 'ciencias-naturales',
    'historia-geografia-ciencias-sociales': 'historia-geografia-ciencias-sociales',
    'ingles': 'ingles',
    'artes-visuales': 'artes-visuales',
    'educacion-fisica-salud': 'educacion-fisica-salud',
    'musica': 'musica',
    'orientacion': 'orientacion',
    'tecnologia': 'tecnologia',
  },
  '7o-basico-2o-medio': {
    'matematica': 'matematica',
    'lenguaje-y-comunicacion': 'lengua-literatura',
    'ciencias-naturales': 'ciencias-naturales',
    'historia-geografia-ciencias-sociales': 'historia-geografia-ciencias-sociales',
    'ingles': 'ingles',
    'artes-visuales': 'artes-visuales',
    'educacion-fisica-salud': 'educacion-fisica-salud',
    'musica': 'musica',
    'orientacion': 'orientacion',
    'tecnologia': 'tecnologia',
  },
  '3o-4o-medio': {},
};

const SUBJECT_NAMES = {
  'desarrollo-personal-social': 'Desarrollo Personal y Social',
  'comunicacion-integral': 'Comunicacion Integral',
  'interaccion-comprension-entorno': 'Interaccion y Comprension del Entorno',
  'matematica': 'Matematica',
  'lenguaje-y-comunicacion': 'Lenguaje y Comunicacion',
  'ciencias-naturales': 'Ciencias Naturales',
  'historia-geografia-ciencias-sociales': 'Historia, Geografia y Cs. Sociales',
  'ingles': 'Ingles',
  'artes-visuales': 'Artes Visuales',
  'educacion-fisica-salud': 'Educacion Fisica y Salud',
  'musica': 'Musica',
  'orientacion': 'Orientacion',
  'tecnologia': 'Tecnologia',
  'filosofia': 'Filosofia',
  'educacion-ciudadana': 'Educacion Ciudadana',
};

// ─── Helpers ─────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/li>|<\/h\d>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&deg;/g, '°').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&rarr;/g, '→')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// ID determinístico para que la ingesta sea idempotente (re-ejecutar no duplica)
function docId(subject, level, type, code) {
  return [subject, level, type, code]
    .map(part => part.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('_');
}

// Parsea el HTML crudo de una página de asignatura/nivel
// Patrones reales del sitio:
//   eje:    <h3 id="eje-..." class="link"><a href="...">Números</a></h3>
//   núcleo: <h3 id="ncleo-..." class="link"><a href="...">Lenguaje verbal</a></h3>  (parvularia)
//   item:   <h4 class="wrapper-title-oa ..."><span class="oa-title">Objetivo de aprendizaje MA05 OA 01</span>...
function parsePage(html) {
  const result = { axis: [], objectives: [], skills: [], attitudes: [] };

  const combinedRe = /<h3 id="(?:eje-|ncleo-)[\s\S]*?class="link"><a href="[^"]*">([^<]+)<\/a><\/h3>|<h4 class="wrapper-title-oa[^"]*"><span class="oa-title">([^<]+)<\/span><span class="number-title">[^<]*<\/span><\/h4>/g;

  let currentAxis = '';
  let m;
  while ((m = combinedRe.exec(html)) !== null) {
    if (m[1] !== undefined) {
      // Es un eje o núcleo
      currentAxis = m[1].trim();
      if (!result.axis.includes(currentAxis)) result.axis.push(currentAxis);
      continue;
    }
    // Es un item (OA / Habilidad / Actitud)
    const title = m[2].trim();
    let code = '';
    let type = '';
    if (/^Objetivo de Aprendizaje de Actitud\s/i.test(title)) {
      type = 'attitude';
      code = title.replace(/^Objetivo de Aprendizaje de Actitud\s+/i, '').trim();
    } else if (/^Objetivo de Aprendizaje de Habilidad\s/i.test(title)) {
      type = 'skill';
      code = title.replace(/^Objetivo de Aprendizaje de Habilidad\s+/i, '').trim();
    } else if (/^Objetivo de aprendizaje\s+(?!de\s)/i.test(title)) {
      type = 'oa';
      code = title.replace(/^Objetivo de aprendizaje\s+/i, '').trim();
    }
    if (!code) continue;

    // Extraer la descripción hasta el siguiente item o eje
    const rest = html.slice(combinedRe.lastIndex, html.length);
    const nextItem = rest.search(/<h4 class="wrapper-title-oa|<h3 id="(?:eje-|ncleo-)/);
    const descHtml = nextItem === -1 ? rest : rest.slice(0, nextItem);
    const text = stripHtml(descHtml);

    if (type === 'oa') {
      result.objectives.push({ code, text, axis: currentAxis });
    } else if (type === 'skill') {
      result.skills.push({ code, text });
    } else if (type === 'attitude') {
      result.attitudes.push({ code, text });
    }
  }

  return result;
}

// Parsea los OAT de una landing de nivel (ej. /curriculum/1o-6o-basico)
// Patrón real del sitio:
//   dimensión: <div id="dimensin-fsica" ...><h3>Dimensión física</h3></div>
//   oat:       <h4>Objetivo de Aprendizaje Transversal 1</h4> ... <div>OAT 1</div> ... <div>descripción</div>
function parseOat(html) {
  const result = { dimensions: [], objectives: [] };

  const dimRe = /<div id="(dimensin-[^"]+|proactividad-y-trabajo|planes-y-proyectos-personales|tecnologas-[^"]+)"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/g;
  let currentDimension = '';
  let m;
  while ((m = dimRe.exec(html)) !== null) {
    currentDimension = m[2].trim();
    if (!result.dimensions.includes(currentDimension)) result.dimensions.push(currentDimension);
  }

  const oatRe = /<h4>Objetivo de Aprendizaje Transversal \d+<\/h4>[\s\S]*?<div class="field[^"]*field--name-field-oat-numero[^"]*">([^<]+)<\/div>[\s\S]*?<div class="field[^"]*field--name-field-descripcion[^"]*">([\s\S]*?)<\/div>/g;
  let om;
  while ((om = oatRe.exec(html)) !== null) {
    const code = om[1].trim();
    const text = stripHtml(om[2]);
    if (!/^OAT\s\d+$/i.test(code)) continue;
    result.objectives.push({ code, text });
  }

  return result;
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlanificaIA/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);
  return await res.text();
}

// ─── Ingesta ─────────────────────────────────────────────

const ALL_SUBJECTS = [
  'desarrollo-personal-social',
  'comunicacion-integral',
  'interaccion-comprension-entorno',
  'matematica',
  'lenguaje-y-comunicacion',
  'ciencias-naturales',
  'historia-geografia-ciencias-sociales',
  'ingles',
  'artes-visuales',
  'educacion-fisica-salud',
  'musica',
  'orientacion',
  'tecnologia',
  'filosofia',
  'educacion-ciudadana',
];

async function ingest(subjects = ALL_SUBJECTS, dryRun = false) {
  let db = null;
  if (!dryRun) {
    initializeApp();
    db = getFirestore();
  }

  let totalOA = 0, totalSkill = 0, totalAtt = 0;
  const sourceVersion = '2024';
  const MAX_BATCH = 400;

  for (const subject of subjects) {
    for (const [group, levels] of Object.entries(GROUPS)) {
      for (const levelDef of levels) {
        const [level, levelSlug, overrides] = levelDef;
        const slug = overrides?.[subject] || SUBJECT_SLUGS[group][subject];
        if (!slug) continue;

        const url = `https://www.curriculumnacional.cl/curriculum/${group}/${slug}/${levelSlug}`;
        let parsed;
        try {
          const html = await fetchPage(url);
          parsed = parsePage(html);
        } catch (e) {
          console.log(`  [SKIP] ${subject}/${level}: ${e.message}`);
          continue;
        }

        if (dryRun) {
          console.log(`  ${subject}/${level}: ${parsed.objectives.length} OA, ${parsed.skills.length} skills, ${parsed.attitudes.length} atts`);
          console.log(`    Ejemplos: ${parsed.objectives.slice(0, 3).map(o => o.code).join(', ')}`);
          continue;
        }

        // Guardar OA (id determinístico → idempotente) en lotes
        const writes = [];
        const makeRef = (type, code) => db.collection('curriculum').doc(docId(subject, level, type, code));
        for (const oa of parsed.objectives) {
          writes.push([makeRef('oa', oa.code), {
            code: oa.code,
            text: oa.text,
            axis: oa.axis || '',
            level,
            subject,
            source: `Bases Curriculares ${sourceVersion}`,
            version: sourceVersion,
            isActive: true,
            validFrom: new Date('2024-01-01').toISOString(),
            validTo: null,
            createdAt: new Date().toISOString(),
          }]);
          totalOA++;
        }
        for (const s of parsed.skills) {
          writes.push([makeRef('skill', s.code), {
            type: 'skill', code: s.code, text: s.text, level, subject,
            source: `Bases Curriculares ${sourceVersion}`, version: sourceVersion,
            isActive: true, createdAt: new Date().toISOString(),
          }]);
          totalSkill++;
        }
        for (const a of parsed.attitudes) {
          writes.push([makeRef('attitude', a.code), {
            type: 'attitude', code: a.code, text: a.text, level, subject,
            source: `Bases Curriculares ${sourceVersion}`, version: sourceVersion,
            isActive: true, createdAt: new Date().toISOString(),
          }]);
          totalAtt++;
        }

        for (let i = 0; i < writes.length; i += MAX_BATCH) {
          const batch = db.batch();
          writes.slice(i, i + MAX_BATCH).forEach(([ref, data]) => batch.set(ref, data));
          await batch.commit();
        }
        console.log(`  [OK] ${subject}/${level}: ${parsed.objectives.length} OA, ${parsed.skills.length} skills, ${parsed.attitudes.length} atts`);
      }
    }
  }

  if (!dryRun) console.log(`\nIngesta completada: ${totalOA} OA, ${totalSkill} habilidades, ${totalAtt} actitudes.`);
}

// OAT (Objetivos de Aprendizaje Transversales) — viven en las landings de nivel,
// organizados por dimensión. No dependen de asignatura.
const OAT_GROUPS = [
  { group: '1o-6o-basico', url: 'https://www.curriculumnacional.cl/curriculum/1o-6o-basico' },
  { group: '7o-basico-2o-medio', url: 'https://www.curriculumnacional.cl/curriculum/7o-basico-2o-medio' },
];

async function ingestOat(dryRun = false) {
  let db = null;
  if (!dryRun) {
    initializeApp();
    db = getFirestore();
  }

  let total = 0;
  const sourceVersion = '2024';
  const MAX_BATCH = 400;

  for (const { group, url } of OAT_GROUPS) {
    const html = await fetchPage(url);
    const parsed = parseOat(html);

    if (dryRun) {
      console.log(`  ${group}: ${parsed.objectives.length} OAT en ${parsed.dimensions.length} dimensiones`);
      console.log(`    Dimensiones: ${parsed.dimensions.join(' | ')}`);
      console.log(`    Ejemplos: ${parsed.objectives.slice(0, 3).map(o => o.code).join(', ')}`);
      continue;
    }

    // OAT por grupo de niveles; dimension y código dan el id determinístico
    const writes = [];
    for (const oat of parsed.objectives) {
      const dimSlug = (oat.dimension || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const ref = db.collection('curriculum').doc(docId(`oat-${group}`, dimSlug, 'oat', oat.code));
      writes.push([ref, {
        type: 'oat',
        code: oat.code,
        text: oat.text,
        dimension: oat.dimension || '',
        level: group,
        subject: 'transversal',
        source: `Bases Curriculares ${sourceVersion}`,
        version: sourceVersion,
        isActive: true,
        createdAt: new Date().toISOString(),
      }]);
      total++;
    }

    for (let i = 0; i < writes.length; i += MAX_BATCH) {
      const batch = db.batch();
      writes.slice(i, i + MAX_BATCH).forEach(([ref, data]) => batch.set(ref, data));
      await batch.commit();
    }
    console.log(`  [OK] ${group}: ${parsed.objectives.length} OAT`);
  }

  if (!dryRun) console.log(`\nIngesta OAT completada: ${total} OAT.`);
}

// ─── CLI ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const oatOnly = args.includes('--oat');
const subjIdx = args.indexOf('--subjects');
const subjects = subjIdx >= 0 ? args[subjIdx + 1].split(',').map(s => s.trim()).filter(Boolean) : ALL_SUBJECTS;

if (oatOnly) {
  const run = ingestOat(dryRun);
  const label = dryRun ? `DRY RUN OAT` : `Ingesta OAT`;
  console.log(`${label}\n`);
  run.then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (dryRun) {
  console.log(`DRY RUN — asignaturas: ${subjects.join(', ')}\n`);
  ingest(subjects, true).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Requiere GOOGLE_APPLICATION_CREDENTIALS para escribir en Firestore');
    process.exit(1);
  }
  console.log(`Ingesta — asignaturas: ${subjects.join(', ')}\n`);
  ingest(subjects, false).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
