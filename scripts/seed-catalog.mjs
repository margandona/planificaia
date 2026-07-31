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
  subjects: [
    { key: 'matematica', name: 'Matemática', icon: '🔢', sort: 1, active: true },
    { key: 'lenguaje-y-comunicacion', name: 'Lenguaje y Comunicación', icon: '📖', sort: 2, active: true },
    { key: 'ciencias-naturales', name: 'Ciencias Naturales', icon: '🔬', sort: 3, active: true },
    { key: 'historia-geografia-ciencias-sociales', name: 'Historia, Geografía y Cs. Sociales', icon: '🏛️', sort: 4, active: true },
    { key: 'ingles', name: 'Inglés', icon: '🌎', sort: 5, active: true },
    { key: 'artes-visuales', name: 'Artes Visuales', icon: '🎨', sort: 6, active: true },
    { key: 'musica', name: 'Música', icon: '🎵', sort: 7, active: true },
    { key: 'educacion-fisica-salud', name: 'Educación Física y Salud', icon: '⚽', sort: 8, active: true },
    { key: 'tecnologia', name: 'Tecnología', icon: '💻', sort: 9, active: true },
    { key: 'orientacion', name: 'Orientación', icon: '🧭', sort: 10, active: true },
    { key: 'filosofia', name: 'Filosofía', icon: '🧠', sort: 11, active: true },
    { key: 'educacion-ciudadana', name: 'Educación Ciudadana', icon: '🗳️', sort: 12, active: true },
  ],
  version: 2,
  updatedAt: new Date().toISOString(),
};

await db.collection('catalog').doc('subjects').set(CATALOG);
console.log('Catálogo de asignaturas guardado:');
CATALOG.subjects.forEach(s => console.log(`  ${s.icon} ${s.key} (${s.name}) - active:${s.active}`));
process.exit(0);
