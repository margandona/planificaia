// Test the normalizePlanningOutput function against a real DeepSeek response
const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) {
  console.error('Falta DEEPSEEK_API_KEY (cargala desde functions/.env)');
  process.exit(1);
}

// Replicate the normalize function from index.js
function normalizePlanningOutput(data) {
  if (!data || typeof data !== 'object') return {};
  const root = data.planificacion && typeof data.planificacion === 'object' ? data.planificacion : data;
  const pick = (obj, keys) => { for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k]; return undefined; };
  const normalizeMoment = (m) => {
    if (!m) return m;
    const s = String(m).toLowerCase().trim();
    if (s.includes('inicio')) return 'inicio';
    if (s.includes('desarrollo')) return 'desarrollo';
    if (s.includes('cierre')) return 'cierre';
    return s;
  };
  const normalizeDuration = (d) => {
    if (typeof d === 'number') return d;
    if (!d) return 15;
    const match = String(d).match(/\d+/);
    return match ? parseInt(match[0], 10) : 15;
  };
  const normalizeActivities = (acts) => {
    if (!Array.isArray(acts)) return [];
    return acts.map(a => ({
      moment: normalizeMoment(pick(a, ['moment', 'momento'])),
      title: pick(a, ['title', 'titulo']) || '',
      description: pick(a, ['description', 'descripcion', 'actividad']) || '',
      duration: normalizeDuration(pick(a, ['duration', 'duracion', 'duracion_min', 'tiempo'])),
      teacherActions: pick(a, ['teacherActions', 'acciones_docente', 'accionesDocente']) || [],
      studentActions: pick(a, ['studentActions', 'acciones_estudiante', 'accionesEstudiante']) || [],
      keyQuestions: pick(a, ['keyQuestions', 'preguntas_clave', 'preguntasClave']) || [],
      monitoringStrategy: pick(a, ['monitoringStrategy', 'monitoreo', 'estrategia_monitoreo']) || '',
      evidence: pick(a, ['evidence', 'evidencia']) || '',
    })).filter(a => a.moment && a.description);
  };
  const rawAssessment = pick(root, ['assessment', 'evaluacion', 'evaluación']);
  const normalizedAssessment = rawAssessment && typeof rawAssessment === 'object' ? {
    type: pick(rawAssessment, ['type', 'tipo']) || 'formativa',
    criteria: Array.isArray(pick(rawAssessment, ['criteria', 'criterios']))
      ? pick(rawAssessment, ['criteria', 'criterios'])
      : String(pick(rawAssessment, ['criteria', 'criterios']) || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean),
    feedbackStrategy: pick(rawAssessment, ['feedbackStrategy', 'retroalimentacion', 'retroalimentación']) || '',
  } : { type: 'formativa', criteria: [], feedbackStrategy: '' };
  const resources = pick(root, ['resources', 'recursos']);
  const normalizedResources = Array.isArray(resources) ? resources : String(resources || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  return {
    purpose: pick(root, ['purpose', 'proposito', 'propósito', 'objetivo']) || '',
    activities: normalizeActivities(pick(root, ['activities', 'actividades'])),
    assessment: normalizedAssessment,
    differentiation: pick(root, ['differentiation', 'diferenciacion', 'diferenciación']) || '',
    resources: normalizedResources,
  };
}

const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'Eres un asistente pedagogico. Responde SOLO en JSON con el schema indicado.' },
      { role: 'user', content: 'Genera una planificacion de clase para HI07 OA 01 sobre hominizacion, 45 min. Devuelve JSON con: purpose (string), activities (array con moment=inicio|desarrollo|cierre, description, duration numero, keyQuestions, monitoringStrategy, evidence), assessment (con type, criteria array, feedbackStrategy), differentiation, resources. Usa los nombres de campo en ingles exactamente.' },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  }),
});

const result = await response.json();
const raw = result.choices?.[0]?.message?.content;
const parsed = JSON.parse(raw);

console.log('=== Respuesta cruda (keys) ===');
console.log('Top-level:', Object.keys(parsed).join(', '));

const normalized = normalizePlanningOutput(parsed);
console.log('\n=== Normalizada ===');
console.log('purpose:', normalized.purpose ? normalized.purpose.slice(0, 60) + '...' : 'MISSING');
console.log('activities:', normalized.activities.length, '| momentos:', normalized.activities.map(a => a.moment).join(','));
console.log('assessment.criteria:', normalized.assessment.criteria.length);
console.log('assessment.feedbackStrategy:', normalized.assessment.feedbackStrategy ? 'OK' : 'MISSING');
console.log('differentiation:', normalized.differentiation ? 'OK' : 'MISSING');
console.log('resources:', normalized.resources.length);

// Validation check
const errors = [];
if (!normalized.purpose || normalized.purpose.length < 5) errors.push('Falta purpose');
if (!normalized.activities?.length) errors.push('Faltan activities');
if (!normalized.assessment?.criteria?.length) errors.push('Faltan criteria');
console.log('\n=== Validacion ===');
console.log(errors.length === 0 ? 'PASS: estructura valida' : 'FAIL: ' + errors.join(', '));
