import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/logger';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';
import {
  AI_PROVIDERS,
  ALLOWED_REGENERABLE,
  BUDGET_SOFT_LIMIT_PCT,
  BUDGET_USAGE_COLLECTION,
  DEFAULT_LIMITS,
  METHODOLOGY_KEYWORDS,
  MONTHLY_BUDGET_USD,
  PLANNING_TYPES,
  PLANS,
  PRIVACY_VERSION,
  PROMPT_GUARD,
  PROMPT_INJECTION_PATTERNS,
  QUALITY_CRITERIA,
  RETENTION_POLICY,
  TERMS_VERSION,
  VALIDATION_RULES,
  applyPromptGuard,
  budgetId,
  buildCoherenceReviewPrompt,
  buildActivityVariantsPrompt,
  buildContextExtensionText,
  buildDuaPrompt,
  buildMethodologyDistribution,
  buildPlanningRecord,
  buildOfflineActivityVariant,
  buildRecommendationPrompt,
  buildTypeInstruction,
  canApprovePlanning,
  collectPlanningText,
  detectPromptInjection,
  evaluateQuality,
  extractJson,
  generateInviteToken,
  getRuleDescription,
  getUserPlan,
  hasAssessmentCriteria,
  hasFeedbackStrategy,
  hasPII,
  hasPlannedActivities,
  isCoherenceEnabled,
  isOverBudget,
  isRegenerableSection,
  normalizeContextExtension,
  normalizePlanningOutput,
  parseCoherenceReview,
  filterActivityVariantsByResources,
  recommendMethodologies as recommendMethodologiesEngine,
  resolveFeatureFlags,
  retentionCutoffIso,
  runPedagogicalAudit,
  sanitizeContextFields,
  normalizeDeclaredResources,
  sanitizeInput,
  sanitizeOrgName,
  scoreCriterion,
  serializePlanningForReview,
  validateOutputStructure,
  validateActivityVariants,
  validateRecommendationOutput,
  validateTermsAcceptance,
  GAMIFICATION_INTENSITY_LEVELS,
  ALLOWED_GAMIFICATION_SECTIONS,
  isRegenerableGamificationSection,
  buildGamificationSourceContext,
  buildGamificationDraftPrompt,
  validateGamificationDraft,
  buildGamificationSectionPrompt,
  normalizeGamifiedExperience,
  validateGamifiedExperience,
  generateExperienceCode,
  generateParticipantToken,
  normalizeExperienceCode,
  normalizeParticipantAlias,
  isValidExperienceCode,
  isExperienceJoinable,
  buildParticipantDocument,
  validateEvidenceInput,
  isMissionAccessible,
  buildEvidenceRecord,
  applyEvidenceApproval,
  buildTeacherFeedback,
  buildExperienceSharePayload,
  canPublishExperience,
  calculateExperienceProgress,
  resolveExternalToolProfile,
  buildExternalToolPrompt,
  validateExternalToolPrompt,
  buildExternalPromptPackage,
  exportExternalPromptPackage,
  isValidExternalPromptFormat,
  diffGamificationSource,
  applySelectiveSync,
  buildRateLimitDecision,
  evaluateRateLimit,
  SUBCOLLECTION_RETENTION_POLICY
} from './logic.js';

export {
  TERMS_VERSION,
  PRIVACY_VERSION,
  RETENTION_POLICY,
  retentionCutoffIso,
  validateTermsAcceptance
} from './logic.js';


initializeApp();

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// API Keys: solo process.env (definidas en functions/.env). Sin functions.config() (deprecado).
// Nunca usar la web API key de Firebase como clave de IA: no es una clave válida
// de DeepSeek/Gemini y quedaría expuesta como fallback silencioso (B6).
function getDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || '';
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
}

// ─── CONSTANTES ─────────────────────────────────────────

// B6/B7: `deepseek-chat` y `gemini-1.5-flash` fueron retirados (2026-07-24 y antes,
// respectivamente). Se migra a `deepseek-v4-flash` (mismos precios que el código
// ya usaba: $0.14 in / $0.28 out por 1M) y a `gemini-2.5-flash` (precios vigentes:
// $0.30 in / $2.50 out por 1M). Precios por 1K tokens.

async function getMonthlyBudgetUsage() {
  const ref = db.collection(BUDGET_USAGE_COLLECTION).doc(budgetId());
  const snap = await ref.get();
  return { ref, totalCost: snap.exists ? (snap.data().totalCost || 0) : 0 };
}

// Registra el costo en budget-usage/{YYYY-MM} de forma transaccional (suma atómica).
async function recordBudgetUsage(cost) {
  const month = budgetId();
  const ref = db.collection(BUDGET_USAGE_COLLECTION).doc(month);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const prev = snap.exists ? (snap.data().totalCost || 0) : 0;
    t.set(ref, {
      month,
      totalCost: prev + cost,
      updatedAt: new Date().toISOString(),
    });
  });
  return ref;
}

// ─── Límite diario atómico (B3) ─────────────────────────
// Reemplaza el count+compare con race por una reserva transaccional sobre un
// doc diario por usuario (`usage/{userId}/{YYYY-MM-DD}`). El límite aplicado es
// el de PLANS (B2); `rateLimiting` no es una opción válida de onCall en v2.
const USAGE_COLLECTION = 'usage';

function dailyUsageId(userId, date) {
  return `${userId}__${date}`;
}

// Reserva atómicamente una generación del día. Devuelve true si se concedió
// (contador < límite y se incrementó) o lanza LIMITE_DIARIO_ALCANZADO.
async function reserveDailyAllowance(userId, date, limit) {
  const ref = db.collection(USAGE_COLLECTION).doc(dailyUsageId(userId, date));
  let granted = false;
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const prev = snap.exists ? (snap.data().count || 0) : 0;
    if (prev >= limit) {
      granted = false;
      return;
    }
    t.set(ref, {
      userId,
      date,
      count: prev + 1,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    granted = true;
  });
  if (!granted) {
    throw new Error('LIMITE_DIARIO_ALCANZADO');
  }
  return ref;
}

// Libera una reserva no usada (p. ej. fracaso antes de registrar costo).
async function releaseDailyAllowance(ref) {
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const prev = snap.data().count || 1;
    t.set(ref, { count: Math.max(0, prev - 1) }, { merge: true });
  });
}

// U13: rate limit propio por uid/scope (SEC-02). Conteo atómico sobre
// `rate-limit/{key}` con ventana diaria; sin doble tope con PLANS.
const RATE_LIMIT_COLLECTION = 'rate-limit';

async function enforceRateLimit(scope, action, now = new Date()) {
  const decision = buildRateLimitDecision(scope, action, now);
  let allowed = false;
  await db.runTransaction(async (t) => {
    const ref = db.collection(RATE_LIMIT_COLLECTION).doc(decision.key);
    const snap = await t.get(ref);
    const counter = snap.exists ? (snap.data().count || 0) : 0;
    const check = evaluateRateLimit(counter, decision.limit);
    allowed = check.allowed;
    if (allowed) {
      t.set(ref, {
        scope: String(scope), action, day: decision.day,
        count: counter + 1, updatedAt: now.toISOString(),
      }, { merge: true });
    }
  });
  if (!allowed) throw new Error('RATE_LIMIT_EXCEDIDO');
  return decision;
}


async function runCoherenceReview(planning, useFallback = false) {
  const { systemPrompt, userPrompt } = buildCoherenceReviewPrompt(planning);
  const aiResult = await generateFromProvider(systemPrompt, userPrompt, useFallback);
  const review = parseCoherenceReview(aiResult.content);
  if (!review) {
    throw new Error('REVISION_SIN_RESULTADO');
  }
  // B5: expone tokens/costo para que el caller registre la trazabilidad (PT-007).
  return {
    ...review,
    provider: aiResult.provider,
    model: aiResult.model,
    inputTokens: aiResult.inputTokens,
    outputTokens: aiResult.outputTokens,
    cost: aiResult.cost,
  };
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

    // Si la respuesta quedó truncada por el límite de tokens (finish_reason='length'),
    // se reintenta con un presupuesto mayor aunque el JSON parcial haya parseado:
    // un bloque balanceado cortado a la mitad puede ser JSON válido pero incompleto
    // (p. ej. unidades/mensuales con menos clases de las pedidas).
    if (result.choices[0].finish_reason === 'length') {
      logger.warn('DeepSeek JSON truncado (finish_reason=length), reintentando con más tokens...');
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
          max_tokens: 8000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const retryResult = await retry.json();
      const retryContent = extractJson(retryResult.choices?.[0]?.message?.content);
      if (retryContent) {
        content = retryContent;
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
      logger.warn('DeepSeek falló, usando Gemini fallback:', { error: error.message });
      return await callGemini(systemPrompt, userPrompt, timeout);
    }
  }

  if (!isGeminiFallbackEnabled()) {
    throw new Error('Gemini fallback desactivado');
  }

  return await callGemini(systemPrompt, userPrompt, timeout);
}

// ─── BUILD PLANNING OBJECT ──────────────────────────────


// U3: feature flags leídas de config/feature-flags (doc único, admin-write) con
// caché de 5 minutos en memoria y override por variables de entorno
// (p. ej. FLAG_methodologyRecommendationsEnabled=true). Flags apagadas si no existen.
let featureFlagsCache = null;
let featureFlagsCachedAt = 0;
const FEATURE_FLAGS_CACHE_MS = 5 * 60 * 1000;

async function getFeatureFlags() {
  const now = Date.now();
  if (featureFlagsCache && now - featureFlagsCachedAt < FEATURE_FLAGS_CACHE_MS) {
    return featureFlagsCache;
  }
  let docData = {};
  try {
    const snap = await db.collection('config').doc('feature-flags').get();
    if (snap.exists) docData = snap.data() || {};
  } catch (e) {
    // Doc ausente o error de lectura: se usa el fallback de entorno.
  }
  const flags = resolveFeatureFlags(docData);
  for (const key of Object.keys(flags)) {
    const envVal = process.env[`FLAG_${key}`];
    if (envVal !== undefined && envVal !== '') {
      flags[key] = /^(true|1|yes)$/i.test(String(envVal));
    }
  }
  featureFlagsCache = flags;
  featureFlagsCachedAt = now;
  return flags;
}

// ─── CLOUD FUNCTIONS ────────────────────────────────────

