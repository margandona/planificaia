import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, PLANS, planLabel, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, setUserPlanFn, setFeatureFlagsFn, loadFeatureFlags, clearFeatureFlagsCache, isAdmin, isOrgAdmin } from '../core.js';

// Carga diferida (S-5.4): panel institucional e invitaciones.
const InstitucionalPage = defineComponent({
  setup() {
    if (!guard()) return () => null;

    const loading = ref(true);
    const members = ref([]);
    const invites = ref([]);
    const teamPlans = ref([]);
    const err = ref('');
    const ok = ref('');

    const creating = ref(false);
    const orgName = ref('');
    const showCreate = ref(false);

    const inviting = ref(false);
    const inviteEmail = ref('');
    const inviteRole = ref('teacher');
    const inviteLink = ref('');

    const planSel = reactive({});
    const savingPlan = reactive({});
    const planChange = (uid, plan) => { planSel[uid] = plan; };

    // U17b: panel de control de feature flags (solo admin global).
    const FLAG_DESCRIPTIONS = {
      methodologyRecommendationsEnabled: ['Recomendación metodológica', 'Paso 4 del asistente (IA + reglas deterministas)'],
      gamificationModuleEnabled: ['Gamificación', 'Módulo de experiencias gamificadas + portal participante'],
      externalPromptGeneratorEnabled: ['Generador de prompts externos', 'Página Prompts externos (Genially, Canva, Prezi)'],
      tpContextEnabled: ['Contexto técnico-profesional', 'TP especialidades y asociaciones en el paso 3'],
      localContextEnabled: ['Contexto territorial', 'Territorio y contexto local en el paso 3'],
    };
    const flagSettings = reactive({ on: {}, rollout: {} });
    const flagsLoaded = ref(false);
    const savingFlags = ref(false);

    const loadFlags = async () => {
      flagsLoaded.value = false; err.value = ''; ok.value = '';
      try {
        const doc = await loadFeatureFlags();
        for (const key of Object.keys(FLAG_DESCRIPTIONS)) {
          flagSettings.on[key] = doc[key] === true;
          const pct = doc.rollout && typeof doc.rollout[key] === 'number' ? doc.rollout[key] : 100;
          flagSettings.rollout[key] = pct;
        }
      } catch (e) {
        err.value = 'No se pudieron cargar las funcionalidades.';
      } finally { flagsLoaded.value = true; }
    };

    const saveFlags = async () => {
      err.value = ''; ok.value = '';
      const rollout = {};
      for (const key of Object.keys(FLAG_DESCRIPTIONS)) {
        const pct = Number(flagSettings.rollout[key]);
        if (pct >= 0 && pct <= 100) rollout[key] = pct;
      }
      savingFlags.value = true;
      try {
        await setFeatureFlagsFn({ ...flagSettings.on, rollout });
        clearFeatureFlagsCache();
        ok.value = 'Funcionalidades actualizadas. Los cambios se aplican en los próximos minutos.';
      } catch (e) {
        const msg = { ACCESO_NO_AUTORIZADO: 'Solo un administrador puede cambiar las funcionalidades.', DATOS_INVALIDOS: 'Revisa los valores (porcentaje 0-100).' }[e.message] || e.message || 'No se pudieron actualizar las funcionalidades.';
        err.value = msg;
      } finally { savingFlags.value = false; }
    };
    onMounted(() => { if (isAdmin()) loadFlags(); });

    const savePlan = async (m) => {
      err.value = ''; ok.value = '';
      if (!planSel[m.uid]) return;
      savingPlan[m.uid] = true;
      try {
        await setUserPlanFn({ targetUid: m.uid, plan: planSel[m.uid] });
        ok.value = `Plan de ${m.displayName || m.email} actualizado a ${PLANS[planSel[m.uid]].label}.`;
        await load();
      } catch (e) {
        const msg = { ACCESO_NO_AUTORIZADO: 'Solo un administrador puede asignar planes.' }[e.message] || e.message || 'No se pudo actualizar el plan.';
        err.value = msg;
      }
      finally { savingPlan[m.uid] = false; }
    };

    const load = async () => {
      loading.value = true; err.value = '';
      try {
        if (store.org) {
          const mSnap = await getDocs(collection(db, 'organizations', store.org.id, 'members'));
          members.value = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          members.value.forEach(m => { if (!planSel[m.uid]) planSel[m.uid] = m.plan || 'free'; });
          const iSnap = await getDocs(query(collection(db, 'organizations', store.org.id, 'invitations'), where('status', '==', 'pending')));
          invites.value = iSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const pSnap = await getDocs(query(collection(db, 'plannings'), where('orgId', '==', store.org.id), orderBy('createdAt', 'desc'), limit(30)));
          teamPlans.value = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        console.error(e);
        err.value = e.code === 'failed-precondition' ? 'El índice de Firestore para planificaciones del equipo aún se está creando.' : 'Error al cargar la información del colegio.';
      } finally { loading.value = false; }
    };
    onMounted(load);

    const createOrg = async () => {
      err.value = ''; ok.value = '';
      if (!orgName.value.trim()) { err.value = 'Ingresa el nombre del colegio.'; return; }
      creating.value = true;
      try {
        const res = await createOrganizationFn({ name: orgName.value.trim() });
        const orgId = res.data.orgId;
        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
        store.org = { id: orgId, ...orgSnap.data() };
        store.orgRole = 'owner';
        showCreate.value = false;
        ok.value = `Colegio "${res.data.name}" creado. Ya puedes invitar a tu equipo.`;
        await load();
      } catch (e) { err.value = e.message || 'No se pudo crear el colegio.'; }
      finally { creating.value = false; }
    };

    const invite = async () => {
      err.value = ''; ok.value = ''; inviteLink.value = '';
      if (!inviteEmail.value.trim()) { err.value = 'Ingresa el correo del docente.'; return; }
      inviting.value = true;
      try {
        const res = await inviteMemberFn({ orgId: store.org.id, email: inviteEmail.value.trim(), role: inviteRole.value });
        inviteLink.value = res.data.link;
        inviteEmail.value = '';
        await load();
      } catch (e) {
        const m = { YA_ES_MIEMBRO: 'Esa persona ya es miembro del colegio.', DATOS_INVALIDOS: 'Revisa el correo y el rol.', ORGANIZACION_NO_ENCONTRADA: 'El colegio no existe.' }[e.message] || e.message || 'No se pudo enviar la invitación.';
        err.value = m;
      }
      finally { inviting.value = false; }
    };

    const removeMember = async (uid) => {
      if (!confirm('¿Quitar a este docente del colegio?')) return;
      err.value = ''; ok.value = '';
      try {
        await removeMemberFn({ orgId: store.org.id, targetUid: uid });
        await load();
      } catch (e) {
        const m = { NO_PUEDES_REMOVERTE: 'No puedes eliminarte a ti mismo.', NO_PUEDES_REMOVER_OWNER: 'No puedes quitar al dueño del colegio.', MIEMBRO_NO_ENCONTRADO: 'El miembro no existe.' }[e.message] || e.message || 'No se pudo quitar al miembro.';
        err.value = m;
      }
    };

    const approve = async (pid) => {
      err.value = ''; ok.value = '';
      try {
        await approvePlanningFn({ planningId: pid });
        ok.value = 'Planificación aprobada.';
        await load();
      } catch (e) { err.value = e.message || 'No se pudo aprobar.'; }
    };

    const roleLabel = (r) => ({ owner: 'Dueño', coordinator: 'UTP', teacher: 'Docente' })[r] || r;
    const statusBadge = (s) => {
      const map = { draft: ['bg-yellow-100 text-yellow-700', 'Borrador'], approved: ['bg-green-100 text-green-700', 'Aprobada'], archived: ['bg-slate-100 text-slate-500', 'Archivada'] };
      const [c, t] = map[s] || ['bg-slate-100 text-slate-500', s];
      return h('span', { class: `text-xs px-2 py-0.5 rounded-full ${c}` }, t);
    };

    return () => h(Layout, { title: 'Institucional' }, () => [
      err.value ? Alert('error', err.value) : null,
      ok.value ? Alert('success', ok.value) : null,

      isAdmin() ? h('div', { class: 'mb-4' }, [
        Card([h('div', { class: 'p-5 space-y-4' }, [
          h('div', [
            h('h2', { class: 'text-lg font-bold text-slate-900' }, 'Funcionalidades'),
            h('p', { class: 'text-xs text-slate-400' }, 'Activa o desactiva las funciones nuevas y qué porcentaje de docentes las ve. Como admin siempre puedes usarlas, estén o no activadas.'),
          ]),
          ...Object.entries(FLAG_DESCRIPTIONS).map(([key, [name, desc]]) =>
            h('div', { class: 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-100 rounded-lg p-3' }, [
              h('div', [
                h('p', { class: 'text-sm font-medium text-slate-800' }, name),
                h('p', { class: 'text-xs text-slate-400' }, desc),
              ]),
              h('div', { class: 'flex items-center gap-3 shrink-0' }, [
                flagsLoaded.value ? h('label', { class: 'text-xs text-slate-500' }, `${flagSettings.rollout[key]}% de docentes`) : null,
                h('input', {
                  type: 'range', min: 0, max: 100, step: 5, value: flagSettings.rollout[key],
                  disabled: !flagsLoaded.value || !flagSettings.on[key],
                  'aria-label': `Porcentaje de docentes para ${name}`,
                  onInput: (e) => flagSettings.rollout[key] = Number(e.target.value),
                  class: 'w-28',
                }),
                h('button', {
                  type: 'button', role: 'switch',
                  'aria-checked': flagsLoaded.value && flagSettings.on[key],
                  'aria-label': `${name}: ${(flagsLoaded.value && flagSettings.on[key]) ? 'activada' : 'desactivada'}`,
                  onClick: () => flagSettings.on[key] = !flagSettings.on[key],
                  class: `relative w-11 h-6 rounded-full transition-colors ${(flagsLoaded.value && flagSettings.on[key]) ? 'bg-green-500' : 'bg-slate-300'}`,
                }, h('span', { class: `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${(flagsLoaded.value && flagSettings.on[key]) ? 'translate-x-5' : ''}` })),
              ]),
            ])
          ),
          h('div', { class: 'flex gap-2 pt-1' }, [
            h('button', {
              onClick: saveFlags, disabled: savingFlags.value || !flagsLoaded.value,
              class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition',
            }, savingFlags.value ? 'Guardando...' : 'Guardar cambios'),
            h('button', { onClick: loadFlags, disabled: savingFlags.value, class: 'text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition' }, 'Recargar'),
          ]),
        ])]),
      ]) : null,

      loading.value ? h('div', { class: 'flex justify-center py-12' }, Spinner(8)) :

      !store.org ? Card([h('div', { class: 'p-8 max-w-md mx-auto text-center space-y-4' }, [
        h('div', { class: 'text-5xl mb-2' }, '🏫'),
        h('h2', { class: 'text-lg font-semibold text-slate-800' }, 'Tu colegio aún no está registrado'),
        h('p', { class: 'text-sm text-slate-500' }, 'Crea tu organización para invitar docentes, revisar y aprobar planificaciones del equipo, y compartir una biblioteca institucional.'),
        showCreate.value ? h('div', { class: 'space-y-2 text-left' }, [
          h('input', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', placeholder: 'Nombre del colegio (ej: Colegio San Miguel)', onInput: (e) => orgName.value = e.target.value }),
          h('button', { onClick: createOrg, disabled: creating.value, class: 'w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, creating.value ? 'Creando...' : 'Crear colegio'),
          h('button', { onClick: () => showCreate.value = false, class: 'w-full text-xs text-slate-400 hover:text-slate-600' }, 'Cancelar'),
        ]) : h('button', { onClick: () => showCreate.value = true, class: 'w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition' }, 'Crear colegio'),
      ])]) :

      h('div', { class: 'space-y-4' }, [
        Card([h('div', { class: 'p-5 flex items-center justify-between' }, [
          h('div', [
            h('h2', { class: 'text-lg font-bold text-slate-900' }, store.org.name),
            h('p', { class: 'text-xs text-slate-400' }, `Tu rol: ${roleLabel(store.orgRole)}`),
          ]),
          h('div', { class: 'text-right text-xs text-slate-400' }, [
            h('p', `${members.value.length} docente${members.value.length === 1 ? '' : 's'}`),
            h('p', `${teamPlans.value.length} planificaciones del equipo`),
          ]),
        ])]),

        isOrgAdmin() ? Card([h('div', { class: 'p-5 space-y-3' }, [
          h('h3', { class: 'font-medium text-sm text-slate-700' }, 'Invitar docente'),
          h('div', { class: 'flex flex-col sm:flex-row gap-2' }, [
            h('input', { class: 'flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm', type: 'email', placeholder: 'correo@colegio.cl', value: inviteEmail.value, onInput: (e) => inviteEmail.value = e.target.value }),
            h('select', { class: 'border border-slate-300 rounded-lg px-3 py-2 text-sm', value: inviteRole.value, onChange: (e) => inviteRole.value = e.target.value }, [
              h('option', { value: 'teacher' }, 'Docente'),
              h('option', { value: 'coordinator' }, 'UTP'),
            ]),
            h('button', { onClick: invite, disabled: inviting.value, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, inviting.value ? 'Enviando...' : 'Invitar'),
          ]),
          inviteLink.value ? h('div', { class: 'bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs' }, [
            h('p', { class: 'font-medium text-blue-800 mb-1' }, 'Enlace de invitación (vence en 7 días):'),
            h('code', { class: 'block break-all text-blue-700 mb-2' }, inviteLink.value),
            h('button', { onClick: () => { navigator.clipboard?.writeText(inviteLink.value); ok.value = 'Enlace copiado.'; }, class: 'text-blue-700 underline' }, 'Copiar enlace'),
          ]) : null,
          invites.value.length > 0 ? h('div', { class: 'space-y-1' }, [
            h('p', { class: 'text-xs font-medium text-slate-500 mt-2' }, 'Invitaciones pendientes:'),
            ...invites.value.map(i => h('div', { class: 'flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1' }, [
              h('span', { class: 'text-slate-600' }, `${i.email} · ${roleLabel(i.role)}`),
              h('span', { class: 'text-amber-600' }, `vence ${new Date(i.expiresAt).toLocaleDateString('es-CL')}`),
            ])),
          ]) : null,
        ])]) : null,

        Card([h('div', { class: 'p-5' }, [
          h('h3', { class: 'font-medium text-sm text-slate-700 mb-3' }, 'Equipo docente'),
          members.value.length === 0 ? h('p', { class: 'text-sm text-slate-400' }, 'Sin miembros aún.') :
            h('div', { class: 'space-y-2' }, members.value.map(m =>
              h('div', { class: 'flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2' }, [
                h('div', [
                  h('p', { class: 'text-sm font-medium text-slate-800' }, m.displayName || m.email),
                  h('p', { class: 'text-xs text-slate-400' }, m.email),
                ]),
                h('div', { class: 'flex items-center gap-2' }, [
                  h('span', { class: `text-xs px-2 py-0.5 rounded-full ${m.role === 'owner' ? 'bg-slate-200 text-slate-700' : m.role === 'coordinator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}` }, roleLabel(m.role)),
                  (isOrgAdmin() && m.role !== 'owner') ? h('button', { onClick: () => removeMember(m.uid), class: 'text-xs text-red-500 hover:text-red-700' }, 'Quitar') : null,
                ]),
              ])
            )),
        ])]),

        isOrgAdmin() ? Card([h('div', { class: 'p-5' }, [
          h('h3', { class: 'font-medium text-sm text-slate-700 mb-3' }, 'Planes del equipo'),
          h('p', { class: 'text-xs text-slate-400 mb-3' }, 'Asigna el plan de cada docente: Free (10 generaciones/día) o Pro (1000/día).'),
          members.value.length === 0 ? h('p', { class: 'text-sm text-slate-400' }, 'Sin miembros aún.') :
            h('div', { class: 'space-y-2' }, members.value.map(m =>
              h('div', { class: 'flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2' }, [
                h('div', [
                  h('p', { class: 'text-sm font-medium text-slate-800' }, m.displayName || m.email),
                  h('p', { class: 'text-xs text-slate-400' }, m.email),
                ]),
                m.role === 'owner'
                  ? h('span', { class: 'text-xs text-slate-400' }, PLANS[planSel[m.uid]]?.label || 'Free')
                  : h('div', { class: 'flex items-center gap-2' }, [
                      h('select', { class: 'border border-slate-300 rounded-lg px-2 py-1 text-xs', value: planSel[m.uid], onChange: (e) => planChange(m.uid, e.target.value) }, [
                        h('option', { value: 'free' }, 'Free'),
                        h('option', { value: 'pro' }, 'Pro'),
                      ]),
                      h('button', { onClick: () => savePlan(m), disabled: savingPlan[m.uid], class: 'text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 transition' }, savingPlan[m.uid] ? 'Guardando...' : 'Guardar'),
                    ]),
              ])
            )),
        ])]) : null,

        Card([h('div', { class: 'p-5' }, [
          h('div', { class: 'flex items-center justify-between mb-3' }, [
            h('h3', { class: 'font-medium text-sm text-slate-700' }, 'Planificaciones del equipo'),
            isOrgAdmin() ? h('a', { href: '#/dashboard', class: 'text-xs text-blue-600 hover:underline' }, 'Ver las mías') : null,
          ]),
          teamPlans.value.length === 0 ? h('p', { class: 'text-sm text-slate-400' }, 'Tu equipo aún no comparte planificaciones.') :
            h('div', { class: 'space-y-2' }, teamPlans.value.map(p =>
              h('div', { class: 'flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2' }, [
                h('a', { href: `#/planificacion/${p.id}`, class: 'text-sm font-medium text-blue-700 hover:underline truncate' }, p.title || 'Sin título'),
                h('div', { class: 'flex items-center gap-2 shrink-0' }, [
                  statusBadge(p.status),
                  isOrgAdmin() && p.status === 'draft'
                    ? h('button', { onClick: () => approve(p.id), class: 'text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition' }, 'Aprobar')
                    : null,
                ]),
              ])
            )),
        ])]),
      ]),
    ]);
  }
});

// ──────────── Unirse a un colegio por invitación ────────────

const JoinOrgPage = defineComponent({
  setup() {
    if (!store.user) { go('/login'); return () => null; }
    const parts = window.location.hash.replace('#/unirme/', '').split('/');
    const orgId = parts[0]; const token = parts[1];

    const loading = ref(true); const err = ref(''); const done = ref(false); const result = ref(null);

    onMounted(async () => {
      if (!orgId || !token) { err.value = 'Enlace de invitación inválido.'; loading.value = false; return; }
      try {
        const res = await acceptInviteFn({ orgId, token });
        result.value = res.data;
        done.value = true;
        const snap = await getDoc(doc(db, 'users', store.user.uid));
        if (snap.exists()) store.profile = snap.data();
        const orgId2 = snap.exists() ? snap.data().orgId : null;
        if (orgId2) {
          const orgSnap = await getDoc(doc(db, 'organizations', orgId2));
          if (orgSnap.exists()) { store.org = { id: orgId2, ...orgSnap.data() }; store.orgRole = res.data.role; }
        }
      } catch (e) {
        const m = { INVITACION_INVALIDA: 'Esta invitación no existe o ya fue usada.', EMAIL_NO_COINCIDE: 'Esta invitación fue enviada a otro correo. Ingresa con el correo invitado.', INVITACION_EXPIRADA: 'Esta invitación venció. Pide un nuevo enlace.', ORGANIZACION_NO_ENCONTRADA: 'El colegio no existe.', REQUIERE_AUTENTICACION: 'Inicia sesión para aceptar la invitación.' }[e.message] || e.message || 'No se pudo aceptar la invitación.';
        err.value = m;
      } finally { loading.value = false; }
    });

    return () => h(Layout, { title: 'Invitación' }, () => [
      loading.value ? h('div', { class: 'flex justify-center py-12' }, Spinner(8)) :
      err.value ? Alert('error', err.value) :
      done.value ? Card([h('div', { class: 'p-8 max-w-md mx-auto text-center space-y-4' }, [
        h('div', { class: 'text-5xl' }, '✅'),
        h('h2', { class: 'text-lg font-semibold text-slate-800' }, `¡Te uniste a ${store.org?.name || 'tu colegio'}!`),
        h('p', { class: 'text-sm text-slate-500' }, 'Ya puedes acceder a las planificaciones compartidas del equipo.'),
        h('a', { href: '#/dashboard', class: 'inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition' }, 'Ir al Dashboard'),
      ])]) : null,
    ]);
  }
});

export { InstitucionalPage, JoinOrgPage };
