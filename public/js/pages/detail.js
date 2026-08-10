import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, generateActivityVariantsFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, isAdmin, isOrgAdmin } from '../core.js';

// Carga diferida (S-5.4): detalle, comentarios y feedback.
const PlanningDetailPage = defineComponent({
  setup() {
    if (!guard()) return () => null;
    const planning = ref(null); const loading = ref(true); const error = ref(''); const exporting = ref(false);
    const comments = ref([]); const newComment = ref(''); const commentError = ref(''); const addingComment = ref(false);
    const isOwnerView = ref(false);
    const variantLoading = ref(null); const activityVariants = ref({}); const variantError = ref('');

    const id = window.location.hash.split('/').pop();
    const loadComments = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'plannings', id, 'comments'), orderBy('createdAt', 'asc'), limit(100)));
        comments.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { /* ignore */ }
    };
    const loadPlanning = async () => {
      const snap = await getDoc(doc(db, 'plannings', id));
      if (!snap.exists()) { error.value = 'Planificación no encontrada'; return; }
      const data = snap.data();
      const sameOrg = data.orgId && store.org && data.orgId === store.org.id;
      if (data.userId !== store.user.uid && !sameOrg) { error.value = 'No tienes acceso a esta planificación'; return; }
      isOwnerView.value = data.userId === store.user.uid;
      planning.value = { id: snap.id, ...data };
      loadComments();
    };

    onMounted(async () => {
      try {
        loading.value = true;
        await loadPlanning();
      } catch (e) { error.value = 'Error al cargar planificación'; } finally { loading.value = false; }
    });

    const statusBadge = (s) => {
      const map = { draft: ['bg-yellow-100 text-yellow-700', 'Borrador'], approved: ['bg-green-100 text-green-700', 'Aprobada'] };
      const [c, t] = map[s] || ['bg-slate-100 text-slate-500', s];
      return h('span', { class: `text-xs px-2 py-0.5 rounded-full ${c}` }, t);
    };

    const handleExport = async (format) => {
      exporting.value = true;
      try {
        const result = await exportPlanningFn({ planningId: planning.value.id, format });

        if (format === 'docx' && result.data.url) {
          const a = document.createElement('a');
          a.href = result.data.url;
          a.download = result.data.filename || `planificacion-${planning.value.id}.docx`;
          a.click();
          return;
        }

        if (format === 'pdf') {
          // Usar window.print() para PDF
          window.print();
          return;
        }
      } catch (e) {
        console.error('Export error:', e);
        alert('Error al exportar. Intenta de nuevo.');
      } finally {
        exporting.value = false;
      }
    };

    const exportButtons = () => h('div', { class: 'flex gap-2' }, [
      h('button', {
        onClick: () => handleExport('docx'),
        disabled: exporting.value,
        class: 'bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-1',
      }, [h('span', exporting.value ? 'Exportando...' : 'DOCX')]),
      h('button', {
        onClick: () => handleExport('pdf'),
        disabled: exporting.value,
        class: 'bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1',
      }, [h('span', 'PDF')]),
    ]);

    const canApproveAsUtp = () => planning.value
      && planning.value.status === 'draft'
      && !isOwnerView.value
      && isOrgAdmin()
      && planning.value.orgId === store.org?.id;

    const approveAsUtp = async () => {
      try {
        await approvePlanningFn({ planningId: planning.value.id });
        planning.value.status = 'approved';
        planning.value.approvedAt = new Date().toISOString();
        planning.value.approvedBy = 'utp:' + store.user.uid;
      } catch (e) {
        commentError.value = e.message || 'No se pudo aprobar la planificación.';
      }
    };

    const addComment = async () => {
      const text = newComment.value.trim();
      if (!text) return;
      commentError.value = '';
      addingComment.value = true;
      try {
        await addDoc(collection(db, 'plannings', planning.value.id, 'comments'), {
          userId: store.user.uid,
          displayName: store.profile?.displayName || store.user.displayName || store.user.email,
          text,
          createdAt: new Date().toISOString(),
          planningId: planning.value.id,
        });
        newComment.value = '';
        await loadComments();
      } catch (e) {
        commentError.value = 'No se pudo enviar el comentario.';
      } finally { addingComment.value = false; }
    };

    // B8: regeneración por sección.
    const regenSection = ref('purpose');
    const regenDraft = ref(null);
    const regening = ref(false);
    const regenError = ref('');
    const sectionOptions = () => {
      const t = planning.value && planning.value.type;
      if (t === 'unit') return [['purpose', 'Propósito'], ['unit.classes', 'Clases'], ['unit.assessment', 'Evaluación de unidad']];
      if (t === 'monthly') return [['purpose', 'Propósito'], ['unit.weeks', 'Semanas'], ['unit.assessment', 'Evaluación del mes']];
      if (t === 'annual') return [['purpose', 'Propósito'], ['unit.months', 'Mes del año']];
      if (t === 'evaluation') return [['purpose', 'Propósito'], ['evaluation', 'Evaluación']];
      if (t === 'multigrade') return [['purpose', 'Propósito'], ['activities', 'Actividades'], ['differentiation', 'Diferenciación']];
      return [['purpose', 'Propósito'], ['activities', 'Actividades'], ['assessment', 'Evaluación'], ['differentiation', 'Diferenciación'], ['resources', 'Recursos']];
    };
    const startRegen = async () => {
      regenError.value = '';
      const section = regenSection.value;
      const confirmed = window.confirm('Regenerar esta sección con IA? El borrador se mostrará para que la aceptes o rechaces antes de guardar.');
      if (!confirmed) return;
      regening.value = true;
      try {
        const res = await regenerateSectionFn({ planningId: planning.value.id, section });
        regenDraft.value = res.data;
      } catch (e) {
        regenError.value = e.message || 'No se pudo regenerar la sección.';
      } finally { regening.value = false; }
    };
    const acceptDraft = async () => {
      const section = regenDraft.value.section;
      const content = regenDraft.value.content;
      regenError.value = '';
      regening.value = true;
      try {
        if (typeof content === 'string') {
          planning.value[section] = content;
        } else if (section.startsWith('unit.') && planning.value.unit) {
          planning.value.unit[section.replace('unit.', '')] = content;
        } else {
          planning.value[section] = content;
        }
        planning.value.version = (planning.value.version || 1) + 1;
        regenDraft.value = null;
        await loadPlanning();
      } catch (e) { regenError.value = e.message || 'No se pudo guardar.'; }
      finally { regening.value = false; }
    };
    const rejectDraft = () => { regenDraft.value = null; };

    const generateVariants = async (activity, index) => {
      variantLoading.value = index;
      variantError.value = '';
      try {
        const res = await generateActivityVariantsFn({ planningId: planning.value.id, activityId: activity.id || index, resources: planning.value.contextExtension?.physicalResources || [] });
        activityVariants.value = { ...activityVariants.value, [index]: res.data?.variants || [] };
      } catch (e) {
        variantError.value = e.message || 'No se pudieron generar las variantes.';
      } finally { variantLoading.value = null; }
    };

    return () => h(Layout, { title: 'Detalle de Planificación' }, () => [
      loading.value ? h('div', { class: 'flex justify-center py-12' }, Spinner(8)) :
      error.value ? Alert('error', error.value) :
      !planning.value ? EmptyState('📋', 'No encontrada', 'La planificación no existe o fue eliminada') :
      h('div', { class: 'space-y-4 max-w-2xl' }, [
        Card([h('div', { class: 'p-6 space-y-4' }, [
          h('div', { class: 'flex items-center justify-between' }, [
            h('h2', { class: 'text-xl font-bold' }, planning.value.title || 'Sin título'),
            statusBadge(planning.value.status),
          ]),
          h('div', { class: 'flex flex-wrap gap-2 text-xs text-slate-500' }, [
            h('span', { class: 'bg-blue-50 text-blue-700 px-2 py-1 rounded' }, ({ class: 'Clase', unit: 'Unidad didáctica', monthly: 'Mensual', annual: 'Anual', evaluation: 'Evaluación', multigrade: 'Multigrado' })[planning.value.type] || 'Clase'),
            h('span', { class: 'bg-slate-100 px-2 py-1 rounded' }, planning.value.levels?.length ? planning.value.levels.map(l => levelLabel(l)).join(' + ') : (planning.value.level?.replace('-basico', '° básico'))),
            planning.value.type !== 'annual' ? h('span', { class: 'bg-slate-100 px-2 py-1 rounded' }, planning.value.duration + ' min') : null,
            h('span', { class: 'bg-slate-100 px-2 py-1 rounded' }, planning.value.modality),
            planning.value.approvedAt ? h('span', { class: 'bg-green-100 text-green-700 px-2 py-1 rounded' }, `Aprobada: ${new Date(planning.value.approvedAt).toLocaleDateString('es-CL')}`) : null,
          ]),
          planning.value.learningObjectives?.length > 0 ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Objetivos de Aprendizaje'),
            ...planning.value.learningObjectives.map(oa => h('p', { class: 'text-sm text-slate-600' }, `${oa.code}: ${oa.text.slice(0, 100)}...`)),
          ]) : null,
          planning.value.purpose ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Propósito'),
            h('p', { class: 'text-sm text-slate-600' }, planning.value.purpose),
          ]) : null,
          planning.value.unit ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, planning.value.unit.title || 'Unidad'),
            planning.value.unit.description ? h('p', { class: 'text-xs text-slate-500 mb-2' }, planning.value.unit.description) : null,
            (planning.value.unit.classes || []).map(c => h('div', { class: 'border-l-2 border-blue-300 pl-3 py-2 mb-2' }, [
              h('p', { class: 'text-xs font-medium text-blue-600' }, `Clase ${c.number}: ${c.title} (${c.duration || '-'} min)`),
              c.purpose ? h('p', { class: 'text-xs text-slate-600' }, c.purpose) : null,
              (c.activities || []).map(a => h('div', { class: 'ml-2 border-l border-slate-200 pl-2 py-0.5' }, [
                h('span', { class: 'text-xs font-medium text-slate-500' }, `${a.moment} · ${a.duration} min: `),
                h('span', { class: 'text-xs text-slate-600' }, a.title || a.description),
              ])),
            ])),
            (planning.value.unit.weeks || []).map(w => h('div', { class: 'border-l-2 border-blue-300 pl-3 py-2 mb-2' }, [
              h('p', { class: 'text-xs font-medium text-blue-600' }, `Semana ${w.number}: ${w.topic}`),
              h('p', { class: 'text-xs text-slate-500' }, (w.oaCodes || []).join(', ')),
              (w.activities || []).map(a => h('div', { class: 'ml-2 border-l border-slate-200 pl-2 py-0.5' }, [
                h('span', { class: 'text-xs font-medium text-slate-500' }, `${a.moment} · ${a.duration} min: `),
                h('span', { class: 'text-xs text-slate-600' }, a.title || a.description),
              ])),
            ])),
            (planning.value.unit.months || []).map(m => h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-1' }, [
              h('p', { class: 'text-xs font-medium text-blue-600' }, `Mes ${m.number}: ${m.name || ''} — ${m.topic || ''}`),
              h('p', { class: 'text-xs text-slate-500' }, (m.oaCodes || []).join(', ')),
              m.notes ? h('p', { class: 'text-xs text-slate-400' }, m.notes) : null,
            ])),
            planning.value.unit.assessment?.criteria?.length ? h('div', { class: 'mt-2' }, [
              h('p', { class: 'text-xs font-medium text-slate-700' }, 'Evaluación de la unidad/periodo:'),
              ...planning.value.unit.assessment.criteria.map(c => h('p', { class: 'text-xs text-slate-600' }, `• ${c}`)),
            ]) : null,
          ]) : null,
          planning.value.evaluation ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Evaluación'),
            h('p', { class: 'text-xs text-slate-500' }, `Tipo: ${planning.value.evaluation.type} · Instrumento: ${(planning.value.evaluation.instrument || []).join(', ')}`),
            planning.value.evaluation.description ? h('p', { class: 'text-xs text-slate-600 mt-1' }, planning.value.evaluation.description) : null,
            (planning.value.evaluation.indicators || []).length ? h('div', { class: 'mt-2' }, [
              h('p', { class: 'text-xs font-medium text-slate-700' }, 'Indicadores de logro:'),
              ...planning.value.evaluation.indicators.map(i => h('p', { class: 'text-xs text-slate-600' }, `• ${i}`)),
            ]) : null,
            (planning.value.evaluation.rubric || []).map(r => h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-1' }, [
              h('p', { class: 'text-xs font-medium text-blue-600' }, r.dimension || r.name),
              h('p', { class: 'text-xs text-slate-500' }, `Logrado: ${r.logrado || '-'} · Medio: ${r.medio || '-'} · En desarrollo: ${r.enDesarrollo || '-'}`),
            ])),
          ]) : null,
          planning.value.activities?.length > 0 ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-2' }, 'Actividades'),
            ...planning.value.activities.map((a, i) =>
              h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-2' }, [
                h('div', { class: 'flex items-center gap-2 text-xs' }, [
                  h('span', { class: 'font-medium text-blue-600' }, a.moment),
                  h('span', { class: 'text-slate-400' }, a.duration + ' min'),
                  a.targetLevel ? h('span', { class: 'bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600' }, levelLabel(a.targetLevel)) : null,
                ]),
                h('p', { class: 'text-sm' }, a.description || a.title),
                h('button', { type: 'button', class: 'text-xs text-blue-700 hover:underline mt-1', onClick: () => generateVariants(a, i), disabled: variantLoading.value === i }, variantLoading.value === i ? 'Generando variantes...' : 'Generar variantes A/B/C/D'),
                activityVariants.value[i]?.length ? h('div', { class: 'mt-2 space-y-1 bg-slate-50 rounded p-2' }, activityVariants.value[i].map(variant => h('div', { class: 'text-xs' }, [h('span', { class: 'font-medium text-blue-700' }, `${variant.id}: ${variant.label || variant.type}`), h('span', { class: 'text-slate-600' }, ` — ${variant.description}`)]))) : null,
              ])
            ),
            variantError.value ? h('p', { class: 'text-xs text-red-700', role: 'alert' }, variantError.value) : null,
          ]) : null,
        ])]),
        planning.value.warnings?.length > 0 ? Card([h('div', { class: 'p-4' }, [
          h('div', { class: 'flex items-center gap-2 text-sm font-medium text-amber-800 mb-2' }, [
            h('span', '⚠'),
            h('span', `Advertencias pedagógicas (${planning.value.warnings.length})`),
          ]),
          h('div', { class: 'space-y-1' }, planning.value.warnings.map(w =>
            h('div', { class: `flex items-start gap-2 text-xs p-2 rounded ${w.type === 'critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}` }, [
              h('span', { class: 'font-mono font-medium' }, `[${w.ruleId || w.type}]`),
              h('span', w.description || w.msg),
            ])
          )),
        ])]) : null,
        planning.value.quality ? Card([h('div', { class: 'p-4' }, [
          h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800 mb-2' }, [
            h('span', '⭐'),
            h('span', 'Calidad y coherencia'),
          ]),
          h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-2' }, [
            h('div', { class: 'border border-slate-200 rounded-lg p-3' }, [
              h('p', { class: 'text-xs font-medium text-slate-600 mb-1' }, 'Calidad (rúbrica interna)'),
              h('div', { class: 'flex items-center gap-2' }, [
                h('span', { class: 'text-lg font-bold ' + (planning.value.quality.score >= 4 ? 'text-green-600' : planning.value.quality.score >= 2.5 ? 'text-amber-600' : 'text-red-600') }, (planning.value.quality.score ?? 0).toFixed(1)),
                h('span', { class: 'text-xs text-slate-500' }, '/ 5 ' + (planning.value.quality.verdict || '')),
              ]),
            ]),
            planning.value.coherenceReview ? h('div', { class: 'border border-slate-200 rounded-lg p-3' }, [
              h('p', { class: 'text-xs font-medium text-slate-600 mb-1' }, 'Revisión de coherencia (IA)'),
              h('div', { class: 'flex items-center gap-2' }, [
                h('span', { class: 'text-lg font-bold ' + (planning.value.coherenceReview.score >= 3 ? 'text-green-600' : planning.value.coherenceReview.score >= 2.5 ? 'text-amber-600' : 'text-red-600') }, (planning.value.coherenceReview.score ?? 0).toFixed(1)),
                h('span', { class: 'text-xs text-slate-500' }, '/ 5 · ' + (planning.value.coherenceReview.verdict || '')),
              ]),
              (planning.value.coherenceReview.issues || []).length ? h('div', { class: 'mt-2 space-y-1' }, planning.value.coherenceReview.issues.map(function (i) { return h('div', { class: 'text-xs text-amber-700 bg-amber-50 rounded p-1.5' }, '[' + (i.dimension || '') + '] ' + (i.descripcion || '')); })) : h('p', { class: 'text-xs text-green-600 mt-1' }, 'Sin observaciones de coherencia.'),
            ]) : null,
          ]),
        ])]) : null,
        planning.value.dua ? Card([h('div', { class: 'p-4' }, [
          h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800 mb-2' }, [
            h('span', '📐'),
            h('span', 'DUA (Diseño Universal para el Aprendizaje)'),
            h('span', { class: 'bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded' }, planning.value.framework === 'estandar' ? 'Formato estándar' : 'DUA completo'),
          ]),
          planning.value.framework !== 'estandar' ? h('div', { class: 'space-y-2' }, [
            h('div', [h('p', { class: 'text-xs font-medium text-slate-600 mb-0.5' }, '👁️ Representación (el "qué")'), ...(planning.value.dua.representacion || []).map(s => h('p', { class: 'text-xs text-slate-600' }, `• ${s}`))]),
            h('div', [h('p', { class: 'text-xs font-medium text-slate-600 mb-0.5' }, '✍️ Acción y Expresión (el "cómo")'), ...(planning.value.dua.accionExpresion || []).map(s => h('p', { class: 'text-xs text-slate-600' }, `• ${s}`))]),
            h('div', [h('p', { class: 'text-xs font-medium text-slate-600 mb-0.5' }, '❤️ Implicación (el "porqué")'), ...(planning.value.dua.implicacion || []).map(s => h('p', { class: 'text-xs text-slate-600' }, `• ${s}`))]),
          ]) : null,
          planning.value.barriers ? h('div', { class: 'mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded' }, `Barreras: ${planning.value.barriers}`) : null,
        ])]) : null,
        h('div', { class: 'flex gap-2' }, [
          h('a', { href: '#/dashboard', class: 'bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition' }, '← Volver'),
          isOwnerView.value ? h('a', { href: `#/editar/${planning.value.id}`, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, '✏️ Editar') : null,
          canApproveAsUtp() ? h('button', { onClick: approveAsUtp, class: 'bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition' }, '✓ Aprobar (UTP)') : null,
          exportButtons(),
        ]),
        isOwnerView.value ? Card([h('div', { class: 'p-4 space-y-3' }, [
          h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800' }, [h('span', '🔄'), h('span', 'Regenerar sección con IA')]),
          regenDraft.value ? [
            h('div', { class: 'text-xs text-slate-500' }, 'Se regeneró la sección "' + regenDraft.value.section + '". Revisa el borrador:'),
            h('div', { class: 'max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs text-slate-700 whitespace-pre-wrap' }, JSON.stringify(regenDraft.value.content, null, 2)),
            h('div', { class: 'flex gap-2' }, [
              h('button', { onClick: acceptDraft, disabled: regening.value, class: 'bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition' }, '✓ Aceptar y guardar'),
              h('button', { onClick: rejectDraft, disabled: regening.value, class: 'bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-300 disabled:opacity-50 transition' }, 'Rechazar'),
            ]),
          ] : [
            h('div', { class: 'flex gap-2 items-center' }, [
              h('select', { class: 'flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm', value: regenSection.value, onChange: (e) => regenSection.value = e.target.value }, sectionOptions().map(function (opt) { return h('option', { value: opt[0] }, opt[1]); })),
              h('button', { onClick: startRegen, disabled: regening.value, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, regening.value ? 'Regenerando...' : 'Regenerar'),
            ]),
          ],
          regenError.value ? h('p', { class: 'text-xs text-red-600' }, regenError.value) : null,
        ])]) : null,
        h(CommentsList, { planningId: planning.value.id, comments: comments.value, canComment: isOrgAdmin() || isOwnerView.value }),
        isOrgAdmin() ? Card([h('div', { class: 'p-4 space-y-2' }, [
          h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800' }, [h('span', '💬'), h('span', 'Comentar al equipo')]),
          commentError.value ? h('p', { class: 'text-xs text-red-600' }, commentError.value) : null,
          h('div', { class: 'flex gap-2' }, [
            h('input', { class: 'flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm', placeholder: 'Retroalimentación para el docente...', value: newComment.value, onInput: (e) => newComment.value = e.target.value, onKeydown: (e) => { if (e.key === 'Enter') addComment(); } }),
            h('button', { onClick: addComment, disabled: addingComment.value || !newComment.value.trim(), class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, addingComment.value ? 'Enviando...' : 'Enviar'),
          ]),
        ])]) : null,
        h(FeedbackForm, { planningId: planning.value.id }),
      ]),
    ]);
  }
});