export const generatePlanning = onCall(
  {
    cors: ['https://planificacion-con-ia.web.app'],
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      return await runGeneratePlanning(request);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'ERROR_INTERNO');
    }
  }
);

async function runGeneratePlanning(request) {
    if (!request.auth) {
      throw new Error('REQUIERE_AUTENTICACION');
    }

    // Retención oportunista (S-6 / 29.3): purga datos vencidos con tope por colección.
    await runRetentionSweep();

    const { context, oaIds, useFallback } = request.data;
    const userId = request.auth.uid;
    const today = new Date().toISOString().split('T')[0];
    const startTime = Date.now();

    // 1. Validar límite diario según plan (S-7 freemium).
    // Reserva atómica (B3): sin race, sin doble tope de `rateLimiting` (B2).
    const userSnap = await db.collection('users').doc(userId).get();
    const plan = getUserPlan(userSnap.exists ? userSnap.data() : {});
    const dailyLimit = PLANS[plan].dailyGenerations;
    let allowanceRef;
    let allowanceUsed = false;
    try {
      allowanceRef = await reserveDailyAllowance(userId, today, dailyLimit);
    } catch (allowanceError) {
      throw new Error('LIMITE_DIARIO_ALCANZADO');
    }

    try {
    // 1b. Validar presupuesto mensual (soft limit 80%): bloquea solo generación.
    const { totalCost: monthlyCost } = await getMonthlyBudgetUsage();
    if (isOverBudget(monthlyCost)) {
      throw new Error('PRESUPUESTO_ALCANZADO');
    }

    // 2. Validar entrada
    if (!context || !oaIds?.length) {
      throw new Error('CONTEXTO_INCOMPLETO');
    }

    const type = PLANNING_TYPES[context.type] ? context.type : 'class';
    const maxOA = PLANNING_TYPES[type].maxOA;

    if (context.type === 'multigrade' && (!Array.isArray(context.levels) || context.levels.length !== 2)) {
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

    // 4. Obtener plantilla de prompt (por asignatura + tipo, con fallback en cascada)
    // Firestore permite máximo 1 filtro array-contains por consulta, así que la
    // consulta se hace por tipo y la asignatura se filtra en memoria (el catálogo
    // de plantillas es pequeño).
    const templateQuery = async (subject, t) => {
      const active = await db
        .collection('prompt-templates')
        .where('status', '==', 'active')
        .where('types', 'array-contains', t)
        .limit(50)
        .get();
      if (subject) {
        const bySubject = active.docs.find((d) => (d.data().subjects || []).includes(subject));
        if (bySubject) return bySubject;
      }
      if (!active.empty) return active.docs[0];
      if (subject) {
        const bySubjectAny = await db
          .collection('prompt-templates')
          .where('status', '==', 'active')
          .where('subjects', 'array-contains', subject)
          .limit(50)
          .get();
        if (!bySubjectAny.empty) return bySubjectAny.docs[0];
      }
      const generic = await db
        .collection('prompt-templates')
        .where('status', '==', 'active')
        .limit(50)
        .get();
      return generic.empty ? null : generic.docs[0];
    };

    let templateDoc;
    if (type === 'class') {
      // Retrocompatibilidad: templates sin campo types
      const subjectTemplate = await db
        .collection('prompt-templates')
        .where('status', '==', 'active')
        .where('subjects', 'array-contains', context.subject || '')
        .limit(1)
        .get();
      if (!subjectTemplate.empty) {
        templateDoc = subjectTemplate.docs[0];
      } else {
        templateDoc = await templateQuery(null, 'class');
      }
      if (!templateDoc) {
        const generic = await db.collection('prompt-templates').where('status', '==', 'active').limit(1).get();
        templateDoc = generic.empty ? null : generic.docs[0];
      }
    } else {
      templateDoc = await templateQuery(context.subject, type);
    }

    if (!templateDoc) {
      throw new Error('PLANTILLA_NO_ENCONTRADA');
    }

    const template = templateDoc.data();

    // 5. Sanitizar entrada (PII + hardening anti inyección)
    const sanitizedContext = sanitizeContextFields(context);

    // 5a. U3: contexto ampliado opcional (campos del paso 3 del wizard).
    // Con las flags apagadas la extensión queda vacía y el comportamiento actual no cambia.
    const flags = await getFeatureFlags();
    const { extension, errors } = normalizeContextExtension(sanitizedContext, flags);
    if (errors.length > 0) {
      await db.collection('audit-logs').add({
        userId,
        action: 'context_extension_invalid',
        resource: 'planning',
        errors,
        createdAt: new Date().toISOString(),
      });
    }
    sanitizedContext.contextExtension = extension;
    // 5a1. Persistir perfil de recursos del docente (resource-profiles/{uid}).
    if (extension && (extension.physicalResources || extension.internetAccess || extension.techAvailability)) {
      await db.collection('resource-profiles').doc(userId).set({
        uid: userId,
        resources: extension.physicalResources || [],
        internetAccess: extension.internetAccess || '',
        techAvailability: extension.techAvailability || '',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // 5b. Detectar intentos de prompt injection en los datos de entrada
    const contextInjection = detectPromptInjection([
      sanitizedContext.title,
      sanitizedContext.purpose,
      sanitizedContext.methodology,
      sanitizedContext.barriers,
      sanitizedContext.unit,
      (sanitizedContext.resources || []).join(' '),
    ].join(' '));
    if (contextInjection.length > 0) {
      await db.collection('audit-logs').add({
        userId,
        action: 'prompt_injection',
        resource: 'planning',
        patterns: contextInjection,
        createdAt: new Date().toISOString(),
      });
    }

    // 6. Construir prompt (prefijo estable para maximizar prefix-caching de DeepSeek)
    const subjectHuman = (sanitizedContext.subject || '').replace(/-/g, ' ');
    const systemPrompt = applyPromptGuard(template.system
      .replace('{{level}}', sanitizedContext.level)
      .replace('{{subject}}', subjectHuman));

    const oaSummary = oaDocs
      .slice(0, maxOA) // máx OA por generación según tipo
      .map(oa => `${oa.code}: ${(oa.text || '').slice(0, 250)}${(oa.text || '').length > 250 ? '...' : ''}`)
      .join('\n');

    const typeInstruction = buildTypeInstruction(type, sanitizedContext, oaDocs);

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
      .replace('{{dua}}', buildDuaPrompt(sanitizedContext.dua, sanitizedContext.framework))
      + (typeInstruction ? `\n\n${typeInstruction}` : '')
      + buildContextExtensionText(sanitizedContext.contextExtension);

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

      if (error.message.includes('LIMITE_DIARIO') || error.message.includes('CONTEXTO_INCOMPLETO') || error.message.includes('PRESUPUESTO_ALCANZADO')) {
        throw error;
      }
      throw new Error(`ERROR_GENERACION: ${error.message}`);
    }

    // 8. Normalizar y validar estructura de salida
    const normalizedContent = normalizePlanningOutput(aiResult.content, type);
    const validationErrors = validateOutputStructure(normalizedContent, type);
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
    const planning = buildPlanningRecord(userId, sanitizedContext, oaDocs, normalizedContent, aiResult, templateDoc.id);
    planning.userName = request.auth.token.name || request.auth.token.email || '';
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists && userDoc.data().orgId) {
      planning.orgId = userDoc.data().orgId;
    }

    // 9b. Evaluación automática de calidad (S-4)
    const quality = evaluateQuality(planning);
    planning.quality = quality;

    // 9c. Verificador de coherencia (PT-007): revisión cruzada con segundo modelo.
    // No bloquea la generación: si falla o está desactivado, se omite con un log.
    let coherence = null;
    if (isCoherenceEnabled()) {
      try {
        coherence = await runCoherenceReview(planning, false);
        planning.coherenceReview = coherence;
        // B5: la revisión de coherencia consume IA → registrar costo y trazabilidad.
        await db.collection('ai-costs').add({
          userId,
          date: today,
          provider: coherence.provider,
          model: coherence.model,
          inputTokens: coherence.inputTokens,
          outputTokens: coherence.outputTokens,
          cost: coherence.cost,
          planningId: null,
          action: 'coherence_review',
          coherenceScore: coherence.score,
          coherenceVerdict: coherence.verdict,
          createdAt: new Date().toISOString(),
        });
        await recordBudgetUsage(coherence.cost);
        await db.collection('audit-logs').add({
          userId,
          action: 'coherence_review',
          resource: 'planning',
          provider: coherence.provider,
          model: coherence.model,
          coherenceScore: coherence.score,
          coherenceVerdict: coherence.verdict,
          issuesCount: coherence.issues.length,
          cost: coherence.cost,
          createdAt: new Date().toISOString(),
        });
      } catch (coherenceError) {
        logger.warn('Coherence review skipped:', { error: coherenceError.message });
        await db.collection('audit-logs').add({
          userId,
          action: 'coherence_review_error',
          resource: 'planning',
          error: coherenceError.message,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const docRef = await db.collection('plannings').add(planning);

    // 10. Registrar costo. La reserva diaria se consume solo aquí (éxito).
    allowanceUsed = true;
    await db.collection('ai-costs').add({
      userId,
      date: today,
      provider: aiResult.provider,
      model: aiResult.model,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      cost: aiResult.cost,
      planningId: docRef.id,
      qualityScore: quality.score,
      qualityVerdict: quality.verdict,
      createdAt: new Date().toISOString(),
    });

    // 10b. Registrar costo en presupuesto mensual (transaccional, kill-switch).
    await recordBudgetUsage(aiResult.cost);

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
      type,
      qualityScore: quality.score,
      qualityVerdict: quality.verdict,
      durationMs: Date.now() - startTime,
      createdAt: new Date().toISOString(),
    });

    return {
      id: docRef.id,
      ...planning,
    };
    } catch (generationError) {
      // Si la generación fracasó antes de registrar el costo, liberar la reserva
      // diaria para no penalizar al usuario con intentos fallidos (B3).
      if (!allowanceUsed && allowanceRef) {
        try { await releaseDailyAllowance(allowanceRef); } catch (releaseError) { /* best-effort */ }
      }
      throw generationError;
    }
  }

// U4: recomendador metodológico (sección 14). Las reglas deterministas filtran y
// ordenan los candidatos; la IA solo los explica y contextualiza (nunca decide).
export const recommendMethodologies = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { context, oaIds, planningId } = request.data || {};

    // Flag: sin methodologyRecommendationsEnabled la función está desactivada.
    const flags = await getFeatureFlags();
    if (!flags.methodologyRecommendationsEnabled) {
      throw new Error('FLAG_DESACTIVADO');
    }

    // Validación de entrada básica (CONTEXTO_INCOMPLETO).
    if (!context || !Array.isArray(oaIds) || oaIds.length === 0) {
      throw new Error('CONTEXTO_INCOMPLETO');
    }
    if (planningId) {
      const planningSnap = await db.collection('plannings').doc(planningId).get();
      if (planningSnap.exists && planningSnap.data().userId !== userId) {
        throw new Error('ACCESO_NO_AUTORIZADO');
      }
    }

    // Sanitizar y normalizar el contexto ampliado (U3) para las reglas.
    const sanitizedContext = sanitizeContextFields(context);
    const extensionResult = normalizeContextExtension(sanitizedContext, flags);
    if (extensionResult.errors.length > 0) {
      await db.collection('audit-logs').add({
        userId,
        action: 'recommend_context_invalid',
        resource: 'methodology_recommendation',
        errors: extensionResult.errors,
        createdAt: new Date().toISOString(),
      });
    }
    sanitizedContext.contextExtension = extensionResult.extension;

    // Candidatos deterministas (reglas puras): 1-3 recomendaciones.
    const { recommendations: candidates } = recommendMethodologiesEngine(sanitizedContext, flags);
    if (candidates.length === 0) {
      return { recommendations: [], status: 'sin-candidatos' };
    }

    // OA desde Firestore para el contexto de la IA explicativa.
    const oaDocs = [];
    if (sanitizedContext.subject && sanitizedContext.level) {
      const snap = await db.collection('curriculum')
        .where('subject', '==', sanitizedContext.subject)
        .where('level', '==', sanitizedContext.level)
        .where('code', 'in', oaIds.slice(0, 10))
        .limit(10)
        .get();
      snap.forEach(d => oaDocs.push(d.data()));
    }

    // IA explicativa (1 llamada): completa la estructura 14.2 sobre los candidatos.
    const prompt = buildRecommendationPrompt(sanitizedContext, oaDocs, candidates);
    const aiResult = await generateFromProvider(prompt.system, prompt.user, request.data?.useFallback || false);
    const raw = typeof aiResult.content === 'string' ? extractJson(aiResult.content) : aiResult.content;
    const parsed = Array.isArray(raw) ? raw : (raw ? raw.recommendations : null);
    const allowedCandidates = new Map(candidates.map(candidate => [candidate.method, candidate]));
    const merged = Array.isArray(parsed)
      ? parsed
        .filter(recommendation => allowedCandidates.has(recommendation?.method))
        .slice(0, 3)
        .map(recommendation => ({
          ...recommendation,
          // Estas dos decisiones son deterministas y nunca las puede cambiar la IA.
          method: allowedCandidates.get(recommendation.method).method,
          pertinence: allowedCandidates.get(recommendation.method).pertinence,
        }))
      : null;
    const errors = validateRecommendationOutput(merged);

    if (errors.length > 0 || !parsed) {
      await db.collection('audit-logs').add({
        userId,
        action: 'recommend_validation_error',
        resource: 'methodology_recommendation',
        errors: errors.length ? errors : ['SALIDA_NO_JSON'],
        createdAt: new Date().toISOString(),
      });
      // Fallback: devolver candidatos deterministas con datos del catálogo.
      return { recommendations: candidates, status: 'deterministic', note: 'La explicación IA no pasó validación; se devolvió el análisis determinista.' };
    }

    // Persistir el resultado (methodology-recommendations/{id}).
    const docRef = await db.collection('methodology-recommendations').add({
      uid: userId,
      planningId: planningId || null,
      contextSnapshot: {
        type: sanitizedContext.type,
        level: sanitizedContext.level,
        subject: sanitizedContext.subject,
        modality: sanitizedContext.modality,
        duration: sanitizedContext.duration,
      },
      recommendations: merged,
      status: 'draft',
      aiContributions: [{
        model: aiResult.model,
        provider: aiResult.provider,
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        cost: aiResult.cost,
        generatedAt: new Date().toISOString(),
      }],
      createdAt: new Date().toISOString(),
    });

    // Trazabilidad y costo (mismo patrón que generatePlanning).
    await db.collection('ai-costs').add({
      userId,
      date: new Date().toISOString().split('T')[0],
      provider: aiResult.provider,
      model: aiResult.model,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      cost: aiResult.cost,
      planningId: planningId || null,
      action: 'recommend_methodology',
      result: 'success',
    });
    await recordBudgetUsage(aiResult.cost);
    await db.collection('audit-logs').add({
      userId,
      action: 'recommend_methodology',
      resource: 'methodology_recommendation',
      recommendationId: docRef.id,
      createdAt: new Date().toISOString(),
    });

    return { recommendations: merged, status: 'ok', id: docRef.id };
  }
);

// U5: genera variantes de una actividad sin modificar la planificación fuente.
export const generateActivityVariants = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { planningId, activityId, resources } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.methodologyRecommendationsEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!planningId || activityId === undefined || activityId === null) throw new Error('CONTEXTO_INCOMPLETO');

    const planningSnap = await db.collection('plannings').doc(planningId).get();
    if (!planningSnap.exists) throw new Error('PLANIFICACION_NO_ENCONTRADA');
    const planning = planningSnap.data();
    if (planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const findActivity = () => {
      const roots = Array.isArray(planning.activities) ? planning.activities : [];
      const direct = roots.find((activity, index) => String(activity.id || index) === String(activityId));
      if (direct) return direct;
      for (const group of ['classes', 'weeks', 'months']) {
        for (const item of planning.unit?.[group] || []) {
          const activity = (item.activities || []).find((candidate, index) => String(candidate.id || index) === String(activityId));
          if (activity) return activity;
        }
      }
      return null;
    };
    const activity = findActivity();
    if (!activity) throw new Error('ACTIVIDAD_NO_ENCONTRADA');

    let availableResources = normalizeDeclaredResources(resources);
    if (availableResources.length === 0) {
      const profileSnap = await db.collection('resource-profiles').doc(userId).get();
      if (profileSnap.exists) availableResources = normalizeDeclaredResources(profileSnap.data().resources);
    }

    const prompt = buildActivityVariantsPrompt(activity, availableResources);
    const aiResult = await generateFromProvider(prompt.system, prompt.user, request.data?.useFallback || false);
    const raw = typeof aiResult.content === 'string' ? extractJson(aiResult.content) : aiResult.content;
    const generated = Array.isArray(raw) ? raw : (raw?.variants || []);
    const offline = buildOfflineActivityVariant(activity);
    const withoutA = generated.filter(variant => variant?.id !== 'A');
    const filtered = filterActivityVariantsByResources(withoutA, availableResources).slice(0, 3);
    const variants = [offline, ...filtered];
    const validationErrors = validateActivityVariants(variants, availableResources);

    await db.collection('ai-costs').add({
      userId,
      date: new Date().toISOString().split('T')[0],
      provider: aiResult.provider,
      model: aiResult.model,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      cost: aiResult.cost,
      planningId,
      action: 'generate_variants',
      result: validationErrors.length ? 'deterministic_fallback' : 'success',
    });
    await recordBudgetUsage(aiResult.cost);
    await db.collection('audit-logs').add({
      userId,
      action: 'generate_variants',
      resource: 'planning_activity',
      planningId,
      activityId: String(activityId),
      variantCount: variants.length,
      filteredCount: Math.max(0, generated.length - filtered.length),
      createdAt: new Date().toISOString(),
    });

    return {
      variants: validationErrors.length ? [offline] : variants,
      status: validationErrors.length ? 'deterministic' : 'ok',
      filteredCount: Math.max(0, generated.length - filtered.length),
    };
  }
);

