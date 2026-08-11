import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, PLANS, planLabel, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, setUserPlanFn, isAdmin, isOrgAdmin, joinGamifiedExperienceFn, submitMissionEvidenceFn } from '../core.js';

// U8: portal del participante (invitado seudónimo, sin cuenta). Se accede con
// el código de acceso, p. ej. #/participar/ABC123DE.
const ParticipatePage = defineComponent({
  setup() {
    const parts = window.location.hash.replace('#/participar/', '').split('/');
    const codeParam = (parts[0] || '').toUpperCase();
    const code = ref(codeParam);
    const alias = ref('');
    const joined = ref(null);
    const loading = ref(false);
    const err = ref('');
    const storing = ref(false);
    const selMission = ref('');
    const proofText = ref('');
    const proofStatus = ref('');
    const proofErr = ref('');

    const doJoin = async () => {
      err.value = ''; loading.value = true;
      try {
        const res = await joinGamifiedExperienceFn({ code: code.value, alias: alias.value });
        joined.value = res.data;
      } catch (e) {
        const m = {
          CODIGO_INVALIDO: 'Código de acceso inválido o experiencia no publicada.',
          EXPERIENCIA_CERRADA: 'La experiencia está cerrada o fuera de su fecha de vigencia.',
          ALIAS_OCUPADO: 'Ese seudónimo ya está en uso en esta experiencia. Elige otro.',
        }[e.message] || mapError(e) || 'No se pudo unir a la experiencia.';
        err.value = m;
      } finally { loading.value = false; }
    };

    const doSubmit = async () => {
      proofErr.value = ''; storing.value = true;
      try {
        const res = await submitMissionEvidenceFn({ expId: joined.value.experienceId, participantToken: joined.value.participantToken, missionId: selMission.value, text: proofText.value });
        proofStatus.value = res.data && res.data.status === 'pending'
          ? 'Evidencia enviada. Tu profesor la revisará próximamente.'
          : 'Evidencia enviada.';
        proofText.value = '';
      } catch (e) {
        const m = {
          TEXTO_REQUERIDO: 'Cuéntanos qué hiciste en la misión.',
          TEXTO_EXCESIVO: 'La evidencia es demasiado extensa (máx. 2000 caracteres).',
          MISION_INACCESIBLE: 'Aún no puedes entregar esta misión: debes completar las anteriores.',
          EVIDENCIA_YA_ENVIADA: 'Ya enviaste evidencia para esta misión. Espera la revisión.',
          TOKEN_INVALIDO: 'Tu sesión expiró. Sal y vuelve a ingresar con tu código.',
        }[e.message] || mapError(e) || 'No se pudo enviar la evidencia.';
        proofErr.value = m;
      } finally { storing.value = false; }
    };

    return () => h(Layout, { title: 'Portal del participante' }, () => [
      joined.value ? Card([h('div', { class: 'p-6 space-y-4' }, [
        h('div', { class: 'flex items-center gap-3' }, [
          h('div', { class: 'w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl' }, '✓'),
          h('div', [
            h('p', { class: 'font-semibold text-slate-800' }, joined.value.title || 'Experiencia'),
            h('p', { class: 'text-xs text-slate-400' }, `Participante: ${joined.value.alias} · Modalidad: ${joined.value.mode || 'individual'}`),
          ]),
        ]),
        h('div', { class: 'bg-slate-50 rounded-lg p-3' }, [
          h('p', { class: 'text-xs font-medium text-slate-500 mb-2' }, 'Misiones disponibles'),
          (joined.value.missions || []).length === 0
            ? h('p', { class: 'text-sm text-slate-400' }, 'Aún no hay misiones publicadas.')
            : h('div', { class: 'space-y-2' }, joined.value.missions.map((m, i) =>
                h('div', { class: 'flex items-center gap-2 text-sm' }, [
                  h('span', { class: 'w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center shrink-0' }, i + 1),
                  h('span', { class: 'font-medium text-slate-700' }, m.title || `Misión ${i + 1}`),
                  h('span', { class: 'text-xs text-slate-400 ml-auto shrink-0' }, `${m.points || 0} pts`),
                ])
              )),
        ]),
        h('div', {
          class: 'bg-slate-50 rounded-lg p-3',
        }, [
          h('p', { class: 'text-xs font-medium text-slate-500 mb-2' }, 'Entrega tu evidencia'),
          h('label', { class: 'block text-xs font-medium text-slate-500' }, 'Misión'),
          h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2', value: selMission.value, onChange: (e) => { selMission.value = e.target.value; } }, [
            h('option', { value: '', disabled: true }, 'Selecciona una misión'),
            ...(joined.value.missions || []).map(m => h('option', { value: m.id }, `${m.title || m.id} (${m.points || 0} pts)`)),
          ]),
          h('label', { class: 'block text-xs font-medium text-slate-500' }, '¿Qué hiciste? (máx. 2000 caracteres)'),
          h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2', rows: 3, value: proofText.value, onInput: (e) => { proofText.value = e.target.value; }, maxlength: 2000 }),
          proofErr.value ? Alert('error', proofErr.value) : null,
          proofStatus.value ? Alert('success', proofStatus.value) : null,
          h('button', { class: 'w-full bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50', disabled: storing.value || !selMission.value, onClick: doSubmit }, storing.value ? 'Enviando...' : 'Enviar evidencia'),
        ]),
        h('div', { class: 'text-xs text-slate-400' }, 'Tu participación es seudónima: no se usa tu correo ni tu nombre.'),
      ])]) :
      Card([h('div', { class: 'p-6 max-w-md mx-auto space-y-4' }, [
        h('div', { class: 'text-center' }, [
          h('div', { class: 'text-4xl mb-2' }, '🎮'),
          h('h2', { class: 'text-lg font-semibold text-slate-800' }, 'Únete a la experiencia'),
          h('p', { class: 'text-sm text-slate-500' }, 'Ingresa el código que te dio tu profesor y un seudónimo personal.'),
        ]),
        err.value ? Alert('error', err.value) : null,
        h('label', { class: 'block text-xs font-medium text-slate-500' }, 'Código de acceso'),
        h('input', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase tracking-widest text-center', value: code.value, onInput: (e) => { code.value = e.target.value.toUpperCase(); }, placeholder: 'ABC123DE' }),
        h('label', { class: 'block text-xs font-medium text-slate-500' }, 'Seudónimo'),
        h('input', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: alias.value, onInput: (e) => { alias.value = e.target.value; }, placeholder: 'p. ej. León de la Selva', maxlength: 24 }),
        h('button', { class: 'w-full bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition disabled:opacity-50', disabled: loading.value, onClick: doJoin }, loading.value ? 'Ingresando...' : 'Ingresar'),
      ])]),
    ]);
  }
});

export { ParticipatePage };