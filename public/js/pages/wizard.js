import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, isAdmin, isOrgAdmin } from '../core.js';

// Carga diferida (S-5.4): módulo del wizard de generación con IA.
const WizardPage = defineComponent({
  setup() {
    if (!guard()) return () => null;
    const step = ref(1);
    const data = reactive({ type: 'class', title: '', level: '', level2: '', subject: '', oaIds: [], numClasses: 6, evaluationType: 'formativa', instrument: 'prueba', duration: 45, modality: 'presencial', studentCount: '', priorKnowledge: '', resources: '', methodology: '', barriers: '', framework: 'dua', dua: { representacion: [], accionExpresion: [], implicacion: [] } });
    const oas = ref([]); const oasLoading = ref(false); const oasLoaded = ref(false); const planning = ref(null); const generating = ref(false); const error = ref('');
    const axisFilter = ref('');
    const searchQuery = ref('');
    onMounted(() => { loadSubjectCatalog(); });

    const loadOAs = async () => {
      const levelsToLoad = data.type === 'multigrade' ? [data.level, data.level2].filter(Boolean) : [data.level];
      if (levelsToLoad.length === 0) return;
      error.value = '';
      oasLoading.value = true;
      oasLoaded.value = false;
      const cacheKey = `curriculum_v2_${levelsToLoad.join('+')}_${data.subject}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.expires > Date.now()) {
            oas.value = parsed.docs;
            oasLoading.value = false;
            oasLoaded.value = true;
            return;
          }
        } catch (e) { /* cache corrupto, recargar */ }
      }
      try {
        const docs = [];
        for (const lv of levelsToLoad) {
          const q = query(collection(db, 'curriculum'), where('level', '==', lv), where('subject', '==', data.subject), orderBy('code'));
          const levelDocs = (await getDocs(q)).docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => d.isActive !== false && d.type === undefined);
          docs.push(...levelDocs);
        }
        oas.value = docs;
        oasLoaded.value = true;
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ docs, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
        } catch (e) { /* localStorage lleno/privado */ }
      } catch (e) {
        console.error(e);
        error.value = 'Error al cargar OA. Verifica la conexión.';
      } finally {
        oasLoading.value = false;
      }
    };
    const toggleOA = (id) => {
      const i = data.oaIds.indexOf(id);
      if (i >= 0) data.oaIds.splice(i, 1);
      else if (data.oaIds.length < ({ class: 4, unit: 8, monthly: 10, annual: 12, evaluation: 4, multigrade: 6 })[data.type] || 4) data.oaIds.push(id);
    };

    const availableAxes = () => {
      const seen = [];
      for (const oa of oas.value) {
        const ax = (oa.axis || '').trim();
        if (ax && !seen.includes(ax)) seen.push(ax);
      }
      return seen.sort();
    };
    const filteredOAs = () => {
      let list = axisFilter.value ? oas.value.filter(oa => (oa.axis || '').trim() === axisFilter.value) : oas.value;
      const q = searchQuery.value.trim().toLowerCase();
      if (q) {
        list = list.filter(oa =>
          (oa.code || '').toLowerCase().includes(q)
          || (oa.text || '').toLowerCase().includes(q)
          || (oa.axis || '').toLowerCase().includes(q)
        );
      }
      return list;
    };
    const resetAxisFilter = () => { axisFilter.value = ''; };
    const resetSearch = () => { searchQuery.value = ''; };

    const generate = async () => {
      generating.value = true; error.value = '';
      const typeLabels = { class: 'Clase', unit: 'Unidad didáctica', monthly: 'Mensual', annual: 'Anual', evaluation: 'Evaluación', multigrade: 'Multigrado' };
      const genTrace = perfTrace('planificacion_generacion');
      if (genTrace) { genTrace.putAttribute('tipo', data.type); genTrace.putAttribute('asignatura', data.subject || ''); genTrace.putAttribute('nivel', data.level || ''); genTrace.start(); }
      try {
        const res = await generatePlanningFn({
          context: {
            type: data.type,
            title: data.title,
            level: data.level,
            level2: data.level2,
            levels: data.type === 'multigrade' ? [data.level, data.level2] : null,
            subject: data.subject,
            numClasses: data.type === 'class' ? undefined : data.numClasses,
            evaluationType: data.type === 'evaluation' ? data.evaluationType : undefined,
            instrument: data.type === 'evaluation' ? data.instrument : undefined,
            duration: parseInt(data.duration),
            modality: data.modality,
            studentCount: data.studentCount,
            priorKnowledge: data.priorKnowledge,
            resources: data.resources ? data.resources.split(',').map(r => r.trim()) : [],
            methodology: data.methodology,
            barriers: data.barriers,
            framework: data.framework,
            dua: data.framework === 'dua' ? data.dua : null,
          },
          oaIds: data.oaIds,
        });
        planning.value = res.data;
        step.value = 9;
      } catch (e) {
        error.value = e.message || 'Error al generar';
        if (genTrace) { genTrace.putAttribute('exito', 'false'); }
        reportError('generate_error', { message: e.message, code: e.code || 'generate' }, e);
      } finally {
        if (genTrace) { try { genTrace.stop(); } catch (te) { /* ignore */ } }
        generating.value = false;
      }
    };

    const approve = async () => {
      if (!planning.value) return;
      generating.value = true;
      try { await approvePlanningFn({ planningId: planning.value.id }); planning.value.status = 'approved'; step.value = 10; } catch (e) { error.value = e.message; } finally { generating.value = false; }
    };

    const stepIndicator = () => {
      const steps = ['Tipo', 'Currículum', 'Contexto', 'Método', 'Estructura', 'Evaluación', 'Inclusión', 'Generar', 'Editar', 'Aprobar'];
      return h('div', { class: 'flex gap-1 mb-6 overflow-x-auto', role: 'progressbar', 'aria-valuenow': step.value, 'aria-valuemin': 1, 'aria-valuemax': 10 }, steps.map((l, i) => {
        const n = i + 1;
        return h('div', { class: `flex-1 text-center text-xs py-1.5 rounded ${n === step.value ? 'bg-blue-600 text-white font-medium' : n < step.value ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}` }, `${n}. ${l}`);
      }));
    };

    // Steps
    const step1 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Tipo de planificación'),
      h('p', { class: 'text-sm text-slate-500' }, '¿Qué quieres generar?'),
      h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl' },
        [
          ['class', '🤖', 'Clase con IA', 'Una clase completa generada por IA (inicio, desarrollo, cierre, evaluación)', 'Recomendado'],
          ['unit', '📚', 'Unidad didáctica', '4 a 8 clases con secuencia didáctica progresiva y evaluación de unidad', null],
          ['monthly', '🗓️', 'Planificación mensual', '4 semanas con distribución de OA y evaluación del mes', null],
          ['annual', '📅', 'Planificación anual', 'Distribución de OA y unidades a lo largo del año escolar', null],
          ['evaluation', '📊', 'Evaluación', 'Instrumentos, rúbricas e indicadores alineados al Decreto 67', null],
          ['multigrade', '👥', 'Multigrado', 'Una clase que combina dos niveles con actividades diferenciadas', null],
        ].map(([val, icon, tit, desc, tag]) =>
          h('button', {
            class: `p-4 rounded-xl border-2 text-left transition ${data.type === val ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`,
            onClick: () => { data.type = val; step.value = 2; }
          }, [
            h('span', { class: 'text-2xl' }, icon),
            h('p', { class: 'font-medium mt-1' }, tit),
            h('p', { class: 'text-xs text-slate-400 mt-0.5' }, desc),
            tag ? h('span', { class: 'mt-2 inline-block text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full' }, tag) : null,
          ])
        )),
    ]);

    const step2 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Contexto Curricular'),
      h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl' }, [
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Asignatura'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => { data.subject = e.target.value; data.oaIds = []; oas.value = []; resetAxisFilter(); resetSearch(); if (data.level) loadOAs(); } }, [h('option', { value: '' }, 'Selecciona...'), ...activeSubjects().map(s => h('option', { value: s.key }, `${s.icon || ''} ${s.name}`))])]),
        data.type === 'multigrade'
          ? h('div', { class: 'space-y-3 max-w-xl' }, [
              h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3' }, [
                h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nivel 1'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => { data.level = e.target.value; data.oaIds = []; oas.value = []; resetAxisFilter(); resetSearch(); if (data.level2) loadOAs(); } }, [h('option', { value: '' }, 'Selecciona...'), ...LEVELS.map(([v, l]) => h('option', { value: v }, l))])]),
                h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nivel 2'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => { data.level2 = e.target.value; data.oaIds = []; oas.value = []; resetAxisFilter(); resetSearch(); if (data.level) loadOAs(); } }, [h('option', { value: '' }, 'Selecciona...'), ...LEVELS.map(([v, l]) => h('option', { value: v }, l))])]),
              ]),
            ])
          : h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nivel'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => { data.level = e.target.value; data.oaIds = []; oas.value = []; resetAxisFilter(); resetSearch(); loadOAs(); } }, [h('option', { value: '' }, 'Selecciona...'), ...LEVELS.map(([v, l]) => h('option', { value: v }, l))])]),
      ]),
      availableAxes().length > 0 ? h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Eje / Unidad'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 max-w-xl', onChange: (e) => { axisFilter.value = e.target.value; if (axisFilter.value) { const inFilter = oas.value.filter(oa => (oa.axis || '').trim() === axisFilter.value); const keep = data.oaIds.filter(id => inFilter.some(oa => oa.id === id)); data.oaIds.splice(0, data.oaIds.length, ...keep); } } }, [h('option', { value: '' }, 'Todos los ejes'), ...availableAxes().map(a => h('option', { value: a }, a))])]) : null,
      h('div', { class: 'max-w-xl' }, [
        h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, '🔍 Buscar OA'),
        h('input', { type: 'search', class: 'w-full border border-slate-300 rounded-lg px-3 py-2', placeholder: 'Busca por código (p. ej. "OA 07") o por texto...', value: searchQuery.value, onInput: (e) => searchQuery.value = e.target.value }),
      ]),
      error.value ? h('div', { class: 'text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded' }, error.value) : null,
      data.oaIds.length > 0 ? h('p', { class: 'text-xs text-green-600' }, `✓ ${data.oaIds.length} OA seleccionado(s)`) : null,
      oasLoading.value ? h('p', { class: 'text-xs text-amber-600' }, 'Cargando OA...') : null,
      oasLoaded.value && oas.value.length === 0 ? h('p', { class: 'text-xs text-amber-600' }, 'No hay OA para esta asignatura y nivel. Intenta otra combinación.') : null,
      searchQuery.value.trim() && filteredOAs().length === 0 ? h('p', { class: 'text-xs text-amber-600' }, 'Sin coincidencias para tu búsqueda.') : null,
      searchQuery.value.trim() ? h('p', { class: 'text-xs text-slate-500' }, `${filteredOAs().length} resultado(s) para "${searchQuery.value}"`) : null,
      h('div', { class: 'max-h-60 overflow-y-auto space-y-1 border rounded-lg p-2' }, filteredOAs().map(oa =>
        h('label', { class: 'flex items-start gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer text-sm' }, [
          h('input', { type: 'checkbox', checked: data.oaIds.includes(oa.id), onChange: () => toggleOA(oa.id), class: 'mt-0.5' }),
          h('div', [h('span', { class: 'font-mono text-xs text-blue-600' }, oa.code), (oa.axis ? h('span', { class: 'ml-2 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded' }, oa.axis) : null), h('p', { class: 'text-xs text-slate-600' }, oa.text.slice(0, 120) + '...')]),
        ])
      )),
      h('button', { onClick: () => step.value = 3, disabled: !data.level || (data.type === 'multigrade' && !data.level2) || data.oaIds.length === 0, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step3 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Contexto Pedagógico'),
      data.type === 'unit' ? h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Número de clases'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.numClasses = parseInt(e.target.value) }, [4, 5, 6, 7, 8].map(n => h('option', { value: n }, `${n} clases`)))]) : null,
      data.type === 'monthly' ? h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Semanas del mes'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.numClasses = parseInt(e.target.value) }, [3, 4, 5].map(n => h('option', { value: n }, `${n} semanas`)))]) : null,
      data.type === 'annual' ? h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Meses del año'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.numClasses = parseInt(e.target.value) }, [8, 9, 10, 11, 12].map(n => h('option', { value: n }, `${n} meses`)))]) : null,
      data.type === 'evaluation' ? h('div', { class: 'grid grid-cols-2 gap-3' }, [
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Tipo de evaluación'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.evaluationType = e.target.value }, [['diagnostica', 'Diagnóstica'], ['formativa', 'Formativa'], ['sumativa', 'Sumativa']].map(([v, l]) => h('option', { value: v }, l)))]),
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Instrumento'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.instrument = e.target.value }, [['prueba', 'Prueba escrita'], ['rubrica', 'Rúbrica'], ['lista-cotejo', 'Lista de cotejo'], ['proyecto', 'Proyecto'], ['portafolio', 'Portafolio']].map(([v, l]) => h('option', { value: v }, l)))]),
      ]) : null,
      data.type !== 'annual' ? h('div', { class: 'grid grid-cols-2 gap-3' }, [
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, data.type === 'unit' ? 'Duración por clase' : 'Duración'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.duration = parseInt(e.target.value) }, [h('option', { value: 45 }, '45 min'), h('option', { value: 90 }, '90 min')])]),
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Modalidad'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.modality = e.target.value }, [['presencial', 'Presencial'], ['hibrida', 'Híbrida'], ['remota', 'Remota']].map(([v, l]) => h('option', { value: v }, l)))])]) : null,
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Estudiantes (aprox.)'), h('input', { type: 'number', class: 'w-full border border-slate-300 rounded-lg px-3 py-2', placeholder: '30', onInput: (e) => data.studentCount = e.target.value })]),
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Conocimientos previos'), h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', rows: 2, placeholder: 'Lo que los estudiantes ya saben...', onInput: (e) => data.priorKnowledge = e.target.value }), h('p', { class: 'text-xs text-amber-600 mt-1' }, 'No uses nombres ni RUT de estudiantes.')]),
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Recursos (separados por coma)'), h('input', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', placeholder: 'proyector, cuadernos, mapas', onInput: (e) => data.resources = e.target.value })]),
      h('button', { onClick: () => step.value = 4, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step4 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Enfoque Metodológico'),
      h('div', { class: 'grid grid-cols-2 gap-2 max-w-lg' },
        [['Clase dialogada', 'dialogada'], ['Aprendizaje Basado en Problemas', 'abp'], ['Aprendizaje Cooperativo', 'cooperativo'], ['Indagación', 'indagacion'], ['Gamificación', 'gamificacion'], ['Pensamiento Visible', 'pensamiento-visible']].map(([l, v]) =>
          h('button', { class: `p-3 rounded-lg border text-left text-sm transition ${data.methodology === v ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`, onClick: () => { data.methodology = v; step.value = 5; } }, l)
        )),
    ]);

    const step5 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Estructura'),
      data.type === 'unit' ? h('div', { class: 'space-y-2' }, [
        h('p', { class: 'text-sm text-slate-500' }, `Tu unidad de ${data.numClasses} clases tendrá una secuencia didáctica progresiva:`),
        h('div', { class: 'bg-blue-50 p-4 rounded-lg text-sm space-y-1' }, [
          h('p', { class: 'font-medium' }, 'Estructura sugerida de unidad:'),
          h('ul', { class: 'list-disc pl-4 text-slate-600 space-y-0.5' }, [
            h('li', 'Clases 1-2: Activación y construcción de conocimientos'),
            h('li', 'Clases 3-4: Aplicación y práctica guiada'),
            h('li', 'Clases 5-6: Consolidación, transferencia y evaluación'),
            h('li', 'Cada clase: Inicio → Desarrollo → Cierre con evaluación formativa'),
          ]),
        ]),
      ]) : data.type === 'monthly' ? h('div', { class: 'space-y-2' }, [
        h('p', { class: 'text-sm text-slate-500' }, `Tu mes se organizará en ${data.numClasses} semanas:`),
        h('div', { class: 'bg-blue-50 p-4 rounded-lg text-sm space-y-1' }, [
          h('p', { class: 'font-medium' }, 'Estructura sugerida:'),
          h('ul', { class: 'list-disc pl-4 text-slate-600 space-y-0.5' }, [
            h('li', 'Distribución equilibrada de OA entre las semanas'),
            h('li', 'Evaluación acumulativa al final del mes'),
            h('li', 'Actividades con momentos inicio/desarrollo/cierre por semana'),
          ]),
        ]),
      ]) : data.type === 'annual' ? h('div', { class: 'space-y-2' }, [
        h('p', { class: 'text-sm text-slate-500' }, `Tu año se organizará en ${data.numClasses} meses:`),
        h('div', { class: 'bg-blue-50 p-4 rounded-lg text-sm space-y-1' }, [
          h('p', { class: 'font-medium' }, 'Estructura sugerida:'),
          h('ul', { class: 'list-disc pl-4 text-slate-600 space-y-0.5' }, [
            h('li', 'Distribución progresiva de OA a lo largo del año'),
            h('li', 'Complejidad creciente mes a mes'),
            h('li', 'Evaluación formativa continua y sumativa al cierre'),
          ]),
        ]),
      ]) : data.type === 'evaluation' ? h('div', { class: 'space-y-2' }, [
        h('p', { class: 'text-sm text-slate-500' }, 'Tu evaluación se alineará al Decreto 67:'),
        h('div', { class: 'bg-blue-50 p-4 rounded-lg text-sm space-y-1' }, [
          h('p', { class: 'font-medium' }, 'Componentes:'),
          h('ul', { class: 'list-disc pl-4 text-slate-600 space-y-0.5' }, [
            h('li', 'Indicadores de logro observables y medibles'),
            h('li', 'Rúbrica con dimensiones y niveles (Logrado/Medio/En desarrollo)'),
            h('li', 'Criterios de evaluación y estrategia de retroalimentación'),
          ]),
        ]),
      ]) : data.type === 'multigrade' ? h('div', { class: 'space-y-2' }, [
        h('p', { class: 'text-sm text-slate-500' }, `Tu clase combina ${levelLabel(data.level)} y ${levelLabel(data.level2)}:`),
        h('div', { class: 'bg-blue-50 p-4 rounded-lg text-sm space-y-1' }, [
          h('p', { class: 'font-medium' }, 'Estructura sugerida:'),
          h('ul', { class: 'list-disc pl-4 text-slate-600 space-y-0.5' }, [
            h('li', 'Momentos de trabajo conjunto entre ambos niveles'),
            h('li', 'Momentos de trabajo diferenciado por nivel'),
            h('li', 'Criterios de evaluación diferenciados'),
          ]),
        ]),
      ]) : h('div', { class: 'space-y-2' }, [
        h('p', { class: 'text-sm text-slate-500' }, 'La estructura sugerida es: Inicio (10-15%) → Desarrollo (60-70%) → Cierre (10-15%). Puedes personalizarla después en el editor.'),
        h('div', { class: 'bg-blue-50 p-4 rounded-lg text-sm space-y-1' }, [
          h('p', { class: 'font-medium' }, 'Estructura estándar:'), h('ul', { class: 'list-disc pl-4 text-slate-600 space-y-0.5' }, [h('li', 'Inicio: Activación, propósito'), h('li', 'Desarrollo: Modelamiento, práctica, monitoreo'), h('li', 'Cierre: Síntesis, evaluación, retroalimentación')]),
        ]),
      ]),
      h('button', { onClick: () => step.value = 6, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step6 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, data.type === 'annual' ? 'Evaluación Anual' : 'Evaluación'),
      h('p', { class: 'text-sm text-slate-500' }, data.type === 'annual' ? 'La evaluación anual se define dentro de la distribución. Continúa para configurar la inclusión.' : 'Define el enfoque de evaluación (Decreto N.° 67)'),
      data.type === 'annual' ? null : h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2' }, [h('option', { value: 'formativa' }, 'Evaluación Formativa'), h('option', { value: 'sumativa' }, 'Evaluación Sumativa')]),
      h('button', { onClick: () => step.value = 7, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const duaGroups = [
      { key: 'representacion', icon: '👁️', title: 'Representación', desc: 'El "qué" del aprendizaje — múltiples formas de presentar la información', options: [
        ['percepcion', 'Opciones de percepción (auditivo, visual, kinestésico)'],
        ['lenguaje', 'Lenguaje claro, vocabulario y símbolos explícitos'],
        ['conocimientos', 'Activación de conocimientos previos'],
        ['formatos', 'Materiales en múltiples formatos (texto, audio, imagen)'],
      ]},
      { key: 'accionExpresion', icon: '✍️', title: 'Acción y Expresión', desc: 'El "cómo" del aprendizaje — múltiples formas de demostrar lo aprendido', options: [
        ['respuestas', 'Variedad de formas de responder (oral, escrita, visual)'],
        ['organizadores', 'Organizadores gráficos y herramientas de apoyo'],
        ['metas', 'Metas y objetivos de aprendizaje claros'],
        ['monitoreo', 'Monitoreo y seguimiento del progreso'],
      ]},
      { key: 'implicacion', icon: '❤️', title: 'Implicación', desc: 'El "porqué" del aprendizaje — múltiples formas de motivar y comprometer', options: [
        ['interes', 'Opciones de interés y motivación'],
        ['relevancia', 'Tareas relevantes y auténticas'],
        ['colaboracion', 'Colaboración y comunidad'],
        ['autorregulacion', 'Autorregulación y retroalimentación'],
      ]},
    ];

    const toggleDua = (groupKey, optKey) => {
      const arr = data.dua[groupKey];
      const i = arr.indexOf(optKey);
      if (i >= 0) arr.splice(i, 1); else arr.push(optKey);
    };

    const step7 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Inclusión y Accesibilidad'),
      h('p', { class: 'text-sm text-slate-500' }, 'Elige el marco pedagógico de inclusión y describe barreras (información agregada, sin diagnósticos individuales).'),
      h('div', { class: 'grid grid-cols-1 gap-2 max-w-lg' }, [
        ['dua', '📐', 'DUA completo (recomendado)', 'Diseño Universal para el Aprendizaje — representación, acción/expresión e implicación'],
        ['estandar', '🧩', 'Formato estándar', 'Diferenciación básica sin estructura DUA explícita'],
      ].map(([val, icon, tit, desc]) =>
        h('button', { class: `p-3 rounded-xl border-2 text-left transition ${data.framework === val ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`, onClick: () => data.framework = val }, [
          h('p', { class: 'font-medium text-sm' }, `${icon} ${tit}`),
          h('p', { class: 'text-xs text-slate-500 mt-0.5' }, desc),
        ])
      )),
      data.framework === 'dua' ? h('div', { class: 'space-y-3' }, duaGroups.map(g =>
        Card([h('div', { class: 'p-4' }, [
          h('h3', { class: 'font-medium text-sm text-slate-800 flex items-center gap-2' }, [h('span', g.icon), g.title]),
          h('p', { class: 'text-xs text-slate-500 mb-2' }, g.desc),
          h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-1' }, g.options.map(([k, label]) =>
            h('label', { class: 'flex items-start gap-2 text-xs p-1.5 rounded hover:bg-slate-50 cursor-pointer' }, [
              h('input', { type: 'checkbox', checked: data.dua[g.key].includes(k), onChange: () => toggleDua(g.key, k), class: 'mt-0.5' }),
              h('span', { class: 'text-slate-600' }, label),
            ])
          )),
        ])])
      )) : null,
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Barreras observadas (opcional)'), h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', rows: 3, placeholder: 'Ej: estudiantes que requieren apoyo en lectura...', onInput: (e) => data.barriers = e.target.value })]),
      h('p', { class: 'text-xs text-amber-600' }, 'No incluyas diagnósticos clínicos ni nombres de estudiantes.'),
      h('button', { onClick: () => step.value = 8, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step8 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Generar Planificación'),
      Card([h('div', { class: 'p-4 space-y-2 text-sm' }, [
        h('p', { class: 'font-medium' }, 'Resumen de lo que se enviará a DeepSeek:'),
        h('ul', { class: 'text-slate-600 space-y-1 text-xs' }, [
          h('li', `Tipo: ${({ class: 'Clase', unit: 'Unidad didáctica', monthly: 'Mensual', annual: 'Anual', evaluation: 'Evaluación', multigrade: 'Multigrado' })[data.type]}`),
          h('li', `Nivel: ${data.type === 'multigrade' ? levelLabel(data.level) + ' + ' + levelLabel(data.level2) : (levelLabel(data.level) || '-')}`),
          h('li', `Asignatura: ${subjectLabel(data.subject)}`),
          h('li', `OA seleccionados: ${data.oaIds.length}`),
          data.type === 'unit' ? h('li', `Clases: ${data.numClasses} · Duración por clase: ${data.duration} min`) : null,
          data.type === 'monthly' ? h('li', `Semanas: ${data.numClasses} · Duración semanal: ${data.duration} min`) : null,
          data.type === 'annual' ? h('li', `Meses: ${data.numClasses}`) : null,
          data.type === 'evaluation' ? h('li', `Evaluación ${({ diagnostica: 'diagnóstica', formativa: 'formativa', sumativa: 'sumativa' })[data.evaluationType]} · Instrumento: ${({ prueba: 'prueba escrita', rubrica: 'rúbrica', 'lista-cotejo': 'lista de cotejo', proyecto: 'proyecto', portafolio: 'portafolio' })[data.instrument]}`) : null,
          data.type !== 'annual' ? h('li', `Duración: ${data.duration} min · Modalidad: ${data.modality}`) : null,
          h('li', `Marco de inclusión: ${data.framework === 'dua' ? 'DUA (${data.dua.representacion.length + data.dua.accionExpresion.length + data.dua.implicacion.length} estrategias)' : 'Estándar'}`),
        ]),
        h('div', { class: 'bg-amber-50 border border-amber-200 p-3 rounded-lg mt-3 text-xs text-amber-800 space-y-1' }, [
          h('p', { class: 'font-medium' }, '⚠ Importante:'),
          h('ul', { class: 'list-disc pl-3 space-y-0.5' }, [
            h('li', 'No se enviarán datos personales de estudiantes'),
            h('li', 'La información se envía a DeepSeek (proveedor de IA)'),
            h('li', 'El resultado es un borrador que requiere revisión y aprobación'),
          ]),
        ]),
      ])]),
      Alert('error', error.value),
      h('button', { onClick: generate, disabled: generating.value, class: 'w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2' }, generating.value ? [Spinner(5), 'Generando...'] : 'Generar Planificación'),
    ]);

    const step9 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('div', { class: 'flex items-center justify-between' }, [
        h('h2', { class: 'text-lg font-semibold' }, 'Planificación Generada'),
        planning.value?.status === 'approved' ? h('span', { class: 'bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full' }, '✓ Aprobada') : null,
      ]),
      planning.value?.warnings?.length > 0 ? h('div', { class: 'bg-amber-50 border border-amber-200 p-3 rounded-lg' }, [
        h('p', { class: 'text-sm font-medium text-amber-800 mb-1' }, `⚠ ${planning.value.warnings.length} advertencia(s)`),
        ...planning.value.warnings.map(w => h('p', { class: 'text-xs text-amber-700' }, `[${w.type}] ${w.description}`)),
      ]) : null,
      Alert('error', error.value),
      planning.value?.purpose ? Card([h('div', { class: 'p-4' }, [
        h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Propósito'),
        h('p', { class: 'text-sm text-slate-600' }, planning.value.purpose),
      ])]) : null,
      planning.value?.unit?.title ? Card([h('div', { class: 'p-4' }, [
        h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, planning.value.unit.title),
        planning.value.unit.description ? h('p', { class: 'text-sm text-slate-600 mb-2' }, planning.value.unit.description) : null,
        (planning.value.unit.classes || []).map(c => h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-2' }, [
          h('p', { class: 'text-xs font-medium text-blue-600' }, `Clase ${c.number}: ${c.title} (${c.duration || '-'} min)`),
          h('p', { class: 'text-xs text-slate-500' }, `${(c.activities || []).length} actividades · ${(c.oaCodes || []).join(', ')}`),
        ])),
        (planning.value.unit.weeks || []).map(w => h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-2' }, [
          h('p', { class: 'text-xs font-medium text-blue-600' }, `Semana ${w.number}: ${w.topic}`),
          h('p', { class: 'text-xs text-slate-500' }, `${(w.activities || []).length} actividades · ${(w.oaCodes || []).join(', ')}`),
        ])),
        (planning.value.unit.months || []).map(m => h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-2' }, [
          h('p', { class: 'text-xs font-medium text-blue-600' }, `Mes ${m.number}: ${m.name || ''} — ${m.topic || ''}`),
          h('p', { class: 'text-xs text-slate-500' }, (m.oaCodes || []).join(', ')),
        ])),
      ])]) : null,
      planning.value?.evaluation ? Card([h('div', { class: 'p-4' }, [
        h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Evaluación'),
        h('p', { class: 'text-xs text-blue-600' }, `Tipo: ${planning.value.evaluation.type} · ${(planning.value.evaluation.instrument || []).join(', ')}`),
        ...(planning.value.evaluation.indicators || []).map(ind => h('p', { class: 'text-xs text-slate-600' }, `• ${ind}`)),
      ])]) : null,
      planning.value?.activities?.length > 0 ? Card([h('div', { class: 'p-4' }, [
        h('h3', { class: 'font-medium text-sm text-slate-700 mb-2' }, 'Actividades'),
        ...planning.value.activities.map((a, i) =>
          h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-2' }, [
            h('p', { class: 'text-xs font-medium text-blue-600' }, `${a.moment} · ${a.duration} min`),
            h('p', { class: 'text-sm' }, a.title || a.description),
          ])
        ),
      ])]) : null,
      planning.value?.id && planning.value?.status !== 'approved'
        ? h('button', { onClick: approve, disabled: generating.value, class: 'w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition' }, generating.value ? 'Aprobando...' : '✓ Aprobar Planificación')
        : planning.value?.status === 'approved'
          ? h('div', { class: 'bg-green-50 border border-green-200 p-4 rounded-lg text-center' }, [
              h('p', { class: 'text-green-700 font-medium' }, '✅ Planificación aprobada'),
              h('a', { href: '#/dashboard', class: 'text-sm text-blue-600 hover:underline mt-2 inline-block' }, 'Volver al dashboard'),
            ])
          : null,
    ]);

    const step10 = () => h('div', { class: 'text-center py-12' }, [
      h('div', { class: 'text-5xl mb-4' }, '✅'),
      h('h2', { class: 'text-xl font-semibold mb-2' }, 'Planificación Aprobada'),
      h('p', { class: 'text-slate-500 mb-6' }, 'Tu planificación ha sido aprobada y guardada. Puedes verla en tu dashboard.'),
      h('div', { class: 'flex justify-center gap-3' }, [
        planning.value?.id ? h('a', { href: `#/planificacion/${planning.value.id}`, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm' }, 'Ver planificación') : null,
        h('a', { href: '#/dashboard', class: 'bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm' }, 'Dashboard'),
      ]),
    ]);

    const renderStep = () => {
      const steps = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6, 7: step7, 8: step8, 9: step9, 10: step10 };
      return (steps[step.value] || (() => h('p', 'Paso no encontrado')))();
    };

    // Trazabilidad
    const trace = planning.value?.aiContributions?.[0];
    const traceInfo = trace ? h('div', { class: 'mt-8 p-3 bg-slate-50 rounded-lg text-xs text-slate-400' }, [
      h('p', `Generado con: ${trace.provider} / ${trace.model}`),
      h('p', `Fecha: ${new Date(trace.generatedAt).toLocaleString('es-CL')}`),
      h('p', `Tokens: ${trace.inputTokens || '?'} entrada / ${trace.outputTokens || '?'} salida · Costo: $${(trace.cost || 0).toFixed(5)}`),
    ]) : null;

    return () => h(Layout, { title: 'Nueva Planificación', subtitle: 'Sigue los pasos para generar tu planificación de clase' }, () => [
      stepIndicator(),
      renderStep(),
      traceInfo,
    ]);
  }
});

export { WizardPage };