// U7: crea una experiencia gamificada a partir de una planificación (sección 22).
// Modalidad nativa. La planificación fuente nunca se sobrescribe; se copia solo un
// contexto extraído (OA, propósito, criterios) y se persiste una experiencia draft.
export const createGamifiedExperience = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { planningId, sourceRef, modes, intensity } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!planningId || !sourceRef || typeof sourceRef !== 'object') throw new Error('FUENTE_NO_ENCONTRADA');
    if (modes && !Array.isArray(modes)) throw new Error('MODO_INVALIDO');
    const level = intensity || 'draft';
    if (!GAMIFICATION_INTENSITY_LEVELS.includes(level)) throw new Error('INTENSIDAD_INVALIDA');

    const planningSnap = await db.collection('plannings').doc(planningId).get();
    if (!planningSnap.exists) throw new Error('FUENTE_NO_ENCONTRADA');
    const planning = planningSnap.data();
    if (planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const now = new Date().toISOString();
    const context = buildGamificationSourceContext(planning, sourceRef);
    const baseRecord = {
      title: context.title,
      description: context.purpose,
      narrative: '',
      status: 'draft',
      code: generateExperienceCode(),
      authorUid: userId,
      orgId: planning.orgId || null,
      sourcePlanningId: planningId,
      sourcePlanningVersionId: planning.version || null,
      sourceActivityId: sourceRef.sourceActivityId || null,
      sourceType: context.sourceType,
      oa: context.oa,
      skills: [],
      attitudes: [],
      purpose: context.purpose,
      evidenceCriteria: context.evidenceCriteria,
      mode: modes && modes.includes('teams') ? 'teams' : (modes && modes.includes('presentation') ? 'presentation' : 'individual'),
      aiContributions: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    let aiResult = null;
    if (level === 'draft') {
      const prompt = buildGamificationDraftPrompt(planning, sourceRef);
      aiResult = await generateFromProvider(prompt.system, prompt.user, request.data?.useFallback || false);
      const raw = typeof aiResult.content === 'string' ? extractJson(aiResult.content) : aiResult.content;
      const draft = (raw && typeof raw === 'object') ? await normalizeGamifiedExperience({ ...raw, oa: context.oa, evidenceCriteria: context.evidenceCriteria }) : null;
      const draftErrors = validateGamificationDraft(raw || null);
      if (!aiResult || (draftErrors.length === 0 && draft)) {
        if (draft) {
          baseRecord.description = draft.description || baseRecord.description;
          baseRecord.narrative = draft.narrative || '';
          baseRecord.activities = draft.activities || [];
          baseRecord.missions = draft.missions || [];
          baseRecord.rules = draft.rules || [];
          baseRecord.skills = draft.skills || [];
          baseRecord.attitudes = draft.attitudes || [];
        }
      }
      if (!draft || draftErrors.length > 0) {
        await db.collection('audit-logs').add({
          userId, action: 'gamify_create_draft_error', resource: 'gamified_experience',
          planningId, errors: draftErrors.length ? draftErrors : ['DRAFT_INVALIDO'], createdAt: now,
        });
      }
    }

    const docRef = await db.collection('gamified-experiences').add(baseRecord);
    await db.collection('gamification-audit-logs').add({
      expId: docRef.id, action: 'gamify_create', data: { intensity: level, sourceType: context.sourceType },
      createdAt: now, uid: userId,
    });
    await db.collection('audit-logs').add({
      userId, action: 'gamify_create', resource: 'gamified_experience', resourceId: docRef.id,
      planningId, intensity: level, createdAt: now,
    });

    if (aiResult) {
      await db.collection('ai-costs').add({
        userId, date: now.split('T')[0], provider: aiResult.provider, model: aiResult.model,
        inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, cost: aiResult.cost,
        planningId, expId: docRef.id, action: 'gamify_draft', result: 'success',
      });
      await db.collection('gamification-costs').add({
        expId: docRef.id, functionType: 'gamificacion', provider: aiResult.provider, model: aiResult.model,
        tokensIn: aiResult.inputTokens, tokensOut: aiResult.outputTokens, cost: aiResult.cost,
        date: now.split('T')[0], uid: userId, result: 'success',
      });
      await recordBudgetUsage(aiResult.cost);
    }

    return { experienceId: docRef.id, status: 'draft', intensity: level };
  }
);

