import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, PLANS, planLabel, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, setUserPlanFn, isAdmin, isOrgAdmin, createGamifiedExperienceFn, generateGamificationDraftFn, regenerateGamificationSectionFn, reviewMissionEvidenceFn } from '../core.js';

// U7: editor de experiencias gamificadas (constructor nativo, gated por flag).
const GamificacionesPage = defineComponent({
  setup() {
    if (!guard()) return () => null;

    const loading = ref(true);
    const experiences = ref([]);
    const plannings = ref([]);
    const err = ref('');
    const ok = ref('');

    const creating = ref(false);
    const showCreate = ref(false);
    const createSelected = reactive({ planningId: '', sourceType: 'planning', intensity: 'draft', activityId: '' });

    const draftGen = reactive({});
    const regenSel = reactive({});
    const regenBusy = reactive({});
    const regenOk = reactive({});
    const regenErr = reactive({});

    const evidenceByExp = reactive({});
    const evKey = (expId, pId, eId, status) => `${expId}:${pId}:${eId}:${status}`;
    const reviewBusy = reactive({});
    const reviewOk = reactive({});
    const reviewErr = reactive({});

    const loadEvidence = async (exp) => {
      const list = [];
      try {
        const participantsSnap = await getDocs(query(collection(db, 'gamified-experiences', exp.id, 'participants'), limit(200)));
        for (const p of participantsSnap.docs) {
          const evSnap = await getDocs(query(collection(db, 'gamified-experiences', exp.id, 'participants', p.id, 'evidence'), orderBy('createdAt', 'desc'), limit(50)));
          evSnap.docs.forEach(ev => list.push({ evidenceId: ev.id, participantToken: p.id, alias: p.data().alias || p.id, ...ev.data() }));
        }
        evidenceByExp[exp.id] = list;
      } catch (e) {
        reviewErr[exp.id] = 'No se pudieron cargar las evidencias.';
        reportError(e);
      }
    };

    const doReview = async (exp, ev, approve) => {
      reviewBusy[evKey(exp.id, ev.participantToken, ev.evidenceId, ev.status)] = true;
      reviewOk[exp.id] = ''; reviewErr[exp.id] = '';
      try {
        const res = await reviewMissionEvidenceFn({ expId: exp.id, evidenceId: ev.evidenceId, approve, comment: ev.reviewDraft || '' });
        reviewOk[exp.id] = approve ? 'Evidencia aprobada: se otorgaron los puntos.' : 'Evidencia rechazada.';
        await loadEvidence(exp);
      } catch (e) {
        const m = {
          EVIDENCIA_YA_REVISADA: 'Esta evidencia ya fue revisada.',
          EVIDENCIA_NO_ENCONTRADA: 'Evidencia no encontrada.',
          ACCESO_NO_AUTORIZADO: 'Solo el autor de la experiencia puede revisar.',
        }[e.message] || mapError(e) || 'No se pudo revisar la evidencia.';
        reviewErr[exp.id] = m;
      } finally {
        reviewBusy[evKey(exp.id, ev.participantToken, ev.evidenceId, ev.status)] = false;
      }
    };

    const statusBadge = (status) => {
      const map = {
        draft: ['bg-slate-100 text-slate-600', 'Borrador'],
        published: ['bg-green-100 text-green-700', 'Publicada'],
        paused: ['bg-amber-100 text-amber-700', 'Pausada'],
        archived: ['bg-slate-200 text-slate-500', 'Archivada'],
      };
      return map[status] || ['bg-slate-100 text-slate-600', status || 'Borrador'];
    };

    const summary = (exp) => `${(exp.missions || []).length} misiones · ${(exp.rules || []).length} reglas · ${(exp.oa || []).length} OA`;

    const loadExperiences = async () => {
      loading.value = true; err.value = '';
      try {
        const snap = await getDocs(query(collection(db, 'gamified-experiences'), where('authorUid', '==', store.user.uid), orderBy('createdAt', 'desc'), limit(50)));
        experiences.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const pSnap = await getDocs(query(collection(db, 'plannings'), where('userId', '==', store.user.uid), orderBy('createdAt', 'desc'), limit(50)));
        plannings.value = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        err.value = 'No se pudieron cargar tus experiencias.';
        reportError(e);
      } finally { loading.value = false; }
    };

    const createExperience = async () => {
      err.value = ''; ok.value = '';
      if (!createSelected.planningId) { err.value = 'Selecciona una planificación fuente.'; return null; }
      creating.value = true;
      try {
        const res = await createGamifiedExperienceFn({
          planningId: createSelected.planningId,
          sourceRef: {
            sourceType: createSelected.sourceType,
            sourceActivityId: createSelected.activityId || null,
          },
          intensity: createSelected.intensity,
        });
        ok.value = 'Experiencia creada. Genera el borrador con IA para completarla.';
        showCreate.value = false;
        await loadExperiences();
        return res.data.experienceId;
      } catch (e) {
        const m = {
          FLAG_DESACTIVADO: 'El módulo de gamificación está desactivado.',
          FUENTE_NO_ENCONTRADA: 'No se encontró la planificación fuente.',
          ACCESO_NO_AUTORIZADO: 'No puedes usar esa planificación como fuente.',
        }[e.message] || mapError(e) || 'No se pudo crear la experiencia.';
        err.value = m;
        return null;
      } finally { creating.value = false; }
    };

    const generateDraft = async (exp) => {
      draftGen[exp.id] = true; err.value = ''; ok.value = '';
      try {
        await generateGamificationDraftFn({ experienceId: exp.id });
        ok.value = 'Borrador generado. Revisa y ajusta las secciones.';
        await loadExperiences();
      } catch (e) {
        const m = {
          STATUS_INVALIDO: 'Solo se puede generar el borrador en estado Borrador.',
          DRAFT_INVALIDO: 'El borrador generado no pasó la validación. Inténtalo de nuevo.',
        }[e.message] || mapError(e) || 'No se pudo generar el borrador.';
        err.value = m;
      } finally { draftGen[exp.id] = false; }
    };

    const regenSection = async (exp, section) => {
      const key = `${exp.id}:${section}`;
      const instruction = regenSel[key] || '';
      regenBusy[key] = true; regenErr[key] = ''; regenOk[key] = '';
      try {
        await regenerateGamificationSectionFn({ experienceId: exp.id, section, instruction });
        regenOk[key] = 'Sección regenerada.';
        regenSel[key] = '';
        await loadExperiences();
      } catch (e) {
        regenErr[key] = { SECCION_INVALIDA: 'Esa sección no se puede regenerar.' }[e.message] || mapError(e) || 'No se pudo regenerar la sección.';
      } finally { regenBusy[key] = false; }
    };

    onMounted(loadExperiences);
    return { loading, experiences, plannings, err, ok, creating, showCreate, createSelected, draftGen, regenSel, regenBusy, regenOk, regenErr, statusBadge, summary, loadExperiences, createExperience, generateDraft, regenSection };
  },
  render() {
    const { loading, experiences, plannings, err, ok, creating, showCreate, createSelected, draftGen, regenSel, regenBusy, regenOk, regenErr, statusBadge, summary, loadExperiences, createExperience, generateDraft, regenSection } = this;
    const sourceTypeLabel = { planning: 'Planificación completa', activity: 'Actividad', class: 'Clase', unit: 'Unidad', assessment: 'Evaluación' };
    const regenSections = ['narrative', 'missions', 'rules', 'evidenceCriteria', 'description'];

    return h(Layout, { title: 'Gamificaciones' }, () => [
      err.value ? Alert('error', err.value) : null,
      ok.value ? Alert('ok', ok.value) : null,

      h('div', { class: 'flex items-center justify-between mb-4' }, [
        h('h2', { class: 'text-lg font-semibold text-slate-800' }, 'Tus experiencias'),
        h('button', { class: 'bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition', onClick: () => { showCreate.value = !showCreate.value; } }, showCreate.value ? 'Cancelar' : 'Convertir planificación'),
      ]),

      showCreate.value ? Card([h('div', { class: 'p-5 space-y-4' }, [
        h('h3', { class: 'font-medium text-sm text-slate-700' }, 'Nueva experiencia gamificada'),
        h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: createSelected.planningId, onChange: (e) => { createSelected.planningId = e.target.value; } }, [
          h('option', { value: '' }, 'Selecciona una planificación...'),
          ...plannings.value.map(p => h('option', { value: p.id }, p.title || 'Sin título')),
        ]),
        h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: createSelected.sourceType, onChange: (e) => { createSelected.sourceType = e.target.value; } }, [
          ...Object.entries(sourceTypeLabel).map(([value, label]) => h('option', { value }, label)),
        ]),
        h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: createSelected.intensity, onChange: (e) => { createSelected.intensity = e.target.value; } }, [
          h('option', { value: 'estructure' }, 'Sin IA: solo estructura'),
          h('option', { value: 'draft' }, 'Con IA: estructura + borrador'),
        ]),
        h('button', { class: 'bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50', disabled: creating.value, onClick: () => createExperience() }, creating.value ? 'Creando...' : 'Crear experiencia'),
      ])]) : null,

      loading.value ? h('div', { class: 'flex justify-center py-16' }, Spinner(8)) :
      experiences.value.length === 0 ? EmptyState('Todavía no has creado experiencias gamificadas. Usa el botón superior para convertir una planificación.') :
      h('div', { class: 'space-y-4' }, experiences.value.map(exp =>
        h('div', { class: 'border border-slate-200 rounded-xl bg-white shadow-sm' }, [
          h('div', { class: 'flex items-start justify-between p-4 border-b border-slate-100' }, [
            h('div', { class: 'min-w-0' }, [
              h('div', { class: 'flex items-center gap-2 mb-1' }, [
                h('h3', { class: 'font-semibold text-slate-800 truncate' }, exp.title || 'Sin título'),
                h('span', { class: `text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(exp.status)[0]}` }, statusBadge(exp.status)[1]),
              ]),
              h('p', { class: 'text-xs text-slate-400' }, `${summary(exp)} · ${exp.sourceType || 'planning'} · v${exp.version || 1}`),
            ]),
            exp.status === 'draft'
              ? h('button', { class: 'text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition disabled:opacity-50', disabled: draftGen[exp.id], onClick: () => generateDraft(exp) }, draftGen[exp.id] ? 'Generando...' : 'Generar borrador IA')
              : null,
          ]),

          exp.narrative ? h('p', { class: 'p-4 text-sm text-slate-600 leading-relaxed' }, exp.narrative) : null,
          (exp.missions || []).length > 0 ? h('div', { class: 'px-4 pb-2 space-y-1' }, exp.missions.map((m, i) =>
            h('div', { class: 'flex items-center gap-2 text-sm' }, [
              h('span', { class: 'w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center shrink-0' }, i + 1),
              h('span', { class: 'font-medium text-slate-700 truncate' }, m.title || `Misión ${i + 1}`),
              h('span', { class: 'text-xs text-slate-400 ml-auto shrink-0' }, `${m.points || 0} pts`),
            ])
          )) : null,

          exp.code ? h('div', { class: 'px-4 pb-3 border-t border-slate-100 pt-3' }, [
            h('div', { class: 'flex flex-wrap items-center gap-2' }, [
              h('span', { class: 'text-xs font-medium text-slate-500' }, 'Acceso participantes'),
              h('code', { class: 'bg-slate-100 px-2 py-0.5 rounded text-xs font-bold tracking-widest' }, exp.code),
              h('a', { href: `#/participar/${exp.code}`, class: 'text-xs text-violet-600 hover:underline' }, 'Enlace del portal'),
            ]),
          ]) : null,

          h('div', { class: 'p-4 border-t border-slate-100' }, [
            h('p', { class: 'text-xs font-medium text-slate-500 mb-2' }, 'Regenerar sección'),
            h('div', { class: 'space-y-2' }, [
              h('div', { class: 'flex items-center gap-2' }, [
                h('select', { class: 'border border-slate-300 rounded-lg px-2 py-1.5 text-xs flex-1', value: regenSel[`sel-${exp.id}`] || 'narrative', onChange: (e) => { regenSel[`sel-${exp.id}`] = e.target.value; } }, [
                  ...regenSections.map(s => h('option', { value: s }, s)),
                ]),
                h('button', { class: 'text-xs bg-slate-600 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition disabled:opacity-50', disabled: !!regenBusy[`${exp.id}:${regenSel[`sel-${exp.id}`] || 'narrative'}`], onClick: () => regenSection(exp, regenSel[`sel-${exp.id}`] || 'narrative') }, 'Regenerar'),
              ]),
              regenOk[`${exp.id}:${regenSel[`sel-${exp.id}`] || 'narrative'}`] ? h('p', { class: 'text-xs text-green-600' }, regenOk[`${exp.id}:${regenSel[`sel-${exp.id}`] || 'narrative'}`]) : null,
              regenErr[`${exp.id}:${regenSel[`sel-${exp.id}`] || 'narrative'}`] ? h('p', { class: 'text-xs text-red-600' }, regenErr[`${exp.id}:${regenSel[`sel-${exp.id}`] || 'narrative'}`]) : null,
            ]),
          ]),

          h('div', { class: 'p-4 border-t border-slate-100' }, [
            h('div', { class: 'flex items-center justify-between mb-2' }, [
              h('p', { class: 'text-xs font-medium text-slate-500' }, 'Evidencias de participantes'),
              h('button', { class: 'text-xs text-violet-600 hover:underline', onClick: () => loadEvidence(exp) }, 'Cargar'),
            ]),
            reviewErr[exp.id] ? h('p', { class: 'text-xs text-red-600 mb-2' }, reviewErr[exp.id]) : null,
            reviewOk[exp.id] ? h('p', { class: 'text-xs text-green-600 mb-2' }, reviewOk[exp.id]) : null,
            !evidenceByExp[exp.id]
              ? h('p', { class: 'text-xs text-slate-400' }, 'Pulsa "Cargar" para ver las entregas.')
              : evidenceByExp[exp.id].length === 0
                ? h('p', { class: 'text-xs text-slate-400' }, 'Aún no hay evidencias.')
                : h('div', { class: 'space-y-2' }, evidenceByExp[exp.id].map((ev) => {
                    const key = evKey(exp.id, ev.participantToken, ev.evidenceId, ev.status);
                    return h('div', { class: `border rounded-lg p-2 ${ev.status === 'pending' ? 'border-amber-200 bg-amber-50' : ev.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}` }, [
                      h('div', { class: 'flex items-center gap-2 text-xs mb-1' }, [
                        h('span', { class: 'font-semibold text-slate-700' }, ev.alias),
                        h('span', { class: 'text-slate-400' }, '·'),
                        h('span', { class: 'text-slate-500' }, ev.missionId ? `Misión ${ev.missionId}` : ''),
                        h('span', { class: 'ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize', class: ev.status === 'pending' ? 'bg-amber-100 text-amber-700' : ev.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700' }, ev.status),
                      ]),
                      h('p', { class: 'text-xs text-slate-700 mb-2 whitespace-pre-wrap' }, ev.text || ''),
                      (ev.links || []).length > 0 ? h('div', { class: 'flex flex-wrap gap-1 mb-2' }, ev.links.map(l => h('a', { href: l, target: '_blank', rel: 'noopener', class: 'text-xs text-blue-600 underline' }, l))) : null,
                      ev.reviewComment ? h('p', { class: 'text-xs text-slate-500 italic mb-2' }, `Comentario: ${ev.reviewComment}`) : null,
                      ev.status === 'pending'
                        ? h('div', { class: 'space-y-2' }, [
                            (reviewErr[exp.id] && reviewOk[exp.id] === '') ? null : null,
                            h('div', { class: 'flex gap-2' }, [
                              h('input', { class: 'border border-slate-300 rounded-lg px-2 py-1 text-xs flex-1', placeholder: 'Comentario (opcional)', value: ev.reviewDraft || '', onInput: (e) => { ev.reviewDraft = e.target.value; } }),
                            ]),
                            h('div', { class: 'flex gap-2' }, [
                              h('button', { class: 'text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50', disabled: !!reviewBusy[key], onClick: () => doReview(exp, ev, true) }, reviewBusy[key] ? 'Aprobando...' : 'Aprobar'),
                              h('button', { class: 'text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition disabled:opacity-50', disabled: !!reviewBusy[key], onClick: () => doReview(exp, ev, false) }, reviewBusy[key] ? 'Rechazando...' : 'Rechazar'),
                            ]),
                          ])
                        : null,
                    ]);
                  })),
          ]),
        ])
      )),
    ]);
  }
});

export { GamificacionesPage };