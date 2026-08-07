import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, isAdmin, isOrgAdmin } from '../core.js';

// Carga diferida (S-5.4): editor manual de planificaciones.
const ManualEditor = defineComponent({
  setup() {
    if (!guard()) return () => null;

    const id = window.location.hash.split('/').pop();
    const isEditing = id && id !== 'nueva-manual' && id.length > 10;

    const form = reactive({
      type: 'class',
      title: '',
      level: '',
      level2: '',
      subject: 'historia-geografia-ciencias-sociales',
      unit: '',
      oaCode: '',
      oaText: '',
      duration: 45,
      modality: 'presencial',
      studentCount: '',
      priorKnowledge: '',
      resources: '',
      methodology: '',
      purpose: '',
      activities: [],
      unitData: null,
      evaluationData: null,
      assessmentType: 'formativa',
      assessmentCriteria: '',
      assessmentFeedback: '',
      differentiation: '',
      accessibility: '',
      barriers: '',
      framework: 'dua',
      duaRepresentacion: '',
      duaAccionExpresion: '',
      duaImplicacion: '',
      extension: '',
      homework: '',
    });

    const loading = ref(true);
    const saving = ref(false);
    const error = ref('');
    const success = ref('');
    const lastSaved = ref(null);
    const planningId = ref(null);
    const status = ref('draft');
    const warnings = ref([]);

    // ── Warning evaluator (client-side V-001 to V-012) ──
    const evaluateWarnings = () => {
      const w = [];
      const acts = form.activities || [];
      const totalTime = acts.reduce((s, a) => s + (a.duration || 0), 0);
      const duration = parseInt(form.duration) || 45;

      // V-001: actividades
      if (acts.length === 0) w.push({ type: 'critical', rule: 'V-001', msg: 'No hay actividades definidas para los OA seleccionados' });
      // V-004: criterios de evaluacion
      if (!form.assessmentCriteria) w.push({ type: 'critical', rule: 'V-004', msg: 'La evaluacion no tiene criterios definidos' });
      // V-007: actividad de cierre
      if (!acts.some(a => a.moment === 'cierre')) w.push({ type: 'warning', rule: 'V-007', msg: 'No hay actividad de cierre' });
      // V-009: retroalimentacion
      if (!form.assessmentFeedback) w.push({ type: 'warning', rule: 'V-009', msg: 'No hay estrategia de retroalimentacion' });
      // V-006: duracion
      if (acts.length > 0 && (totalTime < duration * 0.8 || totalTime > duration * 1.1)) {
        w.push({ type: 'warning', rule: 'V-006', msg: `La duracion total de actividades (${totalTime} min) no coincide con la duracion planificada (${duration} min)` });
      }
      return w;
    };
    const levels = LEVELS;
    const moments = ['inicio', 'desarrollo', 'cierre'];
    const momentLabels = { inicio: 'Inicio', desarrollo: 'Desarrollo', cierre: 'Cierre' };

    // ── Load existing ──
    onMounted(async () => {
      if (isEditing) {
        try {
          const snap = await getDoc(doc(db, 'plannings', id));
          if (!snap.exists() || snap.data().userId !== store.user.uid) {
            error.value = 'Planificación no encontrada';
            return;
          }
          const d = snap.data();
          planningId.value = d.id || id;
          status.value = d.status || 'draft';
          form.type = d.type || 'class';
          form.title = d.title || '';
          form.level = d.level || '';
          form.level2 = d.levels?.[1] || '';
          form.unit = d.unit || '';
          form.oaCode = d.learningObjectives?.[0]?.code || '';
          form.oaText = d.learningObjectives?.[0]?.text || '';
          form.duration = d.duration || 45;
          form.modality = d.modality || 'presencial';
          form.studentCount = d.studentCount || '';
          form.priorKnowledge = d.priorKnowledge || '';
          form.resources = (d.resources || []).join(', ');
          form.methodology = d.methodology || '';
          form.purpose = d.purpose || '';
          form.activities = d.activities || [];
          form.unitData = d.unit || null;
          form.evaluationData = d.evaluation || null;
          form.assessmentType = d.assessment?.type || 'formativa';
          form.assessmentCriteria = (d.assessment?.criteria || []).join(', ');
          form.assessmentFeedback = d.assessment?.feedbackStrategy || '';
          form.differentiation = d.differentiation || '';
          form.accessibility = (d.accessibility || []).join(', ');
          form.barriers = d.barriers || '';
          form.framework = d.framework || 'dua';
          form.duaRepresentacion = (d.dua?.representacion || []).join('\n');
          form.duaAccionExpresion = (d.dua?.accionExpresion || []).join('\n');
          form.duaImplicacion = (d.dua?.implicacion || []).join('\n');
          form.extension = d.extension || '';
          form.homework = d.homework || '';
        } catch (e) {
          error.value = 'Error al cargar planificación';
        }
      }
      loading.value = false;
    });

    // ── Autosave ──
    let autosaveTimer = null;
    const startAutosave = () => {
      if (autosaveTimer) clearInterval(autosaveTimer);
      autosaveTimer = setInterval(() => {
        if (form.title || form.level || form.purpose || form.activities.length > 0) {
          save(true);
        }
      }, 30000);
    };

    const stopAutosave = () => { if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; } };

    onMounted(() => {
      if (!isEditing) startAutosave();
      else setTimeout(startAutosave, 1000);
    });

    const cleanup = () => stopAutosave();

    // ── Warning panel ──
    const warningPanel = () => {
      warnings.value = evaluateWarnings();
      if (warnings.value.length === 0) return null;
      const counts = { critical: 0, warning: 0, suggestion: 0 };
      warnings.value.forEach(w => { if (counts[w.type] !== undefined) counts[w.type]++; });
      return h('div', { class: 'bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4' }, [
        h('div', { class: 'flex items-center gap-2 text-sm font-medium text-amber-800 mb-1' }, [
          h('span', '⚠'),
          h('span', `Advertencias pedagógicas (${warnings.value.length})`),
          counts.critical > 0 ? h('span', { class: 'bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded' }, `${counts.critical} crítica(s)`) : null,
          counts.warning > 0 ? h('span', { class: 'bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded' }, `${counts.warning} advertencia(s)`) : null,
        ]),
        h('div', { class: 'space-y-0.5' }, warnings.value.map(w =>
          h('p', { class: `text-xs ${w.type === 'critical' ? 'text-red-700' : 'text-amber-700'}` }, `[${w.rule}] ${w.msg}`)
        )),
      ]);
    };

    // ── Save / Autosave ──
    const save = async (isAutosave = false) => {
      saving.value = true;
      error.value = '';
      const buildData = () => ({
        userId: store.user.uid,
        type: form.type || 'class',
        title: form.title || 'Sin título',
        status: isAutosave ? 'draft' : status.value,
        level: form.level,
        levels: form.type === 'multigrade' && form.level2 ? [form.level, form.level2] : null,
        subject: form.subject,
        unit: (form.type === 'unit' || form.type === 'monthly' || form.type === 'annual') ? (form.unitData || {}) : form.unit,
        duration: parseInt(form.duration) || 45,
        modality: form.modality,
        studentCount: form.studentCount,
        priorKnowledge: form.priorKnowledge,
        resources: form.resources ? form.resources.split(',').map(r => r.trim()).filter(Boolean) : [],
        methodology: form.methodology,
        learningObjectives: form.oaCode ? [{ code: form.oaCode, text: form.oaText, source: 'Ingreso manual' }] : [],
        purpose: form.purpose,
        activities: form.activities,
        evaluation: form.type === 'evaluation' ? (form.evaluationData || null) : null,
        assessment: {
          type: form.assessmentType,
          criteria: form.assessmentCriteria ? form.assessmentCriteria.split(',').map(r => r.trim()).filter(Boolean) : [],
          feedbackStrategy: form.assessmentFeedback,
        },
        differentiation: form.differentiation,
        accessibility: form.accessibility ? form.accessibility.split(',').map(r => r.trim()).filter(Boolean) : [],
        barriers: form.barriers || '',
        framework: form.framework || 'dua',
        dua: form.framework === 'estandar' ? null : {
          representacion: form.duaRepresentacion ? form.duaRepresentacion.split('\n').map(s => s.trim()).filter(Boolean) : [],
          accionExpresion: form.duaAccionExpresion ? form.duaAccionExpresion.split('\n').map(s => s.trim()).filter(Boolean) : [],
          implicacion: form.duaImplicacion ? form.duaImplicacion.split('\n').map(s => s.trim()).filter(Boolean) : [],
        },
        extension: form.extension,
        homework: form.homework,
        updatedAt: serverTimestamp(),
      });

      try {
        if (planningId.value) {
          await updateDoc(doc(db, 'plannings', planningId.value), buildData());
          if (!isAutosave) {
            // Save version snapshot
            const verSnap = await getDoc(doc(db, 'plannings', planningId.value));
            const v = (verSnap.data()?.version || 1) + 1;
            await updateDoc(doc(db, 'plannings', planningId.value), { version: v });
            await addDoc(collection(db, 'plannings', planningId.value, 'versions'), {
              snapshot: buildData(),
              version: v,
              createdAt: serverTimestamp(),
              userId: store.user.uid,
            });
            success.value = 'Guardado correctamente';
            lastSaved.value = new Date().toLocaleTimeString('es-CL');
          } else {
            lastSaved.value = new Date().toLocaleTimeString('es-CL');
          }
        } else {
          const ref = await addDoc(collection(db, 'plannings'), { ...buildData(), version: 1, createdAt: serverTimestamp(), aiContributions: [], warnings: [], approvedAt: null, orgId: store.org ? store.org.id : null, userName: store.profile?.displayName || store.user.displayName || store.user.email });
          planningId.value = ref.id;
          if (!isAutosave) success.value = 'Planificación creada';
        }
      } catch (e) {
        if (!isAutosave) error.value = 'Error al guardar';
        console.error('Save error:', e);
      } finally {
        saving.value = false;
      }
    };

    // ── Activity management ──
    const addActivity = (moment) => {
      form.activities.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
        moment,
        order: form.activities.filter(a => a.moment === moment).length + 1,
        title: '',
        description: '',
        duration: 15,
        teacherActions: [],
        studentActions: [],
        keyQuestions: [],
        monitoringStrategy: '',
        evidence: '',
      });
    };

    const removeActivity = (idx) => { form.activities.splice(idx, 1); };

    const moveActivity = (idx, dir) => {
      const target = idx + dir;
      if (target < 0 || target >= form.activities.length) return;
      [form.activities[idx], form.activities[target]] = [form.activities[target], form.activities[idx]];
    };

    // ── Structure por tipo (unit/monthly/annual/evaluation) ──
    const ensureUnit = () => {
      if (!form.unitData || typeof form.unitData !== 'object') form.unitData = { title: form.unit || 'Unidad', description: '', assessment: { type: 'formativa', criteria: [], feedbackStrategy: '' } };
      return form.unitData;
    };
    const unitItemsKey = () => ({ unit: 'classes', monthly: 'weeks', annual: 'months' })[form.type];
    const unitItemLabel = () => ({ unit: 'clase', monthly: 'semana', annual: 'mes' })[form.type] || 'clase';
    const unitItemTitle = () => ({ unit: 'Clase', monthly: 'Semana', annual: 'Mes' })[form.type] || 'Clase';

    const addUnitItem = () => {
      const u = ensureUnit();
      const key = unitItemsKey();
      if (!Array.isArray(u[key])) u[key] = [];
      const n = u[key].length + 1;
      if (form.type === 'annual') {
        u[key].push({ number: n, name: `Mes ${n}`, topic: '', oaCodes: [], notes: '' });
      } else if (form.type === 'monthly') {
        u[key].push({ number: n, topic: `Semana ${n}`, oaCodes: [], duration: 90, activities: [], assessment: { type: 'formativa', criteria: [], feedbackStrategy: '' } });
      } else {
        u[key].push({ number: n, title: `Clase ${n}`, purpose: '', oaCodes: [], duration: 45, activities: [], assessment: { type: 'formativa', criteria: [], feedbackStrategy: '' } });
      }
    };
    const removeUnitItem = (idx) => {
      const u = ensureUnit();
      const key = unitItemsKey();
      if (Array.isArray(u[key])) u[key].splice(idx, 1);
    };
    const addUnitActivity = (item) => {
      if (!Array.isArray(item.activities)) item.activities = [];
      item.activities.push({ moment: 'desarrollo', title: '', description: '', duration: 15, keyQuestions: [], monitoringStrategy: '', evidence: '' });
    };
    const removeUnitActivity = (item, idx) => {
      if (Array.isArray(item.activities)) item.activities.splice(idx, 1);
    };
    const addEvalCriterion = (target) => {
      if (!Array.isArray(target.criteria)) target.criteria = [];
      target.criteria.push('');
    };
    const removeEvalCriterion = (target, idx) => {
      if (Array.isArray(target.criteria)) target.criteria.splice(idx, 1);
    };
    const addIndicator = () => {
      if (!form.evaluationData) form.evaluationData = { type: 'formativa', instrument: ['prueba'], description: '', indicators: [], rubric: [], criteria: [], feedbackStrategy: '' };
      if (!Array.isArray(form.evaluationData.indicators)) form.evaluationData.indicators = [];
      form.evaluationData.indicators.push('');
    };
    const removeIndicator = (idx) => {
      if (Array.isArray(form.evaluationData?.indicators)) form.evaluationData.indicators.splice(idx, 1);
    };
    const addRubricRow = () => {
      if (!form.evaluationData) form.evaluationData = { type: 'formativa', instrument: [], indicators: [], rubric: [], criteria: [], feedbackStrategy: '' };
      if (!Array.isArray(form.evaluationData.rubric)) form.evaluationData.rubric = [];
      form.evaluationData.rubric.push({ dimension: '', logrado: '', medio: '', enDesarrollo: '' });
    };
    const removeRubricRow = (idx) => {
      if (Array.isArray(form.evaluationData?.rubric)) form.evaluationData.rubric.splice(idx, 1);
    };

    const approve = async () => {
      if (!planningId.value) { error.value = 'Guarda primero la planificación'; return; }
      saving.value = true;
      try {
        await updateDoc(doc(db, 'plannings', planningId.value), { status: 'approved', approvedAt: serverTimestamp() });
        status.value = 'approved';
        success.value = 'Planificación aprobada';
      } catch (e) { error.value = 'Error al aprobar'; } finally { saving.value = false; }
    };

    // ── Render ──

    const renderSection = (title, icon, children) =>
      Card([h('div', { class: 'p-4 space-y-3' }, [
        h('h3', { class: 'font-semibold text-slate-800 flex items-center gap-2 text-sm' }, [h('span', icon), title]),
        ...(Array.isArray(children) ? children : [children]),
      ])]);

    const inputField = (label, model, opts = {}) => h('div', [
      h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, label),
      opts.type === 'textarea'
        ? h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none', rows: opts.rows || 3, placeholder: opts.placeholder || '', value: form[model], onInput: (e) => form[model] = e.target.value })
        : opts.type === 'select'
          ? h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none', value: form[model], onChange: (e) => form[model] = e.target.value }, opts.options || [])
          : h('input', { type: opts.type || 'text', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none', placeholder: opts.placeholder || '', value: form[model], onInput: (e) => form[model] = e.target.value }),
    ]);

    const renderActivities = () => {
      const byMoment = {};
      moments.forEach(m => { byMoment[m] = form.activities.filter(a => a.moment === m); });

      return h('div', { class: 'space-y-4' }, [
        h('h3', { class: 'font-semibold text-slate-800 flex items-center gap-2' }, [h('span', '📝'), 'Actividades']),
        moments.map(moment =>
          Card([h('div', { class: 'p-4' }, [
            h('div', { class: 'flex items-center justify-between mb-2' }, [
              h('h4', { class: 'font-medium text-sm text-blue-700' }, momentLabels[moment]),
              h('button', { onClick: () => addActivity(moment), class: 'text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition' }, '+ Agregar actividad'),
            ]),
            byMoment[moment].length === 0
              ? h('p', { class: 'text-xs text-slate-400 py-2 text-center' }, 'Sin actividades. Haz clic en "+ Agregar actividad".')
              : byMoment[moment].map((act, localIdx) => {
                  const globalIdx = form.activities.indexOf(act);
                  return Card([h('div', { class: 'p-3 space-y-2' }, [
                    h('div', { class: 'flex items-center justify-between' }, [
                      h('span', { class: 'text-xs font-medium text-slate-500' }, `#${act.order}`),
                      h('div', { class: 'flex gap-1' }, [
                        h('button', { onClick: () => moveActivity(globalIdx, -1), disabled: globalIdx === 0, class: 'text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30' }, '↑'),
                        h('button', { onClick: () => moveActivity(globalIdx, 1), disabled: globalIdx === form.activities.length - 1, class: 'text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30' }, '↓'),
                        h('button', { onClick: () => removeActivity(globalIdx), class: 'text-xs text-red-400 hover:text-red-600' }, '✕'),
                      ]),
                    ]),
                    h('div', { class: 'grid grid-cols-2 gap-2' }, [
                      h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Título'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.title, onInput: (e) => act.title = e.target.value, placeholder: 'Título de la actividad' })]),
                      h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Duración (min)'), h('input', { type: 'number', class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.duration, onInput: (e) => act.duration = parseInt(e.target.value) || 15 })]),
                    ]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Descripción'), h('textarea', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', rows: 2, value: act.description, onInput: (e) => act.description = e.target.value, placeholder: 'Describe la actividad...' })]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Preguntas clave'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.keyQuestions?.[0] || '', onInput: (e) => { act.keyQuestions = [e.target.value]; }, placeholder: 'Pregunta para los estudiantes' })]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Monitoreo'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.monitoringStrategy || '', onInput: (e) => act.monitoringStrategy = e.target.value, placeholder: '¿Cómo monitorearás?' })]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Evidencia'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.evidence || '', onInput: (e) => act.evidence = e.target.value, placeholder: '¿Qué evidencia recogerás?' })]),
                  ])], ' mb-2');
                }),
          ])])
        ),
      ]);
    };

    const renderUnitStructureEditor = () => {
      const u = ensureUnit();
      const key = unitItemsKey();
      const items = Array.isArray(u[key]) ? u[key] : [];
      return renderSection(form.type === 'unit' ? 'Estructura de la Unidad' : (form.type === 'monthly' ? 'Estructura del Mes' : 'Estructura del Año'), '🧩', [
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, 'Título de la unidad'), h('input', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: u.title, onInput: (e) => u.title = e.target.value })]),
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, 'Descripción'), h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', rows: 2, value: u.description, onInput: (e) => u.description = e.target.value })]),
        h('div', { class: 'flex items-center justify-between' }, [
          h('p', { class: 'text-xs text-slate-500' }, `${items.length} ${unitItemLabel()}${items.length === 1 ? '' : 's'}`),
          h('button', { onClick: addUnitItem, class: 'text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition' }, `+ Agregar ${unitItemLabel()}`),
        ]),
        items.map((item, idx) => Card([h('div', { class: 'p-3 space-y-2' }, [
          h('div', { class: 'flex items-center justify-between' }, [
            h('span', { class: 'text-xs font-medium text-slate-500' }, `${unitItemTitle()} #${idx + 1}`),
            h('button', { onClick: () => removeUnitItem(idx), class: 'text-xs text-red-400 hover:text-red-600' }, '✕'),
          ]),
          form.type === 'annual'
            ? [
                h('div', { class: 'grid grid-cols-2 gap-2' }, [
                  h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Tema'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: item.topic, onInput: (e) => item.topic = e.target.value })]),
                  h('div', [h('label', { class: 'text-xs text-slate-500' }, 'OAs (separados por coma)'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: (item.oaCodes || []).join(', '), onInput: (e) => item.oaCodes = e.target.value.split(',').map(s => s.trim()).filter(Boolean) })]),
                ]),
                h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Notas'), h('textarea', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', rows: 2, value: item.notes, onInput: (e) => item.notes = e.target.value })]),
              ]
            : [
                h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Título'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: item.title || item.topic, onInput: (e) => item.title = e.target.value, placeholder: `Título de la ${unitItemLabel()}` })]),
                h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Propósito'), h('textarea', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', rows: 2, value: item.purpose, onInput: (e) => item.purpose = e.target.value, placeholder: '¿Qué aprenderán en esta clase/semana?' })]),
                h('div', { class: 'grid grid-cols-2 gap-2' }, [
                  h('div', [h('label', { class: 'text-xs text-slate-500' }, 'OAs (separados por coma)'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: (item.oaCodes || []).join(', '), onInput: (e) => item.oaCodes = e.target.value.split(',').map(s => s.trim()).filter(Boolean) })]),
                  h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Duración (min)'), h('input', { type: 'number', class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: item.duration, onInput: (e) => item.duration = parseInt(e.target.value) || 45 })]),
                ]),
                h('div', { class: 'flex items-center justify-between mt-1' }, [
                  h('p', { class: 'text-xs text-slate-500' }, `Actividades: ${item.activities?.length || 0}`),
                  h('button', { onClick: () => addUnitActivity(item), class: 'text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition' }, '+ Actividad'),
                ]),
                (item.activities || []).map((act, actIdx) => h('div', { class: 'border border-slate-100 rounded p-2 space-y-1' }, [
                  h('div', { class: 'flex items-center justify-between' }, [
                    h('span', { class: 'text-xs text-slate-400' }, `Actividad ${actIdx + 1}`),
                    h('button', { onClick: () => removeUnitActivity(item, actIdx), class: 'text-xs text-red-400 hover:text-red-600' }, '✕'),
                  ]),
                  h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.title, onInput: (e) => act.title = e.target.value, placeholder: 'Título' }),
                  h('textarea', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', rows: 2, value: act.description, onInput: (e) => act.description = e.target.value, placeholder: 'Descripción' }),
                ])),
                h('div', { class: 'border-t border-slate-100 pt-2' }, [
                  h('p', { class: 'text-xs text-slate-500 mb-1' }, 'Evaluación de la clase/semana'),
                  h('select', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: item.assessment?.type || 'formativa', onChange: (e) => { if (!item.assessment) item.assessment = {}; item.assessment.type = e.target.value; } }, [h('option', { value: 'formativa' }, 'Formativa'), h('option', { value: 'sumativa' }, 'Sumativa')]),
                  h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs mt-1', value: (item.assessment?.criteria || []).join(', '), onInput: (e) => { if (!item.assessment) item.assessment = {}; item.assessment.criteria = e.target.value.split(',').map(s => s.trim()).filter(Boolean); }, placeholder: 'Criterios (separados por coma)' }),
                ]),
              ],
        ])], ' mb-2')),
        h('div', { class: 'border-t border-slate-200 pt-2' }, [
          h('p', { class: 'text-xs text-slate-500 mb-1' }, 'Evaluación de la unidad'),
          h('select', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: u.assessment?.type || 'formativa', onChange: (e) => { if (!u.assessment) u.assessment = {}; u.assessment.type = e.target.value; } }, [h('option', { value: 'formativa' }, 'Formativa'), h('option', { value: 'sumativa' }, 'Sumativa')]),
          h('div', { class: 'flex items-center gap-1 mt-1' }, [
            h('input', { class: 'flex-1 border border-slate-200 rounded px-2 py-1 text-xs', value: (u.assessment?.criteria || []).join(', '), onInput: (e) => { if (!u.assessment) u.assessment = {}; u.assessment.criteria = e.target.value.split(',').map(s => s.trim()).filter(Boolean); }, placeholder: 'Criterios (separados por coma)' }),
          ]),
        ]),
      ]);
    };

    const renderEvaluationEditor = () => {
      if (!form.evaluationData) form.evaluationData = { type: 'formativa', instrument: ['prueba'], description: '', indicators: [], rubric: [], criteria: [], feedbackStrategy: '' };
      const ev = form.evaluationData;
      return renderSection('Evaluación (Decreto 67)', '📊', [
        h('div', { class: 'grid grid-cols-2 gap-2' }, [
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, 'Tipo'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: ev.type, onChange: (e) => ev.type = e.target.value }, [['formativa', 'Formativa'], ['sumativa', 'Sumativa'], ['diagnostica', 'Diagnóstica']].map(([v, l]) => h('option', { value: v }, l)))]),
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, 'Instrumento'), h('input', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: (ev.instrument || []).join(', '), onInput: (e) => ev.instrument = e.target.value.split(',').map(s => s.trim()).filter(Boolean), placeholder: 'prueba, lista de cotejo...' })]),
        ]),
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, 'Descripción'), h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', rows: 2, value: ev.description, onInput: (e) => ev.description = e.target.value })]),
        h('div', { class: 'flex items-center justify-between' }, [
          h('p', { class: 'text-xs text-slate-500' }, `Indicadores: ${ev.indicators?.length || 0}`),
          h('button', { onClick: addIndicator, class: 'text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition' }, '+ Indicador'),
        ]),
        (ev.indicators || []).map((ind, idx) => h('div', { class: 'flex items-center gap-1' }, [
          h('input', { class: 'flex-1 border border-slate-200 rounded px-2 py-1 text-xs', value: ind, onInput: (e) => ev.indicators[idx] = e.target.value, placeholder: 'Ej: identifica las etapas del ciclo del agua' }),
          h('button', { onClick: () => removeIndicator(idx), class: 'text-xs text-red-400 hover:text-red-600' }, '✕'),
        ])),
        h('div', { class: 'flex items-center justify-between mt-2' }, [
          h('p', { class: 'text-xs text-slate-500' }, `Rúbrica: ${ev.rubric?.length || 0} filas`),
          h('button', { onClick: addRubricRow, class: 'text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition' }, '+ Fila de rúbrica'),
        ]),
        (ev.rubric || []).map((row, idx) => h('div', { class: 'border border-slate-100 rounded p-2 space-y-1' }, [
          h('div', { class: 'flex items-center justify-between' }, [
            h('span', { class: 'text-xs text-slate-400' }, `Dimensión ${idx + 1}`),
            h('button', { onClick: () => removeRubricRow(idx), class: 'text-xs text-red-400 hover:text-red-600' }, '✕'),
          ]),
          h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: row.dimension, onInput: (e) => row.dimension = e.target.value, placeholder: 'Dimensión' }),
          h('div', { class: 'grid grid-cols-3 gap-1' }, [
            h('input', { class: 'border border-slate-200 rounded px-2 py-1 text-xs', value: row.logrado, onInput: (e) => row.logrado = e.target.value, placeholder: 'Logrado' }),
            h('input', { class: 'border border-slate-200 rounded px-2 py-1 text-xs', value: row.medio, onInput: (e) => row.medio = e.target.value, placeholder: 'Medio' }),
            h('input', { class: 'border border-slate-200 rounded px-2 py-1 text-xs', value: row.enDesarrollo, onInput: (e) => row.enDesarrollo = e.target.value, placeholder: 'En desarrollo' }),
          ]),
        ])),
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, 'Estrategia de retroalimentación'), h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', rows: 2, value: ev.feedbackStrategy, onInput: (e) => ev.feedbackStrategy = e.target.value })]),
      ]);
    };

    // Cleanup on unmount
    const origBeforeUnmount = null;

    return () => {
      const currentPath = window.location.hash;
      if (currentPath !== '#/nueva-manual' && !currentPath.startsWith('#/editar/') && !currentPath.startsWith('#/planificacion/')) {
        cleanup();
      }
      return h(Layout, { title: isEditing ? 'Editar Planificación' : 'Nueva Planificación (Manual)', subtitle: isEditing ? 'Editando planificación existente' : 'Crea tu planificación desde cero' }, () => [
        loading.value ? h('div', { class: 'flex justify-center py-12' }, Spinner(8)) : [
          error.value ? Alert('error', error.value) : null,
          success.value ? Alert('success', success.value) : null,
          warningPanel(),
          h('div', { class: 'grid lg:grid-cols-3 gap-4' }, [
            // Sidebar
            h('div', { class: 'lg:col-span-1 space-y-3' }, [
              renderSection('Información', '📋', [
                h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, 'Tipo de planificación'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none', value: form.type, onChange: (e) => { form.type = e.target.value; } }, [['class', 'Clase'], ['unit', 'Unidad'], ['monthly', 'Mensual'], ['annual', 'Anual'], ['evaluation', 'Evaluación'], ['multigrade', 'Multigrado']].map(([v, l]) => h('option', { value: v }, l)))]),
                inputField('Título', 'title', { placeholder: 'Título de la planificación' }),
                inputField('Nivel', 'level', { type: 'select', options: [h('option', { value: '' }, 'Selecciona...'), ...levels.map(([v, l]) => h('option', { value: v }, l))] }),
                form.type === 'multigrade'
                  ? inputField('Nivel 2 (multigrado)', 'level2', { type: 'select', options: [h('option', { value: '' }, 'Selecciona...'), ...levels.map(([v, l]) => h('option', { value: v }, l))] })
                  : null,
                inputField('Duración', 'duration', { type: 'select', options: [h('option', { value: 45 }, '45 min'), h('option', { value: 90 }, '90 min')] }),
                inputField('Modalidad', 'modality', { type: 'select', options: [['presencial', 'Presencial'], ['hibrida', 'Híbrida'], ['remota', 'Remota']].map(([v, l]) => h('option', { value: v }, l)) }),
              ]),
              renderSection('Currículum', '📚', [
                inputField('Código OA', 'oaCode', { placeholder: 'Ej: HI07 OA 01' }),
                inputField('Texto OA', 'oaText', { type: 'textarea', rows: 2, placeholder: 'Texto del OA...' }),
                inputField('Unidad (opcional)', 'unit', { placeholder: 'Unidad 1: ...' }),
              ]),
              renderSection('Contexto', '👥', [
                inputField('Estudiantes (aprox.)', 'studentCount', { placeholder: '30' }),
                inputField('Conocimientos previos', 'priorKnowledge', { type: 'textarea', rows: 2, placeholder: 'Lo que los estudiantes ya saben...' }),
                h('p', { class: 'text-xs text-amber-600' }, 'No uses nombres ni RUT de estudiantes.'),
                inputField('Recursos (separados por coma)', 'resources', { placeholder: 'proyector, cuadernos, mapas' }),
                inputField('Metodología', 'methodology', { placeholder: 'Clase dialogada, ABP, etc.' }),
              ]),
            ]),
            // Main content
            h('div', { class: 'lg:col-span-2 space-y-3' }, [
              renderSection('Propósito', '🎯', [
                inputField('Propósito', 'purpose', { type: 'textarea', rows: 2, placeholder: '¿Qué aprenderán los estudiantes?' }),
              ]),
              (form.type === 'unit' || form.type === 'monthly' || form.type === 'annual') ? renderUnitStructureEditor() : null,
              (form.type === 'evaluation') ? renderEvaluationEditor() : null,
              (form.type === 'class' || form.type === 'multigrade') ? renderActivities() : null,
              (form.type === 'class' || form.type === 'multigrade') ? renderSection('Evaluación', '📊', [
                inputField('Tipo', 'assessmentType', { type: 'select', options: [h('option', { value: 'formativa' }, 'Formativa'), h('option', { value: 'sumativa' }, 'Sumativa')] }),
                inputField('Criterios (separados por coma)', 'assessmentCriteria', { placeholder: 'Identifica, analiza, compara...' }),
                inputField('Estrategia de retroalimentación', 'assessmentFeedback', { type: 'textarea', rows: 2, placeholder: '¿Cómo darás retroalimentación?' }),
              ]) : null,
              renderSection('Diferenciación', '🌈', [
                inputField('Diferenciación', 'differentiation', { type: 'textarea', rows: 2, placeholder: 'Adecuaciones para distintos estudiantes...' }),
                h('p', { class: 'text-xs text-amber-600' }, 'Describe necesidades en términos pedagógicos, sin diagnósticos.'),
                inputField('Accesibilidad (separados por coma)', 'accessibility', { placeholder: 'material en braille, letra grande, audio...' }),
              ]),
              renderSection('DUA (Diseño Universal para el Aprendizaje)', '📐', [
                inputField('Marco de inclusión', 'framework', { type: 'select', options: [h('option', { value: 'dua' }, 'DUA completo'), h('option', { value: 'estandar' }, 'Formato estándar')] }),
                h('p', { class: 'text-xs text-slate-500' }, 'Una estrategia por línea en cada principio (CAST):'),
                inputField('Representación (el "qué")', 'duaRepresentacion', { type: 'textarea', rows: 2, placeholder: 'Ej: presentar el contenido en audio y texto' }),
                inputField('Acción y Expresión (el "cómo")', 'duaAccionExpresion', { type: 'textarea', rows: 2, placeholder: 'Ej: permitir responder de forma oral, escrita o visual' }),
                inputField('Implicación (el "porqué")', 'duaImplicacion', { type: 'textarea', rows: 2, placeholder: 'Ej: tareas con elección y relevancia personal' }),
                inputField('Barreras observadas', 'barriers', { type: 'textarea', rows: 2, placeholder: 'Descripción agregada, sin diagnósticos...' }),
              ]),
              renderSection('Extensión', '🔗', [
                inputField('Actividad de extensión (opcional)', 'extension', { type: 'textarea', rows: 2, placeholder: 'Para estudiantes que terminan rápido...' }),
                inputField('Tarea (opcional)', 'homework', { type: 'textarea', rows: 1, placeholder: 'Tarea para la casa...' }),
              ]),
            ]),
          ]),
          // Action bar
          h('div', { class: 'sticky bottom-0 bg-white border-t border-slate-200 p-3 mt-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-lg' }, [
            h('div', { class: 'flex items-center gap-3 text-xs text-slate-400' }, [
              saving.value ? [Spinner(4), h('span', 'Guardando...')] : lastSaved.value ? h('span', `Último guardado: ${lastSaved.value}`) : h('span', 'Sin cambios'),
              planningId.value ? h('a', { href: `#/planificacion/${planningId.value}`, class: 'text-blue-600 hover:underline' }, 'Ver') : null,
            ]),
            h('div', { class: 'flex gap-2' }, [
              h('button', { onClick: () => save(), disabled: saving.value, class: 'bg-slate-100 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition' }, saving.value ? 'Guardando...' : 'Guardar'),
              status.value !== 'approved'
                ? h('button', { onClick: approve, disabled: saving.value || !planningId.value, class: 'bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition' }, 'Aprobar')
                : h('span', { class: 'bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium' }, '✓ Aprobada'),
            ]),
          ]),
        ],
      ]);
    };
  }
});

export { ManualEditor };
