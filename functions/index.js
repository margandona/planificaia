import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';

initializeApp();

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// API Keys: solo process.env (definidas en functions/.env). Sin functions.config() (deprecado).
const FIREBASE_API_KEY = 'AIzaSyADeo8Y7lVBeT4MJNXOqQSbirOa6sdX3EY';

function getDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || '';
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || FIREBASE_API_KEY;
}

// ─── CONSTANTES ─────────────────────────────────────────

const AI_PROVIDERS = {
  DEEPSEEK: {
    name: 'deepseek',
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    pricePer1KInput: 0.00014,
    pricePer1KOutput: 0.00028,
  },
  GEMINI: {
    name: 'gemini',
    model: 'gemini-1.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    pricePer1KInput: 0.000075,
    pricePer1KOutput: 0.00030,
  },
};

const DEFAULT_LIMITS = {
  dailyGenerations: 10,
  maxOutputTokens: 4000,
  requestTimeoutMs: 30000,
};

const VALIDATION_RULES = [
  { id: 'V-001', type: 'critical', check: (p) => p.activities?.length > 0 },
  { id: 'V-004', type: 'critical', check: (p) => p.assessment?.criteria?.length > 0 },
  { id: 'V-007', type: 'warning', check: (p) => p.activities?.some(a => a.moment === 'cierre') },
  { id: 'V-009', type: 'warning', check: (p) => p.assessment?.feedbackStrategy?.length > 0 },
  { id: 'V-006', type: 'warning', check: (p) => {
    const totalActivityTime = (p.activities || []).reduce((sum, a) => sum + (a.duration || 0), 0);
    return totalActivityTime >= p.duration * 0.8 && totalActivityTime <= p.duration * 1.1;
  }},
];

// ─── HELPERS ────────────────────────────────────────────

function sanitizeInput(text) {
  if (!text) return '';
  const piiPatterns = [
    /\b\d{1,2}\.\d{3}\.\d{3}[-]\d{1,2}\b/g,
    /\b\d{7,9}[-]\d\b/g,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ];
  let sanitized = String(text);
  for (const pattern of piiPatterns) {
    sanitized = sanitized.replace(pattern, '[...]');
  }
  return sanitized;
}

function validateOutputStructure(data) {
  const errors = [];
  if (!data.purpose || data.purpose.length < 5) errors.push('Falta propósito válido');
  if (!data.activities?.length) errors.push('Faltan actividades');
  else {
    for (const act of data.activities) {
      if (!act.moment) errors.push('Actividad sin momento');
      if (!act.description) errors.push('Actividad sin descripción');
    }
  }
  if (!data.assessment?.criteria?.length) errors.push('Faltan criterios de evaluación');
  return errors;
}

// Parser JSON robusto: tolera markdown fences, texto alrededor, y JSON truncado.
function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  // Quitar fences markdown ```json ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // Intentar parse directo
  try { return JSON.parse(cleaned); } catch (e) { /* continuar */ }

  // Extraer el primer bloque { ... } o [ ... ] balanceado (tolerando texto alrededor)
  const starters = [];
  const openCh = { '{': '}', '[': ']' };
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === '{' || c === '[') starters.push(i);
  }
  for (const start of starters) {
    const closeCh = openCh[cleaned[start]];
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let j = start; j < cleaned.length; j++) {
      const c = cleaned[j];
      if (inStr) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === cleaned[start]) depth++;
      else if (c === closeCh) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, j + 1));
          } catch (e2) { break; }
        }
      }
    }
  }
  return null;
}

