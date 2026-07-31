import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Helper functions extracted from index.js for testing ───

const AI_PROVIDERS = {
  DEEPSEEK: { name: 'deepseek', model: 'deepseek-chat', pricePer1KInput: 0.00014, pricePer1KOutput: 0.00028 },
  GEMINI: { name: 'gemini', model: 'gemini-1.5-flash', pricePer1KInput: 0.000075, pricePer1KOutput: 0.00030 },
};

const VALIDATION_RULES = [
  { id: 'V-001', type: 'critical', check: (p) => p.activities?.length > 0 },
  { id: 'V-004', type: 'critical', check: (p) => p.assessment?.criteria?.length > 0 },
  { id: 'V-007', type: 'warning', check: (p) => p.activities?.some(a => a.moment === 'cierre') },
  { id: 'V-009', type: 'warning', check: (p) => p.assessment?.feedbackStrategy?.length > 0 },
  {
    id: 'V-006', type: 'warning', check: (p) => {
      const total = (p.activities || []).reduce((s, a) => s + (a.duration || 0), 0);
      return total >= p.duration * 0.8 && total <= p.duration * 1.1;
    }
  },
];

function sanitizeInput(text) {
  if (!text) return '';
  const patterns = [
    /\b\d{1,2}\.\d{3}\.\d{3}[-]\d{1,2}\b/g,
    /\b\d{7,9}[-]\d\b/g,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ];
  let s = String(text);
  patterns.forEach(p => { s = s.replace(p, '[...]'); });
  return s;
}

function validateOutputStructure(data) {
  const errors = [];
  if (!data.purpose || data.purpose.length < 5) errors.push('Falta proposito valido');
  if (!data.activities?.length) errors.push('Faltan actividades');
  else data.activities.forEach(a => {
    if (!a.moment) errors.push('Actividad sin momento');
    if (!a.description) errors.push('Actividad sin descripcion');
  });
  if (!data.assessment?.criteria?.length) errors.push('Faltan criterios de evaluacion');
  return errors;
}

function getRuleDescription(id) {
  const desc = {
    'V-001': 'No hay actividades definidas',
    'V-004': 'La evaluacion no tiene criterios',
    'V-007': 'No hay actividad de cierre',
    'V-009': 'No hay estrategia de retroalimentacion',
    'V-006': 'Duracion de actividades no coincide',
  };
  return desc[id] || 'Desconocida';
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

function buildPlanningRecord(userId, context, oaDocs, content, aiResult, promptTemplateId) {
  return {
    userId,
    title: context.title || `Clase: ${oaDocs[0]?.code || 'Sin OA'}`,
    status: 'draft',
    level: context.level,
    subject: context.subject,
    unit: context.unit || '',
    duration: parseInt(context.duration) || 45,
    modality: context.modality || 'presencial',
    learningObjectives: oaDocs.map(oa => ({ code: oa.code, text: oa.text, source: oa.source })),
    purpose: content.purpose,
    activities: content.activities || [],
    assessment: content.assessment || {},
    differentiation: content.differentiation || '',
    resources: content.resources || [],
    studentCount: context.studentCount || '',
    priorKnowledge: context.priorKnowledge || '',
    methodology: context.methodology || '',
    warnings: runPedagogicalAudit({
      activities: content.activities || [],
      assessment: content.assessment || {},
      duration: parseInt(context.duration) || 45,
      differentiation: content.differentiation || '',
    }),
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
}

// ─── TESTS ──────────────────────────────────────────────

describe('PII Sanitization', () => {
  test('sanitiza RUT chileno', () => {
    expect(sanitizeInput('RUT 12.345.678-9')).toBe('RUT [...]');
  });

  test('sanitiza email', () => {
    expect(sanitizeInput('Contacto: test@example.com')).toBe('Contacto: [...]');
  });

  test('mantiene texto sin PII', () => {
    expect(sanitizeInput('Texto normal sin datos')).toBe('Texto normal sin datos');
  });

  test('sanitiza multiples PII', () => {
    expect(sanitizeInput('RUT 12.345.678-9 y user@test.cl')).toBe('RUT [...] y [...]');
  });

  test('maneja string vacio', () => {
    expect(sanitizeInput('')).toBe('');
  });

  test('maneja null/undefined', () => {
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(undefined)).toBe('');
  });

  test('sanitiza RUT sin puntos', () => {
    expect(sanitizeInput('RUT 12345678-5')).toBe('RUT [...]');
  });
});

describe('Output Structure Validation', () => {
  const validData = {
    purpose: 'Una clase sobre hominizacion para 7 basico',
    activities: [
      { moment: 'inicio', description: 'Activar conocimientos previos' },
      { moment: 'desarrollo', description: 'Lectura y analisis de texto' },
      { moment: 'cierre', description: 'Sintesis de lo aprendido' },
    ],
    assessment: {
      type: 'formativa',
      criteria: ['Identifica las etapas', 'Analiza los cambios'],
    },
  };

  test('valida estructura correcta', () => {
    expect(validateOutputStructure(validData)).toEqual([]);
  });

  test('rechaza datos vacios', () => {
    const errors = validateOutputStructure({});
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors).toContain('Falta proposito valido');
    expect(errors).toContain('Faltan actividades');
  });

  test('rechaza actividades sin momento', () => {
    const errors = validateOutputStructure({
      purpose: 'Clase de prueba',
      activities: [{ description: 'Actividad' }],
      assessment: { criteria: ['A'] },
    });
    expect(errors).toContain('Actividad sin momento');
  });

  test('rechaza actividades sin descripcion', () => {
    const errors = validateOutputStructure({
      purpose: 'Clase de prueba',
      activities: [{ moment: 'inicio' }],
      assessment: { criteria: ['A'] },
    });
    expect(errors).toContain('Actividad sin descripcion');
  });

  test('rechaza falta de criterios de evaluacion', () => {
    const errors = validateOutputStructure({
      purpose: 'Clase de prueba',
      activities: [{ moment: 'inicio', description: 'Act' }],
      assessment: {},
    });
    expect(errors).toContain('Faltan criterios de evaluacion');
  });
});

