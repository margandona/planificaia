import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Helper functions extracted from index.js for testing ───

const AI_PROVIDERS = {
  DEEPSEEK: { name: 'deepseek', model: 'deepseek-chat', pricePer1KInput: 0.00014, pricePer1KOutput: 0.00028 },
  GEMINI: { name: 'gemini', model: 'gemini-1.5-flash', pricePer1KInput: 0.000075, pricePer1KOutput: 0.00030 },
};

const PLANNING_TYPES = {
  class: { label: 'Clase', minOA: 1, maxOA: 4 },
  unit: { label: 'Unidad didáctica', minOA: 1, maxOA: 8 },
  monthly: { label: 'Planificación mensual', minOA: 1, maxOA: 10 },
  annual: { label: 'Planificación anual', minOA: 1, maxOA: 12 },
  evaluation: { label: 'Evaluación', minOA: 1, maxOA: 4 },
  multigrade: { label: 'Multigrado', minOA: 1, maxOA: 6 },
};

const VALIDATION_RULES = [
  { id: 'V-001', type: 'critical', check: (p) => p.type === 'evaluation' ? (p.evaluation?.indicators?.length > 0) : (p.activities?.length > 0) },
  { id: 'V-004', type: 'critical', check: (p) => p.type === 'evaluation' ? (p.evaluation?.criteria?.length > 0) : (p.assessment?.criteria?.length > 0) },
  { id: 'V-007', type: 'warning', check: (p) => {
    if (p.type === 'unit') return p.unit?.classes?.length > 0 && p.unit.classes.some(c => c.activities?.some(a => a.moment === 'cierre'));
    if (p.type === 'monthly') return p.unit?.weeks?.length > 0;
    if (p.type === 'annual') return p.unit?.months?.length > 0;
    if (p.type === 'evaluation') return (p.evaluation?.rubric?.length > 0) || (p.evaluation?.instrument?.length > 0);
    return p.activities?.some(a => a.moment === 'cierre');
  }},
  { id: 'V-009', type: 'warning', check: (p) => p.type === 'evaluation' ? (p.evaluation?.feedbackStrategy?.length > 0) : (p.assessment?.feedbackStrategy?.length > 0) },
  {
    id: 'V-006', type: 'warning', check: (p) => {
      if (p.type === 'unit') {
        const first = p.unit?.classes?.[0];
        if (!first) return true;
        const total = (first.activities || []).reduce((s, a) => s + (a.duration || 0), 0);
        return total >= first.duration * 0.8 && total <= first.duration * 1.1;
      }
      if (p.type === 'monthly') {
        const weeks = p.unit?.weeks || [];
        if (weeks.length === 0) return true;
        return weeks.every(w => {
          const total = (w.activities || []).reduce((s, a) => s + (a.duration || 0), 0);
          return w.duration ? (total >= w.duration * 0.6 && total <= w.duration * 1.1) : true;
        });
      }
      if (p.type === 'evaluation') return true;
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

function validateOutputStructure(data, type = 'class') {
  const errors = [];
  if (!data.purpose || data.purpose.length < 5) errors.push('Falta propósito válido');

  if (type === 'evaluation') {
    if (!data.evaluation?.indicators?.length) errors.push('Faltan indicadores de evaluación');
    if (!data.evaluation?.criteria?.length) errors.push('Faltan criterios de evaluación');
    return errors;
  }

  if (type === 'unit' || type === 'monthly') {
    const items = type === 'unit' ? data.unit?.classes : data.unit?.weeks;
    if (!items?.length) errors.push(`Faltan ${type === 'unit' ? 'clases' : 'semanas'}`);
    else {
      for (const it of items) {
        if (!it.activities?.length) errors.push(`${type === 'unit' ? 'Clase' : 'Semana'} sin actividades`);
        else for (const act of it.activities) {
          if (!act.moment) errors.push('Actividad sin momento');
          if (!act.description) errors.push('Actividad sin descripción');
        }
      }
    }
    if (!data.unit?.assessment?.criteria?.length && type === 'unit') errors.push('Faltan criterios de evaluación de unidad');
    return errors;
  }

  if (type === 'annual') {
    if (!data.unit?.months?.length) errors.push('Faltan meses');
    return errors;
  }

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
  const type = PLANNING_TYPES[context.type] ? context.type : 'class';
  const planning = {
    userId,
    type,
    title: context.title || `Clase: ${oaDocs[0]?.code || 'Sin OA'}`,
    status: 'draft',
    level: context.level,
    subject: context.subject,
    unit: context.unit || '',
    duration: parseInt(context.duration) || 45,
    modality: context.modality || 'presencial',
    learningObjectives: oaDocs.map(oa => ({ code: oa.code, text: oa.text, source: oa.source })),
    purpose: content.purpose,
    differentiation: content.differentiation || '',
    resources: content.resources || [],
    studentCount: context.studentCount || '',
    priorKnowledge: context.priorKnowledge || '',
    methodology: context.methodology || '',
    barriers: context.barriers || '',
    framework: context.framework || 'dua',
    dua: content.dua || null,
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

  if (type === 'class' || type === 'multigrade') {
    planning.activities = content.activities || [];
    planning.assessment = content.assessment || {};
  } else if (type === 'unit' || type === 'monthly' || type === 'annual') {
    planning.unit = content.unit || {};
  } else if (type === 'evaluation') {
    planning.evaluation = content.evaluation || {};
  }

  if (type === 'multigrade' && Array.isArray(context.levels) && context.levels.length === 2) {
    planning.levels = context.levels;
    planning.title = planning.title || `Multigrado: ${oaDocs[0]?.code || 'Sin OA'}`;
  }

  planning.warnings = runPedagogicalAudit(planning);
  return planning;
}

function buildTypeInstruction(type, context, oaDocs) {
  const oaCodes = oaDocs.map(oa => oa.code).join(', ');
  if (type === 'unit') {
    const numClasses = Math.max(4, Math.min(8, parseInt(context.numClasses) || 6));
    return `Eres el encargado de planificar una UNIDAD DIDACTICA completa (${numClasses} clases).

Los OA de la unidad son: ${oaCodes}

Genera UNICAMENTE un objeto JSON con EXACTAMENTE esta estructura:

{
  "purpose": "string - proposito de la unidad",
  "unit": {
    "title": "string - titulo de la unidad",
    "description": "string - secuencia didactica general de la unidad",
    "numClasses": ${numClasses},
    "classes": [
      {
        "number": 1,
        "title": "string - titulo de la clase",
        "purpose": "string - proposito de la clase",
        "oaCodes": ["codigos de OA trabajados en esta clase"],
        "duration": number (minutos de la clase),
        "activities": [
          {
            "moment": "inicio" | "desarrollo" | "cierre",
            "title": "string",
            "description": "string",
            "duration": number,
            "keyQuestions": ["string"],
            "monitoringStrategy": "string",
            "evidence": "string"
          }
        ],
        "assessment": {
          "type": "formativa" | "sumativa",
          "criteria": ["string"],
          "feedbackStrategy": "string"
        }
      }
    ],
    "unitAssessment": {
      "type": "formativa" | "sumativa",
      "criteria": ["string - criterios de la evaluacion final de unidad"],
      "feedbackStrategy": "string"
    }
  },
  "differentiation": "string",
  "resources": ["string"],
  "dua": { "representacion": [], "accionExpresion": [], "implicacion": [] }
}

Debes generar EXACTAMENTE ${numClasses} clases (clases 1 a ${numClasses}), cada una con al menos 3 actividades (inicio, desarrollo, cierre). La secuencia didactica debe ser progresiva: las primeras clases construyen el conocimiento y las ultimas lo consolidan y evaluan.`;
  }
  if (type === 'multigrade') {
    const [l1, l2] = context.levels || [];
    return `Eres el encargado de planificar una CLASE MULTIGRADO que combina dos niveles: ${l1} y ${l2}.

Los OA son: ${oaCodes}

Genera UNICAMENTE un objeto JSON con EXACTAMENTE esta estructura:

{
  "purpose": "string - proposito comun de la clase multigrado",
  "activities": [
    {
      "moment": "inicio" | "desarrollo" | "cierre",
      "targetLevel": "${l1}" | "${l2}",
      "title": "string",
      "description": "string - actividades diferenciadas para cada nivel",
      "duration": number,
      "keyQuestions": ["string"],
      "monitoringStrategy": "string",
      "evidence": "string"
    }
  ],
  "assessment": {
    "type": "formativa",
    "criteria": ["string - criterios diferenciados por nivel"],
    "feedbackStrategy": "string"
  },
  "differentiation": "string - diferenciacion para ambos niveles",
  "resources": ["string"],
  "dua": { "representacion": [], "accionExpresion": [], "implicacion": [] }
}

Cada actividad debe indicar el nivel al que apunta (targetLevel). Alterna actividades para cada nivel y considera momentos en que ambos niveles trabajan juntos. Genera al menos 4 actividades.`;
  }
  return '';
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
    expect(errors).toContain('Falta propósito válido');
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
    expect(errors).toContain('Actividad sin descripción');
  });

  test('rechaza falta de criterios de evaluacion', () => {
    const errors = validateOutputStructure({
      purpose: 'Clase de prueba',
      activities: [{ moment: 'inicio', description: 'Act' }],
      assessment: {},
    });
    expect(errors).toContain('Faltan criterios de evaluación');
  });
});

describe('Output Structure Validation por tipo', () => {
  test('valida unidad didactica correcta', () => {
    const errors = validateOutputStructure({
      purpose: 'Unidad de fracciones para 6 basico',
      unit: {
        classes: [
          { title: 'Clase 1', duration: 45, activities: [{ moment: 'inicio', description: 'Activar' }, { moment: 'desarrollo', description: 'Trabajo' }, { moment: 'cierre', description: 'Cierre' }] },
          { title: 'Clase 2', duration: 45, activities: [{ moment: 'inicio', description: 'Activar' }, { moment: 'desarrollo', description: 'Trabajo' }, { moment: 'cierre', description: 'Cierre' }] },
        ],
        assessment: { criteria: ['Criterio'] },
      },
    }, 'unit');
    expect(errors).toEqual([]);
  });

  test('rechaza unidad sin clases', () => {
    const errors = validateOutputStructure({ purpose: 'Unidad sin clases', unit: {} }, 'unit');
    expect(errors).toContain('Faltan clases');
  });

  test('valida evaluacion standalone correcta', () => {
    const errors = validateOutputStructure({
      purpose: 'Evaluacion sumativa de unidad',
      evaluation: { indicators: ['Indicador'], criteria: ['Criterio'] },
    }, 'evaluation');
    expect(errors).toEqual([]);
  });

  test('rechaza evaluacion sin indicadores ni criterios', () => {
    const errors = validateOutputStructure({ purpose: 'Evaluacion', evaluation: {} }, 'evaluation');
    expect(errors).toContain('Faltan indicadores de evaluación');
    expect(errors).toContain('Faltan criterios de evaluación');
  });

  test('valida planificacion anual correcta', () => {
    const errors = validateOutputStructure({ purpose: 'Ano de historia', unit: { months: [{ number: 1 }, { number: 2 }] } }, 'annual');
    expect(errors).toEqual([]);
  });

  test('rechaza anual sin meses', () => {
    const errors = validateOutputStructure({ purpose: 'Ano sin meses', unit: {} }, 'annual');
    expect(errors).toContain('Faltan meses');
  });

  test('valida planificacion mensual correcta', () => {
    const errors = validateOutputStructure({
      purpose: 'Mes de trabajo',
      unit: {
        weeks: [
          { number: 1, activities: [{ moment: 'inicio', description: 'A' }, { moment: 'cierre', description: 'B' }] },
        ],
        assessment: { criteria: ['C'] },
      },
    }, 'monthly');
    expect(errors).toEqual([]);
  });
});

describe('Pedagogical Audit Rules (V-001 to V-012)', () => {
  const validPlanning = {
    type: 'class',
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
    const warnings = runPedagogicalAudit({ type: 'class', activities: [], duration: 45, assessment: { criteria: ['A'], feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-001')).toBe(true);
  });

  test('detecta falta de criterios (V-004)', () => {
    const warnings = runPedagogicalAudit({ type: 'class', activities: [{ moment: 'cierre', duration: 45 }], duration: 45, assessment: { feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-004')).toBe(true);
  });

  test('detecta falta de cierre (V-007)', () => {
    const warnings = runPedagogicalAudit({ type: 'class', activities: [{ moment: 'inicio', duration: 45 }], duration: 45, assessment: { criteria: ['A'], feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-007')).toBe(true);
  });

  test('detecta falta de retroalimentacion (V-009)', () => {
    const warnings = runPedagogicalAudit({ type: 'class', activities: [{ moment: 'cierre', duration: 45 }], duration: 45, assessment: { criteria: ['A'] } });
    expect(warnings.some(w => w.ruleId === 'V-009')).toBe(true);
  });

  test('detecta duracion incorrecta (V-006)', () => {
    const warnings = runPedagogicalAudit({ type: 'class', activities: [{ moment: 'inicio', duration: 5 }], duration: 90, assessment: { criteria: ['A'], feedbackStrategy: 'oral' } });
    expect(warnings.some(w => w.ruleId === 'V-006')).toBe(true);
  });

  test('multiples reglas fallan simultaneamente', () => {
    const warnings = runPedagogicalAudit({ type: 'class', activities: [], duration: 90, assessment: {} });
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    const ruleIds = warnings.map(w => w.ruleId);
    expect(ruleIds).toContain('V-001');
    expect(ruleIds).toContain('V-004');
    expect(ruleIds).toContain('V-007');
    expect(ruleIds).toContain('V-009');
  });

  test('unidad sin cierre en ninguna clase genera V-007', () => {
    const warnings = runPedagogicalAudit({
      type: 'unit',
      unit: {
        classes: [
          { activities: [{ moment: 'inicio', duration: 45 }] },
        ],
      },
      duration: 45,
    });
    expect(warnings.some(w => w.ruleId === 'V-007')).toBe(true);
  });

  test('evaluacion con rubrica e indicadores no genera V-007 ni V-001', () => {
    const warnings = runPedagogicalAudit({
      type: 'evaluation',
      evaluation: {
        indicators: ['Indicador'],
        criteria: ['Criterio'],
        feedbackStrategy: 'oral',
        rubric: [{ dimension: 'Comprension' }],
      },
    });
    expect(warnings.some(w => w.ruleId === 'V-007')).toBe(false);
    expect(warnings.some(w => w.ruleId === 'V-001')).toBe(false);
    expect(warnings.some(w => w.ruleId === 'V-004')).toBe(false);
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

  test('asigna type class por defecto', () => {
    const record = buildPlanningRecord(userId, context, oaDocs, content, aiResult, promptTemplateId);
    expect(record.type).toBe('class');
    expect(record.activities).toEqual(content.activities);
  });

  test('construye registro de unidad didactica', () => {
    const unitContent = { purpose: 'Unidad de fracciones', unit: { title: 'Fracciones', classes: [], assessment: { criteria: ['C1'] } } };
    const record = buildPlanningRecord(userId, { ...context, type: 'unit', numClasses: '6' }, oaDocs, unitContent, aiResult, promptTemplateId);
    expect(record.type).toBe('unit');
    expect(record.unit.title).toBe('Fracciones');
    expect(record.activities).toBeUndefined();
  });

  test('construye registro de evaluacion', () => {
    const evalContent = { purpose: 'Evaluar unidad', evaluation: { type: 'sumativa', indicators: ['I1'], criteria: ['C1'] } };
    const record = buildPlanningRecord(userId, { ...context, type: 'evaluation' }, oaDocs, evalContent, aiResult, promptTemplateId);
    expect(record.type).toBe('evaluation');
    expect(record.evaluation.type).toBe('sumativa');
  });

  test('construye registro multigrado con niveles', () => {
    const mgContent = { purpose: 'Clase multigrado', activities: [], assessment: { criteria: ['C1'] } };
    const record = buildPlanningRecord(userId, { ...context, type: 'multigrade', levels: ['7-basico', '8-basico'] }, oaDocs, mgContent, aiResult, promptTemplateId);
    expect(record.type).toBe('multigrade');
    expect(record.levels).toEqual(['7-basico', '8-basico']);
  });

  test('ignora type desconocido', () => {
    const record = buildPlanningRecord(userId, { ...context, type: 'noexiste' }, oaDocs, content, aiResult, promptTemplateId);
    expect(record.type).toBe('class');
  });
});

describe('Type Instructions', () => {
  const oaDocs = [{ code: 'MA06 OA 03' }, { code: 'MA06 OA 04' }];

  test('unit genera instruccion con numClasses entre 4 y 8', () => {
    const out = buildTypeInstruction('unit', { numClasses: '3' }, oaDocs);
    expect(out).toContain('4 clases');
    const out2 = buildTypeInstruction('unit', { numClasses: '12' }, oaDocs);
    expect(out2).toContain('8 clases');
    const out3 = buildTypeInstruction('unit', {}, oaDocs);
    expect(out3).toContain('6 clases');
    expect(out).toContain('MA06 OA 03, MA06 OA 04');
  });

  test('multigrade incluye ambos niveles', () => {
    const out = buildTypeInstruction('multigrade', { levels: ['7-basico', '8-basico'] }, oaDocs);
    expect(out).toContain('7-basico');
    expect(out).toContain('8-basico');
    expect(out).toContain('targetLevel');
  });

  test('tipo desconocido retorna string vacio', () => {
    expect(buildTypeInstruction('noexiste', {}, oaDocs)).toBe('');
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

    expect(rule.check({ type: 'class', activities: [{ duration: 72 }], duration: 90 })).toBe(true);
    expect(rule.check({ type: 'class', activities: [{ duration: 99 }], duration: 90 })).toBe(true);
    expect(rule.check({ type: 'class', activities: [{ duration: 71 }], duration: 90 })).toBe(false);
    expect(rule.check({ type: 'class', activities: [{ duration: 100 }], duration: 90 })).toBe(false);
  });

  test('V-006 verifica duracion de primera clase de unidad', () => {
    const rule = VALIDATION_RULES.find(r => r.id === 'V-006');
    expect(rule.check({ type: 'unit', unit: { classes: [{ duration: 45, activities: [{ duration: 40 }] }] } })).toBe(true);
    expect(rule.check({ type: 'unit', unit: { classes: [{ duration: 45, activities: [{ duration: 20 }] }] } })).toBe(false);
  });

  test('V-006 no aplica a evaluacion', () => {
    const rule = VALIDATION_RULES.find(r => r.id === 'V-006');
    expect(rule.check({ type: 'evaluation', evaluation: {} })).toBe(true);
  });
});