// U7: genera (o regenera) el borrador IA de una experiencia existente.
export const generateGamificationDraft = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { experienceId } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!experienceId) throw new Error('EXPERIENCIA_NO_ENCONTRADA');

    const expSnap = await db.collection('gamified-experiences').doc(experienceId).get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    if (experience.authorUid !== userId) throw new Error('ACCESO_NO_AUTORIZADO');
    if (experience.status !== 'draft') throw new Error('STATUS_INVALIDO');

    const planningSnap = experience.sourcePlanningId
      ? await db.collection('plannings').doc(experience.sourcePlanningId).get()
      : null;
    const planning = planningSnap?.exists ? planningSnap.data() : { title: experience.title || 'Experiencia', purpose: experience.purpose || '', learningObjectives: experience.oa || [] };
    const sourceRef = { sourceType: experience.sourceType, sourceActivityId: experience.sourceActivityId };

    const prompt = buildGamificationDraftPrompt(planning, sourceRef, 'draft');
    const aiResult = await generateFromProvider(prompt.system, prompt.user, request.data?.useFallback || false);
    const raw = typeof aiResult.content === 'string' ? extractJson(aiResult.content) : aiResult.content;
    const draft = (raw && typeof raw === 'object')
      ? await normalizeGamifiedExperience({ ...raw, oa: experience.oa, evidenceCriteria: experience.evidenceCriteria })
      : null;
    const draftErrors = validateGamificationDraft(raw || null);
    if (!draft || draftErrors.length > 0) {
      await db.collection('audit-logs').add({
        userId, action: 'gamify_draft_error', resource: 'gamified_experience', resourceId: experienceId,
        errors: draftErrors.length ? draftErrors : ['DRAFT_INVALIDO'], createdAt: new Date().toISOString(),
      });
      throw new Error('DRAFT_INVALIDO');
    }

    const now = new Date().toISOString();
    await db.collection('gamified-experiences').doc(experienceId).update({
      description: draft.description || experience.description,
      narrative: draft.narrative || '',
      activities: draft.activities || [],
      missions: draft.missions || [],
      rules: draft.rules || [],
      skills: draft.skills || [],
      attitudes: draft.attitudes || [],
      aiContributions: [{ model: aiResult.model, provider: aiResult.provider, generatedAt: now }],
      version: (experience.version || 0) + 1,
      updatedAt: now,
    });
    await db.collection('gamification-audit-logs').add({
      expId: experienceId, action: 'gamify_draft', createdAt: now, uid: userId,
    });
    await db.collection('ai-costs').add({
      userId, date: now.split('T')[0], provider: aiResult.provider, model: aiResult.model,
      inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, cost: aiResult.cost,
      expId: experienceId, action: 'gamify_draft', result: 'success',
    });
    await db.collection('gamification-costs').add({
      expId: experienceId, functionType: 'gamificacion', provider: aiResult.provider, model: aiResult.model,
      tokensIn: aiResult.inputTokens, tokensOut: aiResult.outputTokens, cost: aiResult.cost,
      date: now.split('T')[0], uid: userId, result: 'success',
    });
    await recordBudgetUsage(aiResult.cost);

    return { draft: validateGamifiedExperience(draft), status: 'ok' };
  }
);

// U7: regenera UNA sección permitida de la experiencia (whitelist + protecciones B1).
export const regenerateGamificationSection = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { experienceId, section, instruction } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!experienceId || !section || !isRegenerableGamificationSection(section)) throw new Error('SECCION_INVALIDA');

    const expSnap = await db.collection('gamified-experiences').doc(experienceId).get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    if (experience.authorUid !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const current = experience[section];
    const prompt = buildGamificationSectionPrompt(section, current, instruction || '');
    const aiResult = await generateFromProvider(prompt.system, prompt.user, request.data?.useFallback || false);
    const raw = typeof aiResult.content === 'string' ? extractJson(aiResult.content) : aiResult.content;
    const newContent = (section === 'missions')
      ? ((Array.isArray(raw) ? raw : raw?.missions) || []).map((mission, index) => normalizeGamifiedExperience({ missions: [mission] }).missions[0])
      : raw;
    if (!newContent || (Array.isArray(newContent) && newContent.length === 0)) throw new Error('SECCION_INVALIDA');

    const now = new Date().toISOString();
    const update = { [section]: newContent, updatedAt: now };
    await db.collection('gamified-experiences').doc(experienceId).update(update);
    await db.collection('gamification-audit-logs').add({
      expId: experienceId, action: 'gamify_regenerate', data: { section }, createdAt: now, uid: userId,
    });
    await db.collection('ai-costs').add({
      userId, date: now.split('T')[0], provider: aiResult.provider, model: aiResult.model,
      inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, cost: aiResult.cost,
      expId: experienceId, action: 'gamify_regenerate', result: 'success', section,
    });
    await db.collection('gamification-costs').add({
      expId: experienceId, functionType: 'gamificacion', provider: aiResult.provider, model: aiResult.model,
      tokensIn: aiResult.inputTokens, tokensOut: aiResult.outputTokens, cost: aiResult.cost,
      date: now.split('T')[0], uid: userId, result: 'success',
    });
    await recordBudgetUsage(aiResult.cost);

    return { section, content: newContent, status: 'ok' };
  }
);

// U8: entrada de un participante (invitado seudónimo, sin cuenta) a una
// experiencia publicada mediante código de acceso. Devuelve un token de sesión
// que el portal usa para leer progreso y entregar evidencia (U9).
export const joinGamifiedExperience = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    await runRetentionSweep();
    const { code, alias } = request.data || {};
    const normalizedCode = normalizeExperienceCode(code);
    if (!isValidExperienceCode(normalizedCode)) throw new Error('CODIGO_INVALIDO');
    const normalizedAlias = normalizeParticipantAlias(alias);
    if (normalizedAlias.length < 2) throw new Error('ALIAS_OCUPADO');
    await enforceRateLimit(`join:${normalizedCode}`, 'gamify_join');

    const pubSnap = await db.collection('gamified-experiences')
      .where('code', '==', normalizedCode)
      .limit(1)
      .get();
    if (pubSnap.empty) throw new Error('CODIGO_INVALIDO');
    const expDoc = pubSnap.docs[0];
    const experience = expDoc.data();
    if (experience.status !== 'published') throw new Error('CODIGO_INVALIDO');
    const joinable = isExperienceJoinable(experience);
    if (!joinable.ok) throw new Error(joinable.reason);

    // Alias único por experiencia (seudónimo, no PII).
    const aliasSnap = await db.collection('gamified-experiences').doc(expDoc.id)
      .collection('participants')
      .where('alias', '==', normalizedAlias)
      .limit(1)
      .get();
    if (!aliasSnap.empty) throw new Error('ALIAS_OCUPADO');

    const token = generateParticipantToken();
    const now = new Date().toISOString();
    const participant = buildParticipantDocument(normalizedAlias, expDoc.id, joinable.mode || 'individual', token);
    await db.collection('gamified-experiences').doc(expDoc.id)
      .collection('participants').doc(token).set(participant);

    await db.collection('gamification-audit-logs').add({
      expId: expDoc.id, participantToken: token, action: 'gamify_join', createdAt: now,
    });
    await db.collection('audit-logs').add({
      userId: request.auth?.uid || 'invitado',
      action: 'gamify_join',
      resource: 'gamified_experience',
      resourceId: expDoc.id,
      createdAt: now,
    });

    return {
      participantToken: token,
      alias: normalizedAlias,
      experienceId: expDoc.id,
      title: experience.title,
      mode: joinable.mode || 'individual',
      missions: Array.isArray(experience.missions) ? experience.missions.map(m => ({ id: m.id, title: m.title, type: m.type, points: m.points })).slice(0, 20) : [],
    };
  }
);

