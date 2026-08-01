/**
 * Seed del catálogo dinámico de asignaturas
 * Colección: catalog -> documento: subjects
 *
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=... node scripts/seed-catalog.mjs
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const CATALOG = {
  // Base multi-país (S-7): el catálogo es por país. 'cl' = Chile (default).
  // Para otro país se crea catalog/<país>-subjects o se parametriza el doc por país.
  country: 'cl',
  countryName: 'Chile',
  subjects: [
    { key: 'desarrollo-personal-social', name: 'Desarrollo Personal y Social', icon: '🧒', sort: 1, active: true },
    { key: 'comunicacion-integral', name: 'Comunicación Integral', icon: '🗣️', sort: 2, active: true },
    { key: 'interaccion-comprension-entorno', name: 'Interacción y Comprensión del Entorno', icon: '🌱', sort: 3, active: true },
    { key: 'matematica', name: 'Matemática', icon: '🔢', sort: 4, active: true },
    { key: 'lenguaje-y-comunicacion', name: 'Lenguaje y Comunicación', icon: '📖', sort: 5, active: true },
    { key: 'ciencias-naturales', name: 'Ciencias Naturales', icon: '🔬', sort: 6, active: true },
    { key: 'historia-geografia-ciencias-sociales', name: 'Historia, Geografía y Cs. Sociales', icon: '🏛️', sort: 7, active: true },
    { key: 'ingles', name: 'Inglés', icon: '🌎', sort: 8, active: true },
    { key: 'artes-visuales', name: 'Artes Visuales', icon: '🎨', sort: 9, active: true },
    { key: 'musica', name: 'Música', icon: '🎵', sort: 10, active: true },
    { key: 'educacion-fisica-salud', name: 'Educación Física y Salud', icon: '⚽', sort: 11, active: true },
    { key: 'tecnologia', name: 'Tecnología', icon: '💻', sort: 12, active: true },
    { key: 'orientacion', name: 'Orientación', icon: '🧭', sort: 13, active: true },
    { key: 'filosofia', name: 'Filosofía', icon: '🧠', sort: 14, active: true },
    { key: 'educacion-ciudadana', name: 'Educación Ciudadana', icon: '🗳️', sort: 15, active: true },
    { key: 'emprendimiento-y-empleabilidad', name: 'Emprendimiento y Empleabilidad', icon: '💡', sort: 16, active: true },
    { key: 'educacion-financiera', name: 'Educación Financiera', icon: '💰', sort: 17, active: true },
    { key: 'responsabilidad-personal-social', name: 'Responsabilidad Personal y Social', icon: '🤝', sort: 18, active: true },
    { key: 'pensamiento-computacional', name: 'Pensamiento Computacional', icon: '🤖', sort: 19, active: true },
  ],
  version: 5,
  updatedAt: new Date().toISOString(),
};

await db.collection('catalog').doc('subjects').set(CATALOG);
console.log(`Catálogo guardado (${CATALOG.countryName} - ${CATALOG.country}, v${CATALOG.version}):`);
CATALOG.subjects.forEach(s => console.log(`  ${s.icon} ${s.key} (${s.name}) - active:${s.active}`));
process.exit(0);
