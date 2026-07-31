// Simulate the exact flow the function uses
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) {
  console.error('Falta DEEPSEEK_API_KEY (cargala desde functions/.env)');
  process.exit(1);
}

const systemPrompt = `Eres un asistente pedagógico experto en el currículum chileno. Debes generar planificaciones de clase alineadas con los Objetivos de Aprendizaje (OA) oficiales del Ministerio de Educación de Chile.

Contexto:
- Nivel: 7-basico
- Asignatura: historia-geografia-ciencias-sociales

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

const userPrompt = `Genera una planificación de clase para el OA HI07 OA 01: Explicar el proceso de hominización, reconociendo las principales etapas de la evolución de la especie humana, la influencia de factores geográficos, su dispersión en el planeta y las distintas teorías del poblamiento americano.

Duración: 45 minutos
Modalidad: presencial
Estudiantes: 30
Conocimientos previos: no especificado
Recursos disponibles: proyector, cuadernos
Metodología: dialogada

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

const response = await fetch(DEEPSEEK_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  }),
});

const status = response.status;
const result = await response.json();

if (!response.ok) {
  console.log('STATUS:', status);
  console.log('ERROR:', result);
  process.exit(1);
}

const raw = result.choices?.[0]?.message?.content;
console.log('=== RAW CONTENT (first 500) ===');
console.log(raw.slice(0, 500));
console.log('\n=== PARSED KEYS ===');

try {
  const content = JSON.parse(raw);
  console.log('Top-level keys:', Object.keys(content).join(', '));
  console.log('purpose:', content.purpose ? content.purpose.slice(0, 80) + '...' : 'MISSING');
  console.log('activities count:', content.activities?.length ?? 'MISSING');
  if (content.activities?.length) {
    console.log('  first activity:', JSON.stringify(content.activities[0]).slice(0, 150));
  }
  console.log('assessment:', content.assessment ? JSON.stringify(content.assessment).slice(0, 150) : 'MISSING');
  if (!content.purpose) console.log('  >>> purpose MISSING');
  if (!content.activities?.length) console.log('  >>> activities MISSING');
  if (!content.assessment?.criteria?.length) console.log('  >>> assessment.criteria MISSING');
} catch (e) {
  console.log('JSON PARSE ERROR:', e.message);
  console.log('Raw content was:', raw.slice(0, 300));
}