// U9: un participante entrega evidencia para una misión (token como credencial,
// sin cuenta). La entrega queda pendiente de revisión docente.
export const submitMissionEvidence = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    const { participantToken, missionId, text, links, fileUrl, fileSize, expId } = request.data || {};
    if (!participantToken || !missionId) throw new Error('DATOS_INCOMPLETOS');
    if (!expId) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    await enforceRateLimit(`ev:${participantToken}`, 'gamify_evidence_submit');

    const participantDocRef = db.collection('gamified-experiences').doc(expId).collection('participants').doc(participantToken);
    const participantSnap = await participantDocRef.get();
    if (!participantSnap.exists || participantSnap.data().status !== 'active') throw new Error('TOKEN_INVALIDO');

    const expSnap = await db.collection('gamified-experiences').doc(expId).get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    if (experience.status !== 'published') throw new Error('EXPERIENCIA_CERRADA');

    const existing = await participantDocRef.collection('evidence').where('missionId', '==', String(missionId)).limit(1).get();
    if (!existing.empty && existing.docs[0].data().status !== 'rejected') throw new Error('EVIDENCIA_YA_ENVIADA');

    const validation = validateEvidenceInput({ text, links, fileUrl, fileSize });
    if (validation.errors.length > 0) {
      await db.collection('audit-logs').add({ userId: 'participante', action: 'gamify_evidence_submit_invalid', resource: 'gamified_experience', resourceId: expId, errors: validation.errors, createdAt: new Date().toISOString() });
      throw new Error(validation.errors[0].code);
    }

    const progress = participantSnap.data().progress || {};
    const accessibility = isMissionAccessible(experience, missionId, progress.missionsCompleted);
    if (!accessibility.ok) throw new Error('MISION_INACCESIBLE');

    const record = buildEvidenceRecord(expId, participantToken, missionId, { ...validation, fileUrl: fileUrl || null });
    const evidenceRef = await participantDocRef.collection('evidence').add(record);
    const now = new Date().toISOString();

    await participantDocRef.update({ lastActiveAt: now });
    await db.collection('gamification-audit-logs').add({ expId, participantToken, action: 'gamify_evidence_submit', missionId: String(missionId), createdAt: now });
    await db.collection('audit-logs').add({ userId: 'participante', action: 'gamify_evidence_submit', resource: 'gamified_experience', resourceId: expId, missionId: String(missionId), createdAt: now });

    return { status: 'pending', evidenceId: evidenceRef.id };
  }
);

// U9: el docente propietario (o UTP) aprueba o rechaza una evidencia. La
// aprobación dispara puntos/progreso (idempotente) y retroalimentación docente.
export const reviewMissionEvidence = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const { expId, evidenceId, approve, comment } = request.data || {};
    if (!expId || !evidenceId || typeof approve !== 'boolean') throw new Error('DATOS_INCOMPLETOS');
    await enforceRateLimit(`rev:${request.auth.uid}`, 'gamify_evidence_review');

    const expSnap = await db.collection('gamified-experiences').doc(expId).get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    if (experience.authorUid !== request.auth.uid) throw new Error('ACCESO_NO_AUTORIZADO');

    const participantsSnap = await db.collection('gamified-experiences').doc(expId)
      .collection('participants')
      .where('status', '==', 'active')
      .get();
    let evidenceRef = null;
    let evidence = null;
    let participantToken = null;
    for (const p of participantsSnap.docs) {
      const evSnap = await p.ref.collection('evidence').doc(evidenceId).get();
      if (evSnap.exists) { evidenceRef = evSnap.ref; evidence = evSnap.data(); participantToken = p.id; break; }
    }
    if (!evidenceRef) throw new Error('EVIDENCIA_NO_ENCONTRADA');
    if (evidence.status !== 'pending') throw new Error('EVIDENCIA_YA_REVISADA');

    const now = new Date().toISOString();
    const safeComment = String(comment || '').slice(0, 1000);
    await evidenceRef.update({
      status: approve ? 'approved' : 'rejected',
      reviewerUid: request.auth.uid,
      reviewComment: safeComment,
      reviewedAt: now,
    });

    if (approve) {
      const participantRef = db.collection('gamified-experiences').doc(expId).collection('participants').doc(participantToken);
      const participantSnap = await participantRef.get();
      const mission = (experience.missions || []).find(m => String(m.id) === String(evidence.missionId));
      const totalMissions = Array.isArray(experience.missions) ? experience.missions.length : 0;
      const nextProgress = applyEvidenceApproval(
        participantSnap.exists ? participantSnap.data().progress || {} : {},
        mission || {},
        mission?.points || 0,
        totalMissions
      );
      await participantRef.update({ progress: nextProgress, lastActiveAt: now });
    }

    if (safeComment) {
      const feedback = buildTeacherFeedback(expId, participantToken, evidence.missionId, safeComment);
      await db.collection('gamified-experiences').doc(expId).collection('feedback').add(feedback);
    }

    await db.collection('gamification-audit-logs').add({ expId, participantToken, action: 'gamify_evidence_review', evidenceId, approve, createdAt: now });
    await db.collection('audit-logs').add({ userId: request.auth.uid, action: 'gamify_evidence_review', resource: 'gamified_experience', resourceId: expId, evidenceId, approve, createdAt: now });

    return { status: approve ? 'approved' : 'rejected', evidenceId };
  }
);

// U10: publica la experiencia (estado published) con enlace + código + QR.
export const publishGamifiedExperience = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { experienceId } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!experienceId) throw new Error('EXPERIENCIA_NO_ENCONTRADA');

    const expRef = db.collection('gamified-experiences').doc(experienceId);
    const expSnap = await expRef.get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    const memberRole = experience.orgId ? await getMemberRole(experience.orgId, userId) : null;
    if (experience.authorUid !== userId && !['owner', 'coordinator'].includes(memberRole)) throw new Error('ACCESO_NO_AUTORIZADO');

    const gate = canPublishExperience(experience);
    if (!gate.ok) throw new Error(gate.reason);

    const now = new Date().toISOString();
    const share = buildExperienceSharePayload(experienceId, experience);
    await expRef.update({
      status: 'published',
      code: share.code,
      shortCode: share.shortCode,
      url: share.url,
      qrUrl: share.qrUrl,
      publishedAt: now,
      updatedAt: now,
    });

    await db.collection('gamification-audit-logs').add({ expId: experienceId, action: 'gamify_publish', createdAt: now, uid: userId });
    await db.collection('audit-logs').add({ userId, action: 'gamify_publish', resource: 'gamified_experience', resourceId: experienceId, createdAt: now });

    return { ...share, status: 'published' };
  }
);

// U10: despublica (revoca acceso de participantes; enlace deja de servir).
export const unpublishGamifiedExperience = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const userId = request.auth.uid;
    const { experienceId } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!experienceId) throw new Error('EXPERIENCIA_NO_ENCONTRADA');

    const expRef = db.collection('gamified-experiences').doc(experienceId);
    const expSnap = await expRef.get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    const memberRole = experience.orgId ? await getMemberRole(experience.orgId, userId) : null;
    if (experience.authorUid !== userId && !['owner', 'coordinator'].includes(memberRole)) throw new Error('ACCESO_NO_AUTORIZADO');

    const now = new Date().toISOString();
    await expRef.update({ status: 'paused', shortCode: null, qrUrl: null, updatedAt: now });
    await db.collection('gamification-audit-logs').add({ expId: experienceId, action: 'gamify_unpublish', createdAt: now, uid: userId });
    await db.collection('audit-logs').add({ userId, action: 'gamify_unpublish', resource: 'gamified_experience', resourceId: experienceId, createdAt: now });

    return { status: 'paused' };
  }
);

// U10: archiva la experiencia (fin de ciclo; datos sujetos a retención).
export const archiveGamifiedExperience = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const userId = request.auth.uid;
    const { experienceId } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!experienceId) throw new Error('EXPERIENCIA_NO_ENCONTRADA');

    const expRef = db.collection('gamified-experiences').doc(experienceId);
    const expSnap = await expRef.get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    const memberRole = experience.orgId ? await getMemberRole(experience.orgId, userId) : null;
    if (experience.authorUid !== userId && !['owner', 'coordinator'].includes(memberRole)) throw new Error('ACCESO_NO_AUTORIZADO');

    const now = new Date().toISOString();
    await expRef.update({ status: 'archived', shortCode: null, qrUrl: null, archivedAt: now, updatedAt: now });
    await db.collection('gamification-audit-logs').add({ expId: experienceId, action: 'gamify_archive', createdAt: now, uid: userId });
    await db.collection('audit-logs').add({ userId, action: 'gamify_archive', resource: 'gamified_experience', resourceId: experienceId, createdAt: now });

    return { status: 'archived' };
  }
);

// U10: calcula agregados de progreso para el panel del docente (31, sin ranking).
export const computeExperienceProgress = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const userId = request.auth.uid;
    const { experienceId } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!experienceId) throw new Error('EXPERIENCIA_NO_ENCONTRADA');

    const expSnap = await db.collection('gamified-experiences').doc(experienceId).get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    const memberRole = experience.orgId ? await getMemberRole(experience.orgId, userId) : null;
    if (experience.authorUid !== userId && !['owner', 'coordinator'].includes(memberRole)) throw new Error('ACCESO_NO_AUTORIZADO');

    const participantsSnap = await db.collection('gamified-experiences').doc(experienceId).collection('participants').limit(500).get();
    const participants = participantsSnap.docs.map(p => p.data());

    return {
      experienceId,
      ...calculateExperienceProgress(participants, experience.missions || []),
    };
  }
);

// U13: otorga una insignia de forma idempotente (SEC-03). Función interna, no
// expuesta como callable: la invocan el motor de reglas/eventos tras validar la
// condición. La unicidad la garantiza el doc con id = uniqueKey dentro de una
// transacción (BADGE_DUPLICADO si ya existe). Auditoría gamify_badge; costo 0 IA.
export async function awardInternalBadge(experienceId, participantToken, badgeCode, sourceEvent = {}) {
  if (!experienceId || !participantToken || !badgeCode) throw new Error('DATOS_INCOMPLETOS');
  const uniqueKey = `${experienceId}::${participantToken}::${badgeCode}`;
  const now = new Date().toISOString();
  const award = {
    experienceId, participantToken, badgeCode, uniqueKey,
    earnedAt: now, sourceEvent: sourceEvent.type || 'unknown',
  };

  await db.runTransaction(async (t) => {
    const ref = db.collection('badge-awards').doc(uniqueKey);
    const snap = await t.get(ref);
    if (snap.exists) throw new Error('BADGE_DUPLICADO');
    t.set(ref, award);
  });

  await db.collection('gamification-audit-logs').add({
    expId: experienceId, participantToken, action: 'gamify_badge', badgeCode, createdAt: now,
  });
  await db.collection('audit-logs').add({
    userId: 'participante', action: 'gamify_badge', resource: 'gamified_experience', resourceId: experienceId,
    badgeCode, createdAt: now,
  });
  return { awardId: uniqueKey };
}