// Normaliza la respuesta del modelo (DeepSeek/Gemini) al schema interno
// Los modelos a veces envuelven en "planificacion" y usan nombres en español.
function normalizePlanningOutput(data) {
  if (!data || typeof data !== 'object') return {};

  const root = data.planificacion && typeof data.planificacion === 'object' ? data.planificacion : data;

  const pick = (obj, keys) => {
    for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    return undefined;
  };

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
  const normalizedResources = Array.isArray(resources)
    ? resources
    : String(resources || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);

  const rawDua = pick(root, ['dua']);
  const normalizedDua = rawDua && typeof rawDua === 'object' ? {
    representacion: Array.isArray(rawDua.representacion) ? rawDua.representacion : [],
    accionExpresion: Array.isArray(rawDua.accionExpresion) ? rawDua.accionExpresion : [],
    implicacion: Array.isArray(rawDua.implicacion) ? rawDua.implicacion : [],
  } : null;

  return {
    purpose: pick(root, ['purpose', 'proposito', 'propósito', 'objetivo']) || '',
    activities: normalizeActivities(pick(root, ['activities', 'actividades'])),
    assessment: normalizedAssessment,
    differentiation: pick(root, ['differentiation', 'diferenciacion', 'diferenciación']) || '',
    resources: normalizedResources,
    dua: normalizedDua,
  };
}

function runPedagogicalAudit(planning) {
  return VALIDATION_RULES
    .filter(rule => !rule.check(planning))
    .map(rule => ({
      type: rule.type,
      ruleId: rule.id,
      description: getRuleDescription(rule.id),
    }));
}

function getRuleDescription(id) {
  const descriptions = {
    'V-001': 'No hay actividades definidas para los OA seleccionados',
    'V-004': 'La evaluación no tiene criterios definidos',
    'V-007': 'No hay actividad de cierre',
    'V-009': 'No hay estrategia de retroalimentación',
    'V-006': 'La duración total de actividades no coincide con la duración planificada',
  };
  return descriptions[id] || 'Regla de validación no cumplida';
}

// ─── CALL DEEPSEEK ──────────────────────────────────────