// ──── Comentarios del equipo (S-3) ────
const CommentsList = defineComponent({
  props: ['planningId', 'comments', 'canComment'],
  setup(props) {
    const deleting = ref('');
    const removeComment = async (commentId) => {
      if (!confirm('¿Eliminar este comentario?')) return;
      deleting.value = commentId;
      try {
        await deleteDoc(doc(db, 'plannings', props.planningId, 'comments', commentId));
        props.comments.splice(props.comments.findIndex(c => c.id === commentId), 1);
      } catch (e) { alert('No se pudo eliminar el comentario.'); }
      finally { deleting.value = ''; }
    };
    return () => Card([h('div', { class: 'p-4 space-y-3' }, [
      h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800' }, [h('span', '💬'), h('span', `Comentarios (${props.comments.length})`)]),
      props.comments.length === 0 ? h('p', { class: 'text-xs text-slate-400' }, 'Sin comentarios aún.') :
        h('div', { class: 'space-y-2' }, props.comments.map(c =>
          h('div', { class: 'border border-slate-100 rounded-lg p-3' }, [
            h('div', { class: 'flex items-center justify-between mb-1' }, [
              h('span', { class: 'text-xs font-medium text-slate-700' }, c.displayName || c.userId),
              h('div', { class: 'flex items-center gap-2' }, [
                h('span', { class: 'text-[10px] text-slate-400' }, c.createdAt ? new Date(c.createdAt).toLocaleString('es-CL') : ''),
                (c.userId === store.user.uid || isAdmin()) ? h('button', { onClick: () => removeComment(c.id), disabled: deleting.value === c.id, class: 'text-[10px] text-red-400 hover:text-red-600' }, 'Eliminar') : null,
              ]),
            ]),
            h('p', { class: 'text-sm text-slate-600' }, c.text),
          ])
        )),
    ])]);
  }
});