// U11: genera un prompt específico para una herramienta externa verificada.
export const generateExternalToolPrompt = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { planningId, tool, resourceType, context } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.externalPromptGeneratorEnabled) throw new Error('FLAG_DESACTIVADO');

    const profile = resolveExternalToolProfile(tool);
    if (!profile) throw new Error('HERRAMIENTA_NO_VERIFICADA');

    const planningSnap = planningId
      ? await db.collection('plannings').doc(planningId).get()
      : null;
    if (planningId && !planningSnap.exists) throw new Error('FUENTE_NO_ENCONTRADA');
    const planning = planningSnap?.exists ? planningSnap.data() : null;
    if (planning && planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const prompt = buildExternalToolPrompt(planning || {}, profile, resourceType, context || {});
    const aiResult = await generateFromProvider(prompt.system, prompt.user, request.data?.useFallback || false);
    const raw = typeof aiResult.content === 'string' ? extractJson(aiResult.content) : aiResult.content;
    const errors = validateExternalToolPrompt(raw || null);
    if (errors.length > 0 || !raw) {
      await db.collection('audit-logs').add({
        userId, action: 'prompt_generate_error', resource: 'external_prompt', tool,
        errors: errors.length ? errors : ['PROMPT_INVALIDO'], createdAt: new Date().toISOString(),
      });
      throw new Error('PROMPT_INVALIDO');
    }

    const now = new Date().toISOString();
    const docRef = await db.collection('external-prompts').add({
      uid: userId,
      planningId: planningId || null,
      tool: profile.tool,
      toolProfileVersion: profile.verificationDate,
      resourceType: String(resourceType || 'presentación'),
      package: buildExternalPromptPackage(null, planning, profile, resourceType, raw),
      aiContributions: [{ model: aiResult.model, provider: aiResult.provider, generatedAt: now }],
      createdAt: now,
    });

    await db.collection('audit-logs').add({
      userId, action: 'prompt_generate', resource: 'external_prompt', resourceId: docRef.id,
      tool: profile.tool, resourceType, createdAt: now,
    });
    await db.collection('ai-costs').add({
      userId, date: now.split('T')[0], provider: aiResult.provider, model: aiResult.model,
      inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, cost: aiResult.cost,
      action: 'prompt_generate', result: 'success', tool: profile.tool,
    });
    await recordBudgetUsage(aiResult.cost);

    return { promptId: docRef.id, ...prompt.data, package: raw };
  }
);

// U11: exporta un paquete generado a texto / markdown / JSON.
export const exportExternalPrompt = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const userId = request.auth.uid;
    const { promptId, format } = request.data || {};
    if (!promptId || !isValidExternalPromptFormat(format)) throw new Error('FORMATO_INVALIDO');

    const promptSnap = await db.collection('external-prompts').doc(promptId).get();
    if (!promptSnap.exists) throw new Error('PROMPT_NO_ENCONTRADO');
    const doc = promptSnap.data();
    if (doc.uid !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const pkg = doc.package || {};
    const content = exportExternalPromptPackage(pkg, format);
    const now = new Date().toISOString();
    await db.collection('audit-logs').add({
      userId, action: 'prompt_export', resource: 'external_prompt', resourceId: promptId,
      format, createdAt: now,
    });

    return { promptId, format, content };
  }
);

// U12: compara la experiencia con la versión actual de la planificación fuente
// y aplica sincronización SOLO de los campos que el docente autorice (nunca overwrite).
export const syncPlanningContext = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    await runRetentionSweep();
    const userId = request.auth.uid;
    const { experienceId } = request.data || {};
    const flags = await getFeatureFlags();
    if (!flags.gamificationModuleEnabled) throw new Error('FLAG_DESACTIVADO');
    if (!experienceId) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    await enforceRateLimit(`pub:${userId}`, 'gamify_publish');

    const expRef = db.collection('gamified-experiences').doc(experienceId);
    const expSnap = await expRef.get();
    if (!expSnap.exists) throw new Error('EXPERIENCIA_NO_ENCONTRADA');
    const experience = expSnap.data();
    if (experience.authorUid !== userId) throw new Error('ACCESO_NO_AUTORIZADO');
    if (!experience.sourcePlanningId) throw new Error('SIN_FUENTE');

    const planningSnap = await db.collection('plannings').doc(experience.sourcePlanningId).get();
    if (!planningSnap.exists) throw new Error('FUENTE_NO_ENCONTRADA');
    const planning = planningSnap.data();
    if (planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const diff = diffGamificationSource(experience, planning);
    const now = new Date().toISOString();
    const result = { ...diff };
    result.applied = [];

    // Sync selectivo: solo si el docente pide campos y hay versión más reciente.
    if (fields && diff.outdated) {
      const { update, applied } = applySelectiveSync(experience, diff.selectiveContext, fields);
      result.applied = applied;
      if (applied.length > 0) {
        await expRef.update({
          ...update,
          sourcePlanningVersionId: planning.version != null ? String(planning.version) : experience.sourcePlanningVersionId,
          version: (experience.version || 0) + 1,
          updatedAt: now,
        });
      }
    }

    await db.collection('gamification-audit-logs').add({
      expId: experienceId, action: 'gamify_sync', data: { applied: result.applied, changeCount: diff.changeCount },
      createdAt: now, uid: userId,
    });
    await db.collection('audit-logs').add({
      userId, action: 'gamify_sync', resource: 'gamified_experience', resourceId: experienceId,
      applied: result.applied, changeCount: diff.changeCount, createdAt: now,
    });

    return result;
  }
);