async function callDeepSeek(systemPrompt, userPrompt, timeoutMs, maxTokens) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(AI_PROVIDERS.DEEPSEEK.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getDeepSeekKey()}`,
      },
      body: JSON.stringify({
        model: AI_PROVIDERS.DEEPSEEK.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens || DEFAULT_LIMITS.maxOutputTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const rawContent = result.choices[0].message.content;

    // Intento 1: parse robusto
    let content = extractJson(rawContent);
    if (!content && result.choices[0].finish_reason === 'length') {
      // JSON truncado por límite de tokens: reintento con presupuesto mayor
      console.warn('DeepSeek JSON truncado, reintentando con más tokens...');
      clearTimeout(timeout);
      const retry = await fetch(AI_PROVIDERS.DEEPSEEK.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getDeepSeekKey()}`,
        },
        body: JSON.stringify({
          model: AI_PROVIDERS.DEEPSEEK.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: rawContent },
          ],
          temperature: 0.5,
          max_tokens: 6000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const retryResult = await retry.json();
      content = extractJson(retryResult.choices?.[0]?.message?.content);
      if (content) {
        result.usage = retryResult.usage || result.usage;
      }
    }

    if (!content) {
      throw new Error('DeepSeek respuesta no es JSON válido');
    }

    return {
      content,
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
      provider: AI_PROVIDERS.DEEPSEEK.name,
      model: AI_PROVIDERS.DEEPSEEK.model,
      cost: ((result.usage?.prompt_tokens || 0) * AI_PROVIDERS.DEEPSEEK.pricePer1KInput
           + (result.usage?.completion_tokens || 0) * AI_PROVIDERS.DEEPSEEK.pricePer1KOutput) / 1000,
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ─── CALL GEMINI (FALLBACK) ─────────────────────────────

async function callGemini(systemPrompt, userPrompt, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AI_PROVIDERS.GEMINI.endpoint}?key=${getGeminiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}\n\nResponde SOLO con un objeto JSON válido.` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: DEFAULT_LIMITS.maxOutputTokens,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const content = extractJson(text);
    if (!content) throw new Error('Gemini respuesta no es JSON válido');

    return {
      content,
      inputTokens: result.usageMetadata?.promptTokenCount || 0,
      outputTokens: result.usageMetadata?.candidatesTokenCount || 0,
      provider: AI_PROVIDERS.GEMINI.name,
      model: AI_PROVIDERS.GEMINI.model,
      cost: ((result.usageMetadata?.promptTokenCount || 0) * AI_PROVIDERS.GEMINI.pricePer1KInput
           + (result.usageMetadata?.candidatesTokenCount || 0) * AI_PROVIDERS.GEMINI.pricePer1KOutput) / 1000,
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ─── GENERATE ───────────────────────────────────────────

function isGeminiFallbackEnabled() {
  return process.env.GEMINI_FALLBACK_ENABLED !== 'false' && !!process.env.GEMINI_API_KEY;
}

async function generateFromProvider(systemPrompt, userPrompt, useFallback = false) {
  const timeout = DEFAULT_LIMITS.requestTimeoutMs;

  if (!useFallback) {
    try {
      return await callDeepSeek(systemPrompt, userPrompt, timeout);
    } catch (error) {
      if (!isGeminiFallbackEnabled()) {
        throw error;
      }
      console.warn('DeepSeek falló, usando Gemini fallback:', error.message);
      return await callGemini(systemPrompt, userPrompt, timeout);
    }
  }

  if (!isGeminiFallbackEnabled()) {
    throw new Error('Gemini fallback desactivado');
  }

  return await callGemini(systemPrompt, userPrompt, timeout);
}

// ─── BUILD PLANNING OBJECT ──────────────────────────────

function buildDuaPrompt(dua, framework) {
  if (framework === 'estandar' || !dua) {
    return 'Genera sugerencias de diferenciacion pedagogica generales (materiales alternativos, apoyos visuales, tiempos flexibles).';
  }
  const labels = {
    representacion: 'Representacion (multiples formas de presentar la informacion)',
    accionExpresion: 'Accion y expresion (multiples formas de demostrar lo aprendido)',
    implicacion: 'Implicacion (multiples formas de motivar y comprometer)',
  };
  const selectedKeys = {
    representacion: ['percepcion', 'lenguaje', 'conocimientos', 'formatos'],
    accionExpresion: ['respuestas', 'organizadores', 'metas', 'monitoreo'],
    implicacion: ['interes', 'relevancia', 'colaboracion', 'autorregulacion'],
  };
  const labelsByKey = {
    percepcion: 'opciones de percepcion', lenguaje: 'lenguaje claro y simbolos', conocimientos: 'activacion de conocimientos previos', formatos: 'materiales en multiples formatos',
    respuestas: 'variedad de formas de responder', organizadores: 'organizadores graficos', metas: 'metas claras', monitoreo: 'monitoreo del progreso',
    interes: 'opciones de interes', relevancia: 'tareas relevantes', colaboracion: 'colaboracion y comunidad', autorregulacion: 'autorregulacion y retroalimentacion',
  };
  let result = 'Genera estrategias DUA (Diseño Universal para el Aprendizaje) especificas para esta clase. Estructura la salida como objeto "dua" con tres arreglos: representacion, accionExpresion e implicacion. Cada elemento debe ser una estrategia concreta y factible para ESTA clase especifica.\n';
  for (const [group, label] of Object.entries(labels)) {
    const chosen = Array.isArray(dua[group]) && dua[group].length > 0 ? dua[group] : selectedKeys[group];
    result += `- ${label}: enfocate en ${chosen.map(k => labelsByKey[k] || k).join(', ')}.\n`;
  }
  return result;
}

function buildPlanningRecord(userId, context, oaDocs, content, aiResult, promptTemplateId) {
  const planning = {
    userId,
    title: context.title || `Clase: ${oaDocs[0]?.code || 'Sin OA'}`,
    status: 'draft',
    level: context.level,
    subject: context.subject,
    unit: context.unit || '',
    duration: parseInt(context.duration) || 45,
    modality: context.modality || 'presencial',
    learningObjectives: oaDocs.map(oa => ({
      code: oa.code,
      text: oa.text,
      source: oa.source,
    })),
    purpose: content.purpose,
    activities: content.activities || [],
    assessment: content.assessment || {},
    differentiation: content.differentiation || '',
    resources: content.resources || [],
    barriers: context.barriers || '',
    framework: context.framework || 'dua',
    dua: content.dua || null,
    studentCount: context.studentCount || '',
    priorKnowledge: context.priorKnowledge || '',
    methodology: context.methodology || '',
    warnings: [],
    aiContributions: [{
      model: aiResult.model,
      provider: aiResult.provider,
      promptTemplateId,
      generatedAt: new Date().toISOString(),
      sections: ['purpose', 'activities', 'assessment', 'differentiation'],
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      cost: aiResult.cost,
      status: 'success',
    }],
    approvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  planning.warnings = runPedagogicalAudit(planning);
  return planning;
}

// ─── CLOUD FUNCTIONS ────────────────────────────────────

export const generatePlanning = onCall(
  {
    cors: ['https://planificacion-con-ia.web.app'],
    enforceAppCheck: false,
    rateLimiting: {
      maxCalls: 10,
      periodSeconds: 86400,
    },
  },
  async (request) => {
    if (!request.auth) {
      throw new Error('REQUIERE_AUTENTICACION');
    }

    const { context, oaIds, useFallback } = request.data;
    const userId = request.auth.uid;
    const today = new Date().toISOString().split('T')[0];
    const startTime = Date.now();

    // 1. Validar límite diario
    const costSnapshot = await db
      .collection('ai-costs')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .count()
      .get();

    if (costSnapshot.data().count >= DEFAULT_LIMITS.dailyGenerations) {
      throw new Error('LIMITE_DIARIO_ALCANZADO');
    }

    // 2. Validar entrada
    if (!context || !oaIds?.length) {
      throw new Error('CONTEXTO_INCOMPLETO');
    }

    // 3. Obtener OA desde Firestore (no desde el prompt)
    const oaDocs = await Promise.all(
      oaIds.map(async (id) => {
        const doc = await db.collection('curriculum').doc(id).get();
        return { id: doc.id, ...doc.data() };
      })
    );

    if (oaDocs.some(d => !d.id)) {
      throw new Error('OA_NO_ENCONTRADO');
    }

    // 4. Obtener plantilla de prompt (por asignatura, con fallback a general)
    const subjectTemplate = await db
      .collection('prompt-templates')
      .where('status', '==', 'active')
      .where('subjects', 'array-contains', context.subject || '')
      .limit(1)
      .get();

    let templateDocs;
    if (!subjectTemplate.empty) {
      templateDocs = subjectTemplate;
    } else {
      templateDocs = await db
        .collection('prompt-templates')
        .where('status', '==', 'active')
        .limit(1)
        .get();
    }

    if (templateDocs.empty) {
      throw new Error('PLANTILLA_NO_ENCONTRADA');
    }

    const template = templateDocs.docs[0].data();

    // 5. Sanitizar entrada
    const sanitizedContext = {
      ...context,
      priorKnowledge: sanitizeInput(context.priorKnowledge),
      studentCount: sanitizeInput(context.studentCount),
    };

    // 6. Construir prompt (prefijo estable para maximizar prefix-caching de DeepSeek)
    const subjectHuman = (sanitizedContext.subject || '').replace(/-/g, ' ');
    const systemPrompt = template.system
      .replace('{{level}}', sanitizedContext.level)
      .replace('{{subject}}', subjectHuman);

    const oaSummary = oaDocs
      .slice(0, 4) // máx 4 OA por generación (control de tokens)
      .map(oa => `${oa.code}: ${(oa.text || '').slice(0, 250)}${(oa.text || '').length > 250 ? '...' : ''}`)
      .join('\n');

    const userPrompt = template.user
      .replace('{{oaCode}}', oaDocs[0]?.code || '')
      .replace('{{oaText}}', oaSummary)
      .replace('{{duration}}', sanitizedContext.duration || '45')
      .replace('{{modality}}', sanitizedContext.modality || 'presencial')
      .replace('{{students}}', sanitizedContext.studentCount || 'no especificado')
      .replace('{{priorKnowledge}}', sanitizedContext.priorKnowledge || 'no especificado')
      .replace('{{resources}}', (sanitizedContext.resources || []).join(', ') || 'no especificado')
      .replace('{{methodology}}', sanitizedContext.methodology || 'no especificado')
      .replace('{{framework}}', sanitizedContext.framework === 'estandar' ? 'Formato estandar' : 'DUA (Diseño Universal para el Aprendizaje)')
      .replace('{{barriers}}', sanitizeInput(sanitizedContext.barriers || '') || 'ninguna en particular')
      .replace('{{dua}}', buildDuaPrompt(sanitizedContext.dua, sanitizedContext.framework));

    // 7. Llamar a IA (DeepSeek con fallback a Gemini)
    let aiResult;
    try {
      aiResult = await generateFromProvider(systemPrompt, userPrompt, useFallback);
    } catch (error) {
      await db.collection('audit-logs').add({
        userId,
        action: 'generate_error',
        resource: 'planning',
        provider: AI_PROVIDERS.DEEPSEEK.name,
        error: error.message,
        createdAt: new Date().toISOString(),
      });

      if (error.message.includes('LIMITE_DIARIO') || error.message.includes('CONTEXTO_INCOMPLETO')) {
        throw error;
      }
      throw new Error(`ERROR_GENERACION: ${error.message}`);
    }

    // 8. Normalizar y validar estructura de salida
    const normalizedContent = normalizePlanningOutput(aiResult.content);
    const validationErrors = validateOutputStructure(normalizedContent);
    if (validationErrors.length > 0) {
      await db.collection('audit-logs').add({
        userId,
        action: 'validation_error',
        resource: 'planning',
        provider: aiResult.provider,
        errors: validationErrors,
        createdAt: new Date().toISOString(),
      });
      throw new Error(`VALIDACION_FALLIDA: ${validationErrors.join(', ')}`);
    }

    // 9. Construir y guardar planificación
    const planning = buildPlanningRecord(userId, sanitizedContext, oaDocs, normalizedContent, aiResult, templateDocs.docs[0].id);
    const docRef = await db.collection('plannings').add(planning);

    // 10. Registrar costo
    await db.collection('ai-costs').add({
      userId,
      date: today,
      provider: aiResult.provider,
      model: aiResult.model,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      cost: aiResult.cost,
      planningId: docRef.id,
      createdAt: new Date().toISOString(),
    });

    // 11. Log de auditoría
    await db.collection('audit-logs').add({
      userId,
      action: 'generate',
      resource: 'planning',
      resourceId: docRef.id,
      provider: aiResult.provider,
      model: aiResult.model,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      cost: aiResult.cost,
      subject: sanitizedContext.subject,
      level: sanitizedContext.level,
      durationMs: Date.now() - startTime,
      createdAt: new Date().toISOString(),
    });

    return {
      id: docRef.id,
      ...planning,
    };
  }
);

export const regenerateSection = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) {
      throw new Error('REQUIERE_AUTENTICACION');
    }

    const { planningId, section } = request.data;
    const userId = request.auth.uid;

    const planningDoc = await db.collection('plannings').doc(planningId).get();
    if (!planningDoc.exists) throw new Error('PLANIFICACION_NO_ENCONTRADA');

    const planning = planningDoc.data();
    if (planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const sectionPrompt = `Genera solo la sección "${section}" para una planificación de clase.
Contexto:
- Nivel: ${planning.level}
- Asignatura: ${planning.subject}
- OA: ${planning.learningObjectives?.[0]?.code} - ${planning.learningObjectives?.[0]?.text?.slice(0, 100)}
- Duración: ${planning.duration} min
- Modalidad: ${planning.modality}

Sección actual: ${JSON.stringify(planning[section])}

Instrucciones: Genera contenido pedagógicamente sólido para esta sección. Responde SOLO con un objeto JSON.`;

    try {
      const result = await generateFromProvider(
        'Eres un asistente pedagógico especializado en el currículum chileno.',
        sectionPrompt,
        false
      );

      const rawContent = result.content;
      const wrapped = rawContent?.planificacion && typeof rawContent.planificacion === 'object' ? rawContent.planificacion : rawContent;

      const sectionMap = {
        purpose: ['purpose', 'proposito', 'propósito'],
        activities: ['activities', 'actividades'],
        assessment: ['assessment', 'evaluacion', 'evaluación'],
        differentiation: ['differentiation', 'diferenciacion', 'diferenciación'],
        resources: ['resources', 'recursos'],
      };

      let newContent = rawContent;
      const candidates = sectionMap[section] || [section];
      for (const key of candidates) {
        if (wrapped && wrapped[key] !== undefined) { newContent = wrapped[key]; break; }
      }

      if (section === 'activities' && Array.isArray(newContent)) {
        newContent = normalizePlanningOutput({ activities: newContent }).activities;
      }
      if (section === 'assessment' && newContent && typeof newContent === 'object') {
        newContent = normalizePlanningOutput({ assessment: newContent }).assessment;
      }
      if ((section === 'purpose' || section === 'differentiation') && typeof newContent === 'string') {
        newContent = newContent.replace(/^["']|["']$/g, '');
      }

      await db.collection('plannings').doc(planningId).update({
        [section]: newContent,
        updatedAt: new Date().toISOString(),
        version: (planning.version || 1) + 1,
      });

      return { section, content: newContent };
    } catch (error) {
      throw new Error(`ERROR_REGENERACION: ${error.message}`);
    }
  }
);

export const approvePlanning = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) {
      throw new Error('REQUIERE_AUTENTICACION');
    }

    const { planningId } = request.data;
    const userId = request.auth.uid;

    const planningRef = db.collection('plannings').doc(planningId);
    const planningDoc = await planningRef.get();

    if (!planningDoc.exists) throw new Error('PLANIFICACION_NO_ENCONTRADA');

    const planning = planningDoc.data();
    if (planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    await planningRef.update({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.collection('audit-logs').add({
      userId,
      action: 'approve',
      resource: 'planning',
      resourceId: planningId,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }
);

export const submitFeedback = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');

    const { planningId, rating, quality, pedagogic, ease, comments } = request.data || {};
    const userId = request.auth.uid;

    if (planningId) {
      const planningDoc = await db.collection('plannings').doc(planningId).get();
      if (!planningDoc.exists) throw new Error('PLANIFICACION_NO_ENCONTRADA');
      if (planningDoc.data().userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');
    }

    const toScore = (v) => {
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : Math.max(1, Math.min(5, n));
    };

    await db.collection('feedback').add({
      userId,
      planningId: planningId || null,
      rating: toScore(rating),
      quality: toScore(quality),
      pedagogic: toScore(pedagogic),
      ease: toScore(ease),
      comments: sanitizeInput(comments || '').slice(0, 2000),
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }
);

function buildDocxContent(planning, userEmail) {
  const children = [];
  const now = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

  // Title
  children.push(new Paragraph({ children: [new TextRun({ text: planning.title || 'Planificacion de clase', bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Generado el: ${now}`, size: 18, color: '666666' })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }));

  // Info section
  children.push(new Paragraph({ children: [new TextRun({ text: 'Informacion general', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
  const infoData = [
    ['Nivel', planning.level || '-'], ['Asignatura', planning.subject || '-'], ['Unidad', planning.unit || '-'],
    ['Duracion', `${planning.duration || '-'} min`], ['Modalidad', planning.modality || '-'],
    ['Estudiantes', planning.studentCount || '-'], ['Metodologia', planning.methodology || '-'],
  ];
  infoData.forEach(([label, value]) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true, size: 20 }), new TextRun({ text: value, size: 20 })], spacing: { after: 60 } }));
  });

  // OA
  if (planning.learningObjectives?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Objetivos de Aprendizaje', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    planning.learningObjectives.forEach(oa => {
      children.push(new Paragraph({ children: [new TextRun({ text: `${oa.code}: `, bold: true, size: 20 }), new TextRun({ text: oa.text, size: 20 })], spacing: { after: 80 } }));
    });
  }

  // Purpose
  if (planning.purpose) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Proposito', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: planning.purpose, size: 20 })], spacing: { after: 200 } }));
  }

  // Activities
  if (planning.activities?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Actividades', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    const moments = { inicio: 'Inicio', desarrollo: 'Desarrollo', cierre: 'Cierre' };
    ['inicio', 'desarrollo', 'cierre'].forEach(moment => {
      const acts = planning.activities.filter(a => a.moment === moment);
      if (acts.length === 0) return;
      children.push(new Paragraph({ children: [new TextRun({ text: moments[moment], bold: true, size: 20, color: '2563eb' })], spacing: { before: 200, after: 100 } }));
      acts.forEach((act, i) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${act.title || act.description || 'Actividad'} (${act.duration || '-'} min)`, bold: true, size: 20 })], spacing: { before: 100, after: 40 } }));
        if (act.description && act.description !== act.title) {
          children.push(new Paragraph({ children: [new TextRun({ text: act.description, size: 20 })], spacing: { after: 40 } }));
        }
        if (act.keyQuestions?.length > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: `Pregunta clave: ${act.keyQuestions[0]}`, italics: true, size: 18, color: '666666' })], spacing: { after: 40 } }));
        }
        if (act.evidence) {
          children.push(new Paragraph({ children: [new TextRun({ text: `Evidencia: ${act.evidence}`, size: 18, color: '666666' })], spacing: { after: 80 } }));
        }
      });
    });
  }

  // Assessment
  if (planning.assessment) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Evaluacion', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    const ass = planning.assessment;
    children.push(new Paragraph({ children: [new TextRun({ text: `Tipo: ${ass.type || '-'}`, size: 20 })], spacing: { after: 60 } }));
    if (ass.criteria?.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Criterios:', bold: true, size: 20 })], spacing: { after: 40 } }));
      ass.criteria.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: `- ${c}`, size: 20 })], spacing: { after: 40 } })));
    }
    if (ass.feedbackStrategy) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Retroalimentacion: ${ass.feedbackStrategy}`, size: 20 })], spacing: { after: 200 } }));
    }
  }

  // Differentiation
  if (planning.differentiation) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Diferenciacion', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: planning.differentiation, size: 20 })], spacing: { after: 200 } }));
  }

  // DUA
  if (planning.dua && planning.framework !== 'estandar') {
    children.push(new Paragraph({ children: [new TextRun({ text: 'DUA (Diseno Universal para el Aprendizaje)', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    const duaBlocks = [
      ['Representacion (el que)', planning.dua.representacion],
      ['Accion y expresion (el como)', planning.dua.accionExpresion],
      ['Implicacion (el por que)', planning.dua.implicacion],
    ];
    for (const [title, items] of duaBlocks) {
      if (items?.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 20, color: '2563eb' })], spacing: { before: 150, after: 60 } }));
        items.forEach(s => children.push(new Paragraph({ children: [new TextRun({ text: `- ${s}`, size: 20 })], spacing: { after: 40 } })));
      }
    }
    if (planning.barriers) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Barreras: ${planning.barriers}`, size: 18, color: 'b45309' })], spacing: { before: 100, after: 40 } }));
    }
  }

  // Resources
  if (planning.resources?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Recursos', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    planning.resources.forEach(r => children.push(new Paragraph({ children: [new TextRun({ text: `- ${r}`, size: 20 })], spacing: { after: 40 } })));
  }

  // IA Declaration
  if (planning.aiContributions?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '', size: 20 })], spacing: { before: 400 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Declaracion de asistencia por IA', bold: true, size: 18, color: '666666' })], spacing: { after: 40 } }));
    const contrib = planning.aiContributions[0];
    children.push(new Paragraph({ children: [new TextRun({
      text: `Esta planificacion fue generada con asistencia de inteligencia artificial (${contrib.provider}/${contrib.model}, ${new Date(contrib.generatedAt).toLocaleString('es-CL')}). El contenido generado por IA ha sido revisado y aprobado por el docente responsable. La planificacion final es responsabilidad del docente.`,
      size: 16, color: '666666', italics: true,
    })], spacing: { after: 60 } }));
    if (contrib.inputTokens) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Tokens: ${contrib.inputTokens} entrada / ${contrib.outputTokens} salida. Costo estimado: $${(contrib.cost || 0).toFixed(4)} USD`, size: 16, color: '999999' })], spacing: { after: 40 } }));
    }
  }

  // Footer
  children.push(new Paragraph({ children: [new TextRun({ text: `Documento exportado desde PlanificaIA por ${userEmail || 'docente'}`, size: 16, color: '999999', italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 400 } }));

  return children;
}

export const exportPlanning = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');

    const { planningId, format } = request.data;
    const userId = request.auth.uid;

    // Obtener planificacion
    const planningDoc = await db.collection('plannings').doc(planningId).get();
    if (!planningDoc.exists) throw new Error('PLANIFICACION_NO_ENCONTRADA');
    const planning = planningDoc.data();
    if (planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    // Obtener email del usuario
    const user = await auth.getUser(userId);

    if (format === 'docx') {
      // Generar DOCX
      const doc = new Document({
        title: planning.title || 'Planificacion',
        description: 'Planificacion de clase generada con PlanificaIA',
        styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
        sections: [{
          properties: {},
          children: buildDocxContent(planning, user.email),
        }],
      });

      const buffer = await Packer.toBuffer(doc);

      // Subir a Storage
      const fileName = `exports/${userId}/${planningId}_${Date.now()}.docx`;
      const file = storage.bucket().file(fileName);
      await file.save(buffer, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      // Generar URL firmada
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 dias
      });

      await db.collection('audit-logs').add({
        userId, action: 'export', resource: 'planning', resourceId: planningId, format: 'docx',
        createdAt: new Date().toISOString(),
      });

      return { url, format: 'docx', filename: fileName.split('/').pop() };
    }

    if (format === 'pdf') {
      // Para PDF, devolvemos los datos y el frontend genera con print
      return {
        format: 'pdf-print',
        planning: {
          title: planning.title,
          level: planning.level,
          subject: planning.subject,
          duration: planning.duration,
          modality: planning.modality,
          purpose: planning.purpose,
          activities: planning.activities,
          assessment: planning.assessment,
          differentiation: planning.differentiation,
          dua: planning.dua,
          framework: planning.framework,
          barriers: planning.barriers,
          resources: planning.resources,
          learningObjectives: planning.learningObjectives,
          aiContributions: planning.aiContributions,
          createdAt: planning.createdAt,
        },
        userEmail: user.email,
      };
    }

    throw new Error('FORMATO_NO_SOPORTADO');
  }
);

export const onNewAuditLog = onDocumentCreated(
  'audit-logs/{logId}',
  (event) => {
    const log = event.data?.data();
    if (log?.action?.includes('error') || log?.action?.includes('incident')) {
      console.warn('Evento crítico de auditoría:', log);
    }
  }
);