// ──── Feedback del piloto docente ────
const FeedbackForm = defineComponent({
  props: ['planningId'],
  setup(props) {
    const quality = ref(0);
    const pedagogic = ref(0);
    const ease = ref(0);
    const comments = ref('');
    const sent = ref(false);
    const submitting = ref(false);
    const fbError = ref('');

    const send = async () => {
      if (!quality.value) { fbError.value = 'Evalúa la calidad primero (1-5)'; return; }
      submitting.value = true; fbError.value = '';
      try {
        await submitFeedbackFn({ planningId: props.planningId, quality: quality.value, pedagogic: pedagogic.value, ease: ease.value, comments: comments.value });
        sent.value = true;
      } catch (e) { fbError.value = 'Error al enviar feedback'; }
      finally { submitting.value = false; }
    };

    const starRow = (label, model) => h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: 'text-xs text-slate-600' }, label),
      h('div', { class: 'flex gap-0.5' }, [1, 2, 3, 4, 5].map(n =>
        h('button', { type: 'button', onClick: () => model.value = n, class: `text-lg leading-none ${n <= model.value ? 'text-amber-400' : 'text-slate-200'}`, 'aria-label': `${n} estrellas` }, '★')
      )),
    ]);

    return () => Card([h('div', { class: 'p-4 space-y-3' }, [
      h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800' }, [h('span', '💬'), h('span', 'Feedback del piloto docente')]),
      h('p', { class: 'text-xs text-slate-400' }, 'Tu evaluación ayuda a mejorar el generador (1 = muy malo, 5 = excelente).'),
      sent.value ? h('div', { class: 'bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg text-center' }, '✓ ¡Gracias por tu feedback!') :
        h('div', { class: 'space-y-2' }, [
          starRow('Calidad pedagógica', quality),
          starRow('Idoneidad para el curso', pedagogic),
          starRow('Facilidad de uso', ease),
          h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', rows: 2, placeholder: 'Comentarios (opcional)...', onInput: (e) => comments.value = e.target.value }),
          fbError.value ? h('p', { class: 'text-xs text-red-600' }, fbError.value) : null,
          h('button', { onClick: send, disabled: submitting.value, class: 'bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, submitting.value ? 'Enviando...' : 'Enviar feedback'),
        ]),
    ])]);
  }
});

export { PlanningDetailPage, CommentsList, FeedbackForm };