export const regenerateSection = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) {
      throw new Error('REQUIERE_AUTENTICACION');
    }

    // Retención oportunista (S-6 / 29.3).
    await runRetentionSweep();

    const today = new Date().toISOString().split('T')[0];

    const { planningId, section } = request.data;
    const userId = request.auth.uid;

    const planningDoc = await db.collection('plannings').doc(planningId).get();
    if (!planningDoc.exists) throw new Error('PLANIFICACION_NO_ENCONTRADA');

    const planning = planningDoc.data();
    if (planning.userId !== userId) throw new Error('ACCESO_NO_AUTORIZADO');

    const sectionPrompt = `Genera solo la sección "${section}" para una planificación de ${planning.type || 'clase'}.
Contexto:
- Nivel: ${planning.level}${planning.levels ? ' + ' + planning.levels.join(' + ') : ''}
- Asignatura: ${planning.subject}
- OA: ${planning.learningObjectives?.map(oa => `${oa.code} - ${oa.text?.slice(0, 80)}`).join(' | ')}
- Duración: ${planning.duration} min
- Modalidad: ${planning.modality}

Sección actual: ${JSON.stringify(planning[section] ?? planning.unit?.[section.replace('unit.', '')])}

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
        'unit.classes': ['classes', 'clases'],
        'unit.weeks': ['weeks', 'semanas'],
        'unit.months': ['months', 'meses'],
        'unit.assessment': ['assessment', 'unitAssessment', 'evaluacion', 'evaluación'],
        evaluation: ['evaluation', 'evaluacion', 'evaluación'],
      };

      // B1: whitelist de secciones regenerables (definida a nivel de módulo,
      // ver isRegenerableSection). Los metadatos no son regenerables.
      if (!isRegenerableSection(section)) {
        throw new Error('SECCION_NO_PERMITIDA');
      }

      let newContent = rawContent;
      const candidates = sectionMap[section] || [section];
      for (const key of candidates) {
        if (wrapped && wrapped[key] !== undefined) { newContent = wrapped[key]; break; }
      }

      if (section === 'unit.classes' && Array.isArray(newContent)) {
        newContent = normalizePlanningOutput({ unit: { classes: newContent } }, 'unit').unit?.classes || newContent;
      } else if (section === 'unit.weeks' && Array.isArray(newContent)) {
        newContent = normalizePlanningOutput({ unit: { weeks: newContent } }, 'monthly').unit?.weeks || newContent;
      } else if (section === 'unit.months' && Array.isArray(newContent)) {
        newContent = normalizePlanningOutput({ unit: { months: newContent } }, 'annual').unit?.months || newContent;
      } else if (section === 'activities' && Array.isArray(newContent)) {
        newContent = normalizePlanningOutput({ activities: newContent }).activities;
      }
      if ((section === 'assessment' || section === 'unit.assessment') && newContent && typeof newContent === 'object') {
        newContent = normalizePlanningOutput({ assessment: newContent }).assessment;
      }
      if (section === 'evaluation' && newContent && typeof newContent === 'object') {
        newContent = normalizePlanningOutput({ evaluation: newContent }, 'evaluation').evaluation;
      }
      if ((section === 'purpose' || section === 'differentiation') && typeof newContent === 'string') {
        newContent = newContent.replace(/^["']|["']$/g, '');
      }

      const update = { updatedAt: new Date().toISOString(), version: (planning.version || 1) + 1 };
      if (section.startsWith('unit.')) {
        const key = section.replace('unit.', '');
        update.unit = { ...(planning.unit || {}), [key]: newContent };
      } else {
        update[section] = newContent;
      }
      await db.collection('plannings').doc(planningId).update(update);

      // B4: la regeneración debe registrarse bajo control de costos (ai-costs +
      // budget-usage) para que el kill-switch de presupuesto y la trazabilidad
      // la contabilicen.
      await db.collection('ai-costs').add({
        userId,
        date: today,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost,
        planningId,
        section,
        action: 'regenerate',
        createdAt: new Date().toISOString(),
      });
      await recordBudgetUsage(result.cost);

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
    const memberRole = await getMemberRole(planning.orgId, userId);
    if (!canApprovePlanning(userId, planning, memberRole)) throw new Error('ACCESO_NO_AUTORIZADO');
    const isOwner = planning.userId === userId;

    await planningRef.update({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: isOwner ? userId : 'utp:' + userId,
      updatedAt: new Date().toISOString(),
    });

    await db.collection('audit-logs').add({
      userId,
      action: 'approve',
      resource: 'planning',
      resourceId: planningId,
      role: isOwner ? 'owner' : 'coordinator',
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

// ─── S-3: ORGANIZACIONES Y ROLES ─────────────────────────


async function getOrgDoc(orgId) {
  const snap = await db.collection('organizations').doc(orgId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getOrgMember(orgId, uid) {
  if (!orgId) return null;
  const snap = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function requireOrgAdmin(orgId, uid) {
  const member = await getOrgMember(orgId, uid);
  if (!member || !['owner', 'coordinator'].includes(member.role)) {
    throw new Error('ACCESO_NO_AUTORIZADO');
  }
  return member;
}

async function getMemberRole(orgId, uid) {
  const m = await getOrgMember(orgId, uid);
  return m ? m.role : null;
}


export const setUserRole = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const { targetUid, role } = request.data || {};
    if (!targetUid || !VALID_ROLES.includes(role)) throw new Error('DATOS_INVALIDOS');
    if (request.auth.token.admin !== true) throw new Error('ACCESO_NO_AUTORIZADO');

    await auth.setCustomUserClaims(targetUid, { role });
    await db.collection('users').doc(targetUid).set({ role, updatedAt: new Date().toISOString() }, { merge: true });
    await db.collection('audit-logs').add({
      userId: request.auth.uid, action: 'set-role', resource: 'user', resourceId: targetUid, role, createdAt: new Date().toISOString(),
    });
    return { success: true, role };
  }
);

// Asigna el plan freemium de un usuario (S-7). Solo admin. Deja trazabilidad.
export const setUserPlan = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    if (request.auth.token.admin !== true) throw new Error('ACCESO_NO_AUTORIZADO');
    const { targetUid, plan } = request.data || {};
    if (!targetUid || !['free', 'pro'].includes(plan)) throw new Error('DATOS_INVALIDOS');
    const now = new Date().toISOString();
    await db.collection('users').doc(targetUid).set({ plan, updatedAt: now }, { merge: true });
    // Refleja el plan en el doc del miembro de la org (si existe) para que el panel
    // institucional muestre el plan actual al recargar.
    const adminSnap = await db.collection('users').doc(request.auth.uid).get();
    const adminOrgId = adminSnap.data()?.orgId;
    if (adminOrgId) {
      await db.collection('organizations').doc(adminOrgId).collection('members').doc(targetUid).set({ plan, updatedAt: now }, { merge: true });
    }
    await db.collection('audit-logs').add({
      userId: request.auth.uid, action: 'set-plan', resource: 'user', resourceId: targetUid, plan, createdAt: now,
    });
    return { success: true, plan };
  }
);

export const createOrganization = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const name = sanitizeOrgName(request.data?.name);
    if (!name) throw new Error('DATOS_INVALIDOS');
    const userId = request.auth.uid;

    // Un usuario solo puede tener una organización como owner.
    const existingOwner = await db.collection('organizations').where('ownerUid', '==', userId).limit(1).get();
    if (!existingOwner.empty) throw new Error('YA_TIENES_ORGANIZACION');

    const orgRef = db.collection('organizations').doc();
    const now = new Date().toISOString();
    await orgRef.set({
      name,
      ownerUid: userId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await orgRef.collection('members').doc(userId).set({
      uid: userId,
      displayName: request.auth.token.name || request.auth.token.email || '',
      email: request.auth.token.email || '',
      role: 'owner',
      joinedAt: now,
    });
    await db.collection('users').doc(userId).set({ orgId: orgRef.id, role: 'coordinator', updatedAt: now }, { merge: true });

    await db.collection('audit-logs').add({
      userId, action: 'create-org', resource: 'organization', resourceId: orgRef.id, createdAt: now,
    });

    return { success: true, orgId: orgRef.id, name };
  }
);

export const inviteMember = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const { orgId, email, role } = request.data || {};
    const userId = request.auth.uid;
    if (!orgId || !email || !['teacher', 'coordinator'].includes(role)) throw new Error('DATOS_INVALIDOS');

    await requireOrgAdmin(orgId, userId);
    const org = await getOrgDoc(orgId);
    if (!org) throw new Error('ORGANIZACION_NO_ENCONTRADA');

    const cleanEmail = String(email).trim().toLowerCase();
    // No invitar a alguien que ya es miembro
    const memberSnap = await db.collection('organizations').doc(orgId).collection('members').where('email', '==', cleanEmail).limit(1).get();
    if (!memberSnap.empty) throw new Error('YA_ES_MIEMBRO');

    const token = generateInviteToken();
    const inviteRef = await db.collection('organizations').doc(orgId).collection('invitations').add({
      email: cleanEmail,
      role,
      token,
      status: 'pending',
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });

    await db.collection('audit-logs').add({
      userId, action: 'invite', resource: 'organization', resourceId: orgId, email: cleanEmail, role, createdAt: new Date().toISOString(),
    });

    return { success: true, inviteId: inviteRef.id, token, link: `https://planificacion-con-ia.web.app/#/unirme/${orgId}/${token}` };
  }
);

export const acceptInvite = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const { orgId, token } = request.data || {};
    const userId = request.auth.uid;
    const userEmail = String(request.auth.token.email || '').toLowerCase();
    if (!orgId || !token) throw new Error('DATOS_INVALIDOS');

    const org = await getOrgDoc(orgId);
    if (!org) throw new Error('ORGANIZACION_NO_ENCONTRADA');

    const inviteSnap = await db.collection('organizations').doc(orgId).collection('invitations')
      .where('token', '==', token).where('status', '==', 'pending').limit(1).get();
    if (inviteSnap.empty) throw new Error('INVITACION_INVALIDA');

    const invite = inviteSnap.docs[0].data();
    if (String(invite.email || '').toLowerCase() !== userEmail) throw new Error('EMAIL_NO_COINCIDE');
    if (new Date(invite.expiresAt) < new Date()) throw new Error('INVITACION_EXPIRADA');

    const existingMember = await db.collection('organizations').doc(orgId).collection('members').doc(userId).get();
    if (!existingMember.exists) {
      await db.collection('organizations').doc(orgId).collection('members').doc(userId).set({
        uid: userId,
        displayName: request.auth.token.name || userEmail,
        email: userEmail,
        role: invite.role,
        joinedAt: new Date().toISOString(),
      });
    }
    await inviteSnap.docs[0].ref.update({ status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: userId });
    await db.collection('users').doc(userId).set({ orgId, updatedAt: new Date().toISOString() }, { merge: true });

    await db.collection('audit-logs').add({
      userId, action: 'accept-invite', resource: 'organization', resourceId: orgId, role: invite.role, createdAt: new Date().toISOString(),
    });

    return { success: true, orgId, role: invite.role };
  }
);