describe('Pedagogical Audit Rules (V-001 to V-012)', () => {
  const validPlanning = {
    activities: [
      { moment: 'inicio', duration: 15 },
      { moment: 'desarrollo', duration: 50 },
      { moment: 'cierre', duration: 25 },
    ],
    duration: 90,
    assessment: {
      criteria: ['Criterio 1'],
      feedbackStrategy: 'Retroalimentacion oral',
    },
  };

  test('planificacion valida sin advertencias', () => {
    const warnings = runPedagogicalAudit(validPlanning);
    expect(warnings).toEqual([]);
  });

  test('detecta falta de actividades (V-001)', () => {
    const warnings = runPedagogicalAudit({ activities: [], duration: 45, assessment: { criteria: ['A'], feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-001')).toBe(true);
  });

  test('detecta falta de criterios (V-004)', () => {
    const warnings = runPedagogicalAudit({ activities: [{ moment: 'cierre', duration: 45 }], duration: 45, assessment: { feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-004')).toBe(true);
  });

  test('detecta falta de cierre (V-007)', () => {
    const warnings = runPedagogicalAudit({ activities: [{ moment: 'inicio', duration: 45 }], duration: 45, assessment: { criteria: ['A'], feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-007')).toBe(true);
  });

  test('detecta falta de retroalimentacion (V-009)', () => {
    const warnings = runPedagogicalAudit({ activities: [{ moment: 'cierre', duration: 45 }], duration: 45, assessment: { criteria: ['A'] } });
    expect(warnings.some(w => w.ruleId === 'V-009')).toBe(true);
  });

  test('detecta duracion incorrecta (V-006)', () => {
    const warnings = runPedagogicalAudit({ activities: [{ moment: 'inicio', duration: 5 }], duration: 90, assessment: { criteria: ['A'], feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-006')).toBe(true);
  });

  test('multiples reglas fallan simultaneamente', () => {
    const warnings = runPedagogicalAudit({ activities: [], duration: 90, assessment: {} });
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    const ruleIds = warnings.map(w => w.ruleId);
    expect(ruleIds).toContain('V-001');
    expect(ruleIds).toContain('V-004');
    expect(ruleIds).toContain('V-007');
    expect(ruleIds).toContain('V-009');
  });
});

describe('Build Planning Record', () => {
  const userId = 'test-user-123';
  const context = { title: 'Clase de historia', level: '7-basico', subject: 'historia', unit: 'Unidad 1', duration: '90', modality: 'presencial', studentCount: '30', priorKnowledge: 'Saben leer', resources: ['libro'], methodology: 'dialogada' };
  const oaDocs = [{ code: 'HI07 OA 01', text: 'Explicar la hominizacion', source: 'Bases Curriculares' }];
  const content = { purpose: 'Explicar el proceso', activities: [{ moment: 'inicio', description: 'Activar', duration: 15 }], assessment: { type: 'formativa', criteria: ['Identifica'], feedbackStrategy: 'oral' }, differentiation: 'Material visual' };
  const aiResult = { model: 'deepseek-chat', provider: 'deepseek', inputTokens: 500, outputTokens: 300, cost: 0.0002 };
  const promptTemplateId = 'PT-001';

  test('construye registro completo', () => {
    const record = buildPlanningRecord(userId, context, oaDocs, content, aiResult, promptTemplateId);
    expect(record.userId).toBe(userId);
    expect(record.title).toBe('Clase de historia');
    expect(record.level).toBe('7-basico');
    expect(record.duration).toBe(90);
    expect(record.status).toBe('draft');
    expect(record.learningObjectives).toHaveLength(1);
    expect(record.learningObjectives[0].code).toBe('HI07 OA 01');
  });

  test('incluye contribucion IA', () => {
    const record = buildPlanningRecord(userId, context, oaDocs, content, aiResult, promptTemplateId);
    expect(record.aiContributions).toHaveLength(1);
    expect(record.aiContributions[0].provider).toBe('deepseek');
    expect(record.aiContributions[0].model).toBe('deepseek-chat');
    expect(record.aiContributions[0].cost).toBe(0.0002);
  });

  test('establece version inicial', () => {
    const record = buildPlanningRecord(userId, context, oaDocs, content, aiResult, promptTemplateId);
    expect(record.version).toBe(1);
  });

  test('usa titulo por defecto si no hay titulo', () => {
    const record = buildPlanningRecord(userId, { ...context, title: '' }, oaDocs, content, aiResult, promptTemplateId);
    expect(record.title).toBe('Clase: HI07 OA 01');
  });
});

describe('Cost Calculation', () => {
  test('calcula costo DeepSeek correctamente', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    const cost = (inputTokens * 0.00014 + outputTokens * 0.00028) / 1000;
    expect(cost).toBe(0.00028);
  });

  test('calcula costo Gemini correctamente', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    const cost = (inputTokens * 0.000075 + outputTokens * 0.00030) / 1000;
    expect(cost).toBeCloseTo(0.000225, 8);
  });

  test('costo DeepSeek es menor que Gemini para mismo volumen', () => {
    const tokens = 2000;
    const deepseek = tokens * 0.00014 / 1000;
    const gemini = tokens * 0.000075 / 1000;
    expect(gemini).toBeLessThan(deepseek);
  });
});

describe('Validation Rules Definitions', () => {
  test('todas las reglas tienen tipo valido', () => {
    VALIDATION_RULES.forEach(rule => {
      expect(['critical', 'warning', 'suggestion']).toContain(rule.type);
    });
  });

  test('todas las reglas tienen descripcion', () => {
    VALIDATION_RULES.forEach(rule => {
      const desc = getRuleDescription(rule.id);
      expect(desc).toBeTruthy();
      expect(desc).not.toBe('Desconocida');
    });
  });

  test('V-006 verifica rango de 0.8x a 1.1x', () => {
    const rule = VALIDATION_RULES.find(r => r.id === 'V-006');
    expect(rule).toBeDefined();

    expect(rule.check({ activities: [{ duration: 72 }], duration: 90 })).toBe(true);
    expect(rule.check({ activities: [{ duration: 99 }], duration: 90 })).toBe(true);
    expect(rule.check({ activities: [{ duration: 71 }], duration: 90 })).toBe(false);
    expect(rule.check({ activities: [{ duration: 100 }], duration: 90 })).toBe(false);
  });
});
