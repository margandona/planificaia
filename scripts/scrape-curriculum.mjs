/**
 * Scraper de curriculumnacional.cl — Objetivos de Aprendizaje oficiales Mineduc
 *
 * Uso:
 *   node scripts/scrape-curriculum.mjs --dry-run          # valida parser en 1 pagina
 *   node scripts/scrape-curriculum.mjs --subjects matematica,lenguaje   # ingesta selectiva
 *   node scripts/scrape-curriculum.mjs                    # ingesta completa (5 asignaturas x 8 niveles)
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS para escribir en Firestore.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Configuración de URLs ───────────────────────────────
// Grupo curricular -> niveles. Cada nivel: [levelKey, levelSlug, subjectSlugOverrides?]
// Los overrides son para 3o-4o medio, donde los slugs de asignatura cambian por nivel.
const GROUPS = {
  '1o-6o-basico': [
    ['5-basico', '5-basico'],
    ['6-basico', '6-basico'],
  ],
  '7o-basico-2-medio': [
    ['7-basico', '7-basico'],
    ['8-basico', '8-basico'],
    ['1-medio', '1-medio'],
    ['2-medio', '2-medio'],
  ],
  '3o-4o-medio': [
    ['3-medio', '3-medio-fg', {
      'matematica': 'matematica-3o-medio',
      'lenguaje-y-comunicacion': 'lengua-literatura-3o-medio',
      'ciencias-naturales': 'ambiente-sostenibilidad',
      'historia-geografia-ciencias-sociales': 'chile-region-latinoamericana',
      'ingles': 'ingles-3o-medio',
    }],
    ['4-medio', '4-medio-fg', {
      'matematica': 'matematica-4o-medio',
      'lenguaje-y-comunicacion': 'lengua-literatura-4o-medio',
      'ciencias-naturales': 'bienestar-salud',
      'historia-geografia-ciencias-sociales': 'mundo-global',
      'ingles': 'ingles-4o-medio',
    }],
  ],
};

// Slug de asignatura por grupo (cambian en media: lenguaje y ciencia se dividen)
const SUBJECT_SLUGS = {
  '1o-6o-basico': {
    'matematica': 'matematica',
    'lenguaje-y-comunicacion': 'lenguaje-comunicacion',
    'ciencias-naturales': 'ciencias-naturales',
    'historia-geografia-ciencias-sociales': 'historia-geografia-ciencias-sociales',
    'ingles': 'ingles',
  },
  '7o-basico-2-medio': {
    'matematica': 'matematica',
    'lenguaje-y-comunicacion': 'lengua-literatura',
    'ciencias-naturales': 'ciencias-naturales',
    'historia-geografia-ciencias-sociales': 'historia-geografia-ciencias-sociales',
    'ingles': 'ingles',
  },
  '3o-4o-medio': {},
};

const SUBJECT_NAMES = {
  'matematica': 'Matematica',
  'lenguaje-y-comunicacion': 'Lenguaje y Comunicacion',
  'ciencias-naturales': 'Ciencias Naturales',
  'historia-geografia-ciencias-sociales': 'Historia, Geografia y Cs. Sociales',
  'ingles': 'Ingles',
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

// Parsea el HTML crudo de una página de asignatura/nivel
// Patrones reales del sitio:
//   eje:    <h3 id="eje-..." class="link"><a href="...">Números</a></h3>
//   item:   <h4 class="wrapper-title-oa ..."><span class="oa-title">Objetivo de aprendizaje MA05 OA 01</span>...
function parsePage(html) {
  const result = { axis: [], objectives: [], skills: [], attitudes: [] };

  const combinedRe = /<h3 id="eje-[\s\S]*?class="link"><a href="[^"]*">([^<]+)<\/a><\/h3>|<h4 class="wrapper-title-oa[^"]*"><span class="oa-title">([^<]+)<\/span><span class="number-title">[^<]*<\/span><\/h4>/g;

  let currentAxis = '';
  let m;
  while ((m = combinedRe.exec(html)) !== null) {
    if (m[1] !== undefined) {
      // Es un eje
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
    const nextItem = rest.search(/<h4 class="wrapper-title-oa|<h3 id="eje-/);
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

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlanificaIA/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);
  return await res.text();
}

// ─── Ingesta ─────────────────────────────────────────────

const ALL_SUBJECTS = Object.keys(SUBJECT_SLUGS['7o-basico-2-medio']);

async function ingest(subjects = ALL_SUBJECTS, dryRun = false) {
  let db = null;
  if (!dryRun) {
    initializeApp();
    db = getFirestore();
  }

  let totalOA = 0, totalSkill = 0, totalAtt = 0;
  const sourceVersion = '2024';

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

        // Guardar OA
        for (const oa of parsed.objectives) {
          await db.collection('curriculum').add({
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
          });
          totalOA++;
        }
        for (const s of parsed.skills) {
          await db.collection('curriculum').add({
            type: 'skill', code: s.code, text: s.text, level, subject,
            source: `Bases Curriculares ${sourceVersion}`, version: sourceVersion,
            isActive: true, createdAt: new Date().toISOString(),
          });
          totalSkill++;
        }
        for (const a of parsed.attitudes) {
          await db.collection('curriculum').add({
            type: 'attitude', code: a.code, text: a.text, level, subject,
            source: `Bases Curriculares ${sourceVersion}`, version: sourceVersion,
            isActive: true, createdAt: new Date().toISOString(),
          });
          totalAtt++;
        }
        console.log(`  [OK] ${subject}/${level}: ${parsed.objectives.length} OA, ${parsed.skills.length} skills, ${parsed.attitudes.length} atts`);
      }
    }
  }

  if (!dryRun) console.log(`\nIngesta completada: ${totalOA} OA, ${totalSkill} habilidades, ${totalAtt} actitudes.`);
}

// ─── CLI ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const subjIdx = args.indexOf('--subjects');
const subjects = subjIdx >= 0 ? args[subjIdx + 1].split(',').map(s => s.trim()).filter(Boolean) : ALL_SUBJECTS;

if (dryRun) {
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