export const removeMember = onCall(
  { cors: ['https://planificacion-con-ia.web.app'] },
  async (request) => {
    if (!request.auth) throw new Error('REQUIERE_AUTENTICACION');
    const { orgId, targetUid } = request.data || {};
    const userId = request.auth.uid;
    if (!orgId || !targetUid) throw new Error('DATOS_INVALIDOS');
    if (targetUid === userId) throw new Error('NO_PUEDES_REMOVERTE');

    await requireOrgAdmin(orgId, userId);
    const targetMember = await getOrgMember(orgId, targetUid);
    if (!targetMember) throw new Error('MIEMBRO_NO_ENCONTRADO');
    if (targetMember.role === 'owner') throw new Error('NO_PUEDES_REMOVER_OWNER');

    await db.collection('organizations').doc(orgId).collection('members').doc(targetUid).delete();
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (userDoc.exists && userDoc.data().orgId === orgId) {
      await db.collection('users').doc(targetUid).update({ orgId: null, updatedAt: new Date().toISOString() });
    }

    await db.collection('audit-logs').add({
      userId, action: 'remove-member', resource: 'organization', resourceId: orgId, targetUid, createdAt: new Date().toISOString(),
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
  const typeLabels = { class: 'Clase', unit: 'Unidad didactica', monthly: 'Mensual', annual: 'Anual', evaluation: 'Evaluacion', multigrade: 'Multigrado' };
  const infoData = [
    ['Tipo', typeLabels[planning.type] || 'Clase'],
    ['Nivel', planning.levels?.length ? planning.levels.join(' + ') : (planning.level || '-')],
    ['Asignatura', planning.subject || '-'], ['Unidad', planning.unit || '-'],
    ['Duracion', planning.type === 'annual' ? 'Ano lectivo' : `${planning.duration || '-'} min`], ['Modalidad', planning.modality || '-'],
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

  // ── UNIDAD DIDÁCTICA ────────────────────────────────
  if (planning.type === 'unit' && planning.unit) {
    const unit = planning.unit;
    if (unit.title) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Unidad: ' + unit.title, bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    }
    if (unit.description) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Secuencia didactica', bold: true, size: 20 })], spacing: { before: 200, after: 40 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: unit.description, size: 20 })], spacing: { after: 120 } }));
    }
    (unit.classes || []).forEach((clase) => {
      children.push(new Paragraph({ children: [new TextRun({ text: `Clase ${clase.number}: ${clase.title}`, bold: true, size: 20, color: '2563eb' })], spacing: { before: 250, after: 60 } }));
      if (clase.purpose) children.push(new Paragraph({ children: [new TextRun({ text: clase.purpose, size: 20 })], spacing: { after: 40 } }));
      if (clase.oaCodes?.length) children.push(new Paragraph({ children: [new TextRun({ text: `OA: ${clase.oaCodes.join(', ')}`, size: 18, color: '666666' })], spacing: { after: 40 } }));
      const moments = { inicio: 'Inicio', desarrollo: 'Desarrollo', cierre: 'Cierre' };
      ['inicio', 'desarrollo', 'cierre'].forEach(moment => {
        const acts = (clase.activities || []).filter(a => a.moment === moment);
        if (acts.length === 0) return;
        children.push(new Paragraph({ children: [new TextRun({ text: moments[moment], bold: true, size: 18, color: '2563eb' })], spacing: { before: 100, after: 40 } }));
        acts.forEach((act, i) => {
          children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${act.title || act.description || 'Actividad'} (${act.duration || '-'} min)`, bold: true, size: 18 })], spacing: { before: 60, after: 20 } }));
          if (act.description && act.description !== act.title) {
            children.push(new Paragraph({ children: [new TextRun({ text: act.description, size: 18 })], spacing: { after: 20 } }));
          }
          if (act.evidence) children.push(new Paragraph({ children: [new TextRun({ text: `Evidencia: ${act.evidence}`, size: 16, color: '666666' })], spacing: { after: 40 } }));
        });
      });
      if (clase.assessment?.criteria?.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Criterios clase: ${clase.assessment.criteria.join('; ')}`, size: 16, color: '666666' })], spacing: { after: 40 } }));
      }
    });
    if (unit.assessment) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Evaluacion de unidad', bold: true, size: 20 })], spacing: { before: 250, after: 60 } }));
      if (unit.assessment.type) children.push(new Paragraph({ children: [new TextRun({ text: `Tipo: ${unit.assessment.type}`, size: 18 })], spacing: { after: 40 } }));
      if (unit.assessment.criteria?.length) {
        unit.assessment.criteria.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: `- ${c}`, size: 18 })], spacing: { after: 40 } })));
      }
      if (unit.assessment.feedbackStrategy) children.push(new Paragraph({ children: [new TextRun({ text: `Retroalimentacion: ${unit.assessment.feedbackStrategy}`, size: 18 })], spacing: { after: 200 } }));
    }
  }

  // ── MENSUAL ─────────────────────────────────────────
  if (planning.type === 'monthly' && planning.unit) {
    const unit = planning.unit;
    if (unit.description) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Descripcion general', bold: true, size: 20 })], spacing: { before: 200, after: 40 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: unit.description, size: 20 })], spacing: { after: 120 } }));
    }
    (unit.weeks || []).forEach((semana) => {
      children.push(new Paragraph({ children: [new TextRun({ text: `Semana ${semana.number}: ${semana.topic}`, bold: true, size: 20, color: '2563eb' })], spacing: { before: 250, after: 60 } }));
      if (semana.oaCodes?.length) children.push(new Paragraph({ children: [new TextRun({ text: `OA: ${semana.oaCodes.join(', ')}`, size: 18, color: '666666' })], spacing: { after: 40 } }));
      (semana.activities || []).forEach((act, i) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${act.title || act.description || 'Actividad'} (${act.duration || '-'} min)`, bold: true, size: 18 })], spacing: { before: 60, after: 20 } }));
        if (act.description && act.description !== act.title) {
          children.push(new Paragraph({ children: [new TextRun({ text: act.description, size: 18 })], spacing: { after: 20 } }));
        }
      });
      if (semana.assessment?.criteria?.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Criterios semana: ${semana.assessment.criteria.join('; ')}`, size: 16, color: '666666' })], spacing: { after: 40 } }));
      }
    });
    if (unit.assessment) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Evaluacion del mes', bold: true, size: 20 })], spacing: { before: 250, after: 60 } }));
      if (unit.assessment.criteria?.length) {
        unit.assessment.criteria.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: `- ${c}`, size: 18 })], spacing: { after: 40 } })));
      }
      if (unit.assessment.feedbackStrategy) children.push(new Paragraph({ children: [new TextRun({ text: `Retroalimentacion: ${unit.assessment.feedbackStrategy}`, size: 18 })], spacing: { after: 200 } }));
    }
  }

  // ── ANUAL ──────────────────────────────────────────
  if (planning.type === 'annual' && planning.unit) {
    const unit = planning.unit;
    if (unit.description) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Distribucion anual', bold: true, size: 20 })], spacing: { before: 200, after: 40 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: unit.description, size: 20 })], spacing: { after: 120 } }));
    }
    (unit.months || []).forEach((mes) => {
      children.push(new Paragraph({ children: [new TextRun({ text: `Mes ${mes.number}: ${mes.name || ''}`, bold: true, size: 18, color: '2563eb' })], spacing: { before: 120, after: 40 } }));
      if (mes.topic) children.push(new Paragraph({ children: [new TextRun({ text: `Tema: ${mes.topic}`, size: 18 })], spacing: { after: 20 } }));
      if (mes.oaCodes?.length) children.push(new Paragraph({ children: [new TextRun({ text: `OA: ${mes.oaCodes.join(', ')}`, size: 16, color: '666666' })], spacing: { after: 20 } }));
      if (mes.notes) children.push(new Paragraph({ children: [new TextRun({ text: mes.notes, size: 16, color: '666666' })], spacing: { after: 40 } }));
    });
    if (unit.assessment) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Evaluacion anual', bold: true, size: 20 })], spacing: { before: 250, after: 60 } }));
      if (unit.assessment.criteria?.length) {
        unit.assessment.criteria.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: `- ${c}`, size: 18 })], spacing: { after: 40 } })));
      }
      if (unit.assessment.feedbackStrategy) children.push(new Paragraph({ children: [new TextRun({ text: `Retroalimentacion: ${unit.assessment.feedbackStrategy}`, size: 18 })], spacing: { after: 200 } }));
    }
  }

  // ── EVALUACIÓN STANDALONE ──────────────────────────
  if (planning.type === 'evaluation' && planning.evaluation) {
    const ev = planning.evaluation;
    children.push(new Paragraph({ children: [new TextRun({ text: 'Evaluacion', bold: true, size: 22 })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Tipo: ${ev.type || '-'}`, size: 20 })], spacing: { after: 40 } }));
    if (ev.instrument?.length) children.push(new Paragraph({ children: [new TextRun({ text: `Instrumento: ${ev.instrument.join(', ')}`, size: 20 })], spacing: { after: 60 } }));
    if (ev.description) children.push(new Paragraph({ children: [new TextRun({ text: ev.description, size: 20 })], spacing: { after: 120 } }));
    if (ev.indicators?.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Indicadores de logro:', bold: true, size: 20 })], spacing: { after: 40 } }));
      ev.indicators.forEach(ind => children.push(new Paragraph({ children: [new TextRun({ text: `- ${ind}`, size: 20 })], spacing: { after: 40 } })));
    }
    if (ev.rubric?.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Rubrica', bold: true, size: 20 })], spacing: { before: 200, after: 60 } }));
      ev.rubric.forEach(dim => {
        children.push(new Paragraph({ children: [new TextRun({ text: `Dimension: ${dim.dimension || dim.name || '-'}`, bold: true, size: 18, color: '2563eb' })], spacing: { before: 100, after: 40 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: `Logrado: ${dim.logrado || '-'}`, size: 16 })], spacing: { after: 20 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: `Medio: ${dim.medio || '-'}`, size: 16 })], spacing: { after: 20 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: `En desarrollo: ${dim.enDesarrollo || '-'}`, size: 16 })], spacing: { after: 40 } }));
      });
    }
    if (ev.criteria?.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Criterios:', bold: true, size: 20 })], spacing: { before: 100, after: 40 } }));
      ev.criteria.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: `- ${c}`, size: 20 })], spacing: { after: 40 } })));
    }
    if (ev.feedbackStrategy) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Retroalimentacion: ${ev.feedbackStrategy}`, size: 20 })], spacing: { after: 200 } }));
    }
  }

  // Activities (clase y multigrado)
  if ((planning.type === 'class' || planning.type === 'multigrade') && planning.activities?.length > 0) {
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
        if (act.targetLevel) {
          children.push(new Paragraph({ children: [new TextRun({ text: `Nivel: ${act.targetLevel}`, size: 16, color: '2563eb' })], spacing: { after: 40 } }));
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

  // Assessment (clase y multigrado)
  if ((planning.type === 'class' || planning.type === 'multigrade') && planning.assessment) {
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
      logger.warn('Evento crítico de auditoría:', { action: log.action, resource: log.resource, userId: log.userId });
    }
  }
);

// ─── S-6: Cumplimiento legal y accesibilidad ─────────────

// Versiones vigentes de términos y privacidad (RF-013: aceptación versionada).
// Cambiar estos valores al publicar una nueva versión fuerza re-aceptación.

// Barrido de retención con tope por colección (evita picos de latencia). Se
// ejecuta de forma oportunista desde las funciones de mayor tráfico en lugar de
// un Cloud Scheduler (la SA de CI no tiene cloudscheduler.jobs.update).
const RETENTION_SWEEP_CAP = 20;

export async function runRetentionSweep(cap = RETENTION_SWEEP_CAP) {
  const report = {};
  for (const [name, policy] of Object.entries(RETENTION_POLICY)) {
    const cutoff = retentionCutoffIso(policy.days);
    const snap = await db.collection(name).where(policy.field || 'createdAt', '<', cutoff).limit(cap).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    report[name] = snap.size;
  }
  // U13: purga de subcolecciones de experiencias (participants/evidence/feedback)
  // vía collectionGroup. Se ignora la falla de índice (CI no despliega índices).
  for (const [name, policy] of Object.entries(SUBCOLLECTION_RETENTION_POLICY)) {
    try {
      const cutoff = retentionCutoffIso(policy.days);
      const snap = await db.collectionGroup(name).where(policy.field || 'createdAt', '<', cutoff).limit(cap).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      report[`${name}*`] = snap.size;
    } catch (error) {
      report[`${name}*`] = `skip:${error.message.slice(0, 40)}`;
    }
  }
  return report;
}

// Aceptación versionada de términos/privacidad. Guarda versión + fecha en el
// perfil del usuario y deja trazabilidad en audit-logs. El frontend muestra un
// modal de re-consentimiento cuando la versión vigente no coincide.
export const acceptTerms = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('REQUIERE_AUTENTICACION');
  const error = validateTermsAcceptance(request.data);
  if (error) throw new Error(error);
  const now = new Date().toISOString();
  await db.collection('users').doc(userId).update({
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: now,
    privacyVersion: PRIVACY_VERSION,
    privacyAcceptedAt: now,
    updatedAt: now,
  });
  await db.collection('audit-logs').add({
    userId,
    action: 'accept-terms',
    resource: 'user',
    resourceId: userId,
    version: TERMS_VERSION,
    createdAt: now,
  });
  return { ok: true, version: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, acceptedAt: now };
});

// Purga oportunista de datos vencidos (S-6 / 29.3). Se ejecuta desde las
// funciones de mayor tráfico (generatePlanning/regenerateSection) con tope por
// colección. Un Cloud Scheduler sería el mecanismo ideal, pero la SA de CI no
// tiene cloudscheduler.jobs.update (misma limitación IAM que firestore.rules),
// por lo que el barrido en línea es el sustituto pragmático desplegable.
// Cuando la SA tenga el rol, se puede reinstalar onSchedule + cleanupRetention.
// Se deja la declaración de la política y el cutoff en este archivo para tests.
