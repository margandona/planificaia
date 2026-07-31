/**
 * Crea plantillas de prompt específicas por asignatura (PT-002 a PT-006)
 * Copia PT-001 (general) y añade guía pedagógica específica de cada asignatura.
 *
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=... node scripts/seed-templates.mjs
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

// Plantilla base activa (PT-001 general)
const baseSnap = await db.collection('prompt-templates').where('status', '==', 'active').limit(1).get();
if (baseSnap.empty) {
  console.log('No hay plantilla base activa');
  process.exit(1);
}
const base = baseSnap.docs[0].data();
const baseId = baseSnap.docs[0].id;

const SUBJECT_GUIDES = {
  'matematica': 'Guia especifica de Matematica: prioriza la precision conceptual, procedimientos paso a paso, uso correcto de notacion matematica, situaciones de la vida diaria como contexto, y problemas rutinarios y no rutinarios. Incluye momentos de resolucion guiada y practica independiente.',
  'lenguaje-y-comunicacion': 'Guia especifica de Lenguaje: prioriza textos autenticos (narrativos, poeticos, dramaticos, no literarios), estrategias de lectura (antes/durante/despues), comprension lectora, vocabulario en contexto y produccion escrita con procesos (planificar, escribir, revisar).',
  'ciencias-naturales': 'Guia especifica de Ciencias Naturales: prioriza el metodo cientifico (pregunta, hipotesis, experimentacion, conclusiones), observacion, registro de datos, seguridad en el laboratorio, y relacion con fenomenos cotidianos y el entorno.',
  'historia-geografia-ciencias-sociales': 'Guia especifica de Historia: prioriza el pensamiento historico (causalidad, cambio/continuidad, empatia historica), trabajo con fuentes primarias y secundarias, lineas de tiempo, mapas, y vinculos con la formacion ciudadana.',
  'ingles': 'Guia especifica de Ingles: prioriza el uso comunicativo del idioma (listening, speaking, reading, writing), vocabulario tematico contextualizado, funciones del lenguaje, y actividades que promuevan la interaccion entre pares. Las instrucciones y actividades pueden mezclar ingles y espanol, pero el vocabulario y estructuras meta deben estar en ingles.',
};

// Borrar plantillas por asignatura previas (para idempotencia) — sin query compuesta
const allTemplates = await db.collection('prompt-templates').get();
for (const doc of allTemplates.docs) {
  const data = doc.data();
  if (Array.isArray(data.subjects) && data.subjects.length > 0) {
    await doc.ref.delete();
    console.log('Eliminada plantilla anterior:', doc.id);
  }
}

let idx = 2;
for (const [subject, guide] of Object.entries(SUBJECT_GUIDES)) {
  const system = `${base.system}\n\n${guide}`;
  await db.collection('prompt-templates').add({
    id: `PT-00${idx}`,
    version: 1,
    purpose: `Plantilla especifica de ${subject}`,
    compatibleModels: ['deepseek-chat', 'gemini-1.5-flash'],
    subjects: [subject],
    status: 'active',
    system,
    user: base.user,
    outputSchema: base.outputSchema,
    variables: base.variables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log(`Creada PT-00${idx}: ${subject}`);
  idx++;
}

console.log(`\nPlantillas por asignatura listas (base PT-001: ${baseId})`);
process.exit(0);
