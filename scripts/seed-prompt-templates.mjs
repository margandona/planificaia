// S-2: prompt templates por tipo de planificación
// Actualiza templates existentes con types:['class'] y crea templates genéricos por tipo.
// Uso: node scripts/seed-prompt-templates.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = process.env.FIREBASE_SA_PATH || join(__dirname, '..', 'planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json');

const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const SYSTEM_BASE = `Eres un asistente pedagógico experto en el currículum chileno. Debes generar planificaciones alineadas con los Objetivos de Aprendizaje (OA) oficiales del Ministerio de Educación de Chile.

Contexto:
- Nivel: {{level}}
- Asignatura: {{subject}}

Reglas obligatorias:
1. NO modifiques el texto oficial del OA. El OA proporcionado es texto oficial del Mineduc.
2. Genera contenido pedagógicamente sólido y factible en el tiempo indicado.
3. Incluye preguntas clave para cada momento.
4. Asegura que la evaluación esté alineada con los OA.
5. Proporciona estrategias de retroalimentación.
6. Incluye sugerencias de diferenciación para la inclusión.
7. Responde SIEMPRE en JSON con el schema especificado.
8. NO incluyas datos personales de estudiantes.
9. Las actividades deben ser apropiadas para la edad y el contexto.
10. La planificación es un BORRADOR para revisión docente; sé preciso y concreto.`;

const USER_BASE = `Genera una planificación para los OA {{oaCode}}: {{oaText}}

Duracion: {{duration}} minutos
Modalidad: {{modality}}
Estudiantes: {{students}}
Conocimientos previos: {{priorKnowledge}}
Recursos disponibles: {{resources}}
Metodologia: {{methodology}}
Marco de inclusion: {{framework}}
Barreras observadas: {{barriers}}

{{dua}}

IMPORTANTE: Responde UNICAMENTE con un objeto JSON sin texto adicional, con EXACTAMENTE la estructura especificada a continuación.`;

async function main() {
  // 1. Actualizar templates existentes con types:['class']
  const existing = await db.collection('prompt-templates').get();
  for (const doc of existing.docs) {
    const data = doc.data();
    if (!Array.isArray(data.types) || data.types.length === 0) {
      await doc.ref.update({ types: ['class'] });
      console.log(`actualizado ${doc.id} -> types:['class'] (${data.subjects?.[0] || 'general'})`);
    }
  }

  // 2. Crear templates por tipo (si no existen)
  const typeTemplates = [
    { type: 'unit', title: 'Unidad didáctica' },
    { type: 'monthly', title: 'Planificación mensual' },
    { type: 'annual', title: 'Planificación anual' },
    { type: 'evaluation', title: 'Evaluación (Decreto 67)' },
    { type: 'multigrade', title: 'Multigrado' },
  ];

  for (const t of typeTemplates) {
    const q = await db.collection('prompt-templates').where('types', 'array-contains', t.type).limit(1).get();
    if (!q.empty) {
      console.log(`ya existe template para ${t.type} (${q.docs[0].id})`);
      continue;
    }
    const ref = await db.collection('prompt-templates').add({
      title: t.title,
      version: '1.0.0',
      status: 'active',
      subjects: [],
      types: [t.type],
      system: SYSTEM_BASE,
      user: USER_BASE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`creado ${ref.id} -> types:['${t.type}']`);
  }

  console.log('seed completado');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
