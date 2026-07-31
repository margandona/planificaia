import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const SYSTEM_PROMPT = `Eres un asistente pedagógico experto en el currículum chileno. Debes generar planificaciones de clase alineadas con los Objetivos de Aprendizaje (OA) oficiales del Ministerio de Educación de Chile.

Contexto:
- Nivel: {{level}}
- Asignatura: {{subject}}

Reglas obligatorias:
1. NO modifiques el texto oficial del OA. El OA proporcionado es texto oficial del Mineduc.
2. Genera actividades pedagógicamente sólidas y factibles en el tiempo indicado.
3. Incluye preguntas clave para cada momento de la clase.
4. Asegura que la evaluación esté alineada con el OA.
5. Proporciona estrategias de retroalimentación.
6. Incluye sugerencias de diferenciación para la inclusión.
7. Responde SIEMPRE en JSON con el schema especificado.
8. NO incluyas datos personales de estudiantes.
9. Las actividades deben ser apropiadas para la edad y el contexto.`;

const USER_TEMPLATE = `Genera una planificación de clase para el OA {{oaCode}}: {{oaText}}

Duración: {{duration}} minutos
Modalidad: {{modality}}
Estudiantes: {{students}}
Conocimientos previos: {{priorKnowledge}}
Recursos disponibles: {{resources}}
Metodología: {{methodology}}

Genera una planificación estructurada que incluya:
1. Un propósito claro alineado al OA
2. Actividades detalladas para inicio, desarrollo y cierre con tiempos
3. Acciones del docente y de los estudiantes
4. Preguntas clave para cada momento
5. Estrategia de monitoreo
6. Evidencia de aprendizaje
7. Estrategia de evaluación con criterios
8. Estrategia de retroalimentación
9. Sugerencias de diferenciación
10. Recursos necesarios

Responde SOLO con un objeto JSON válido.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    purpose: { type: 'string' },
    activities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          moment: { type: 'string', enum: ['inicio', 'desarrollo', 'cierre'] },
          title: { type: 'string' },
          description: { type: 'string' },
          duration: { type: 'number' },
          teacherActions: { type: 'array', items: { type: 'string' } },
          studentActions: { type: 'array', items: { type: 'string' } },
          keyQuestions: { type: 'array', items: { type: 'string' } },
          monitoringStrategy: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['moment', 'description', 'duration'],
      },
    },
    assessment: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['formativa', 'sumativa'] },
        criteria: { type: 'array', items: { type: 'string' } },
        feedbackStrategy: { type: 'string' },
      },
      required: ['type', 'criteria'],
    },
    differentiation: { type: 'string' },
    resources: { type: 'array', items: { type: 'string' } },
  },
  required: ['purpose', 'activities', 'assessment'],
};

async function setup() {
  console.log('🗑 Eliminando plantillas antiguas...');
  const old = await db.collection('prompt-templates').where('status', '==', 'active').get();
  const batch = db.batch();
  old.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  Eliminadas ${old.size} plantillas antiguas`);

  console.log('✅ Creando plantilla PT-001...');
  const ref = await db.collection('prompt-templates').add({
    id: 'PT-001',
    version: '1.0.0',
    purpose: 'Generar planificación de clase para currículum chileno (Historia 5°-8° básico)',
    compatibleModels: ['deepseek-chat', 'deepseek-reasoner'],
    status: 'active',
    system: SYSTEM_PROMPT,
    user: USER_TEMPLATE,
    outputSchema: JSON.stringify(OUTPUT_SCHEMA),
    variables: ['level', 'subject', 'oaCode', 'oaText', 'duration', 'modality', 'students', 'priorKnowledge', 'resources', 'methodology'],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`  ✅ Creado: ${ref.id}`);

  console.log('\n📋 Resumen:');
  console.log('  - ID: PT-001');
  console.log('  - Versión: 1.0.0');
  console.log('  - Estado: active');
  console.log('  - Modelos: deepseek-chat, deepseek-reasoner');
  console.log('  - Variables: 10');
  console.log('\n✅ Setup completado.');
}

setup().catch(console.error);
