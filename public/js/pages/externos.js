import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, PLANS, planLabel, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, setUserPlanFn, isAdmin, isOrgAdmin, generateExternalToolPromptFn, exportExternalPromptFn } from '../core.js';

// U11: generador de prompts específicos para herramientas externas verificadas
// (Genially, Canva, Prezi, genérico). Guion para pegar: nunca una integración API.
const TOOLS = [
  { tool: 'genially', name: 'Genially', types: ['presentación interactiva', 'escape room', 'quiz', 'juego de tablero', 'imagen interactiva', 'aventura', 'línea de tiempo', 'infografía interactiva'] },
  { tool: 'canva', name: 'Canva', types: ['presentación', 'infografía', 'ficha', 'póster', 'historia visual', 'material imprimible', 'tablero', 'video corto', 'secuencia gráfica'] },
  { tool: 'prezi', name: 'Prezi', types: ['presentación espacial', 'recorrido conceptual', 'mapa narrativo', 'presentación no lineal', 'exposición de proyecto'] },
  { tool: 'generic', name: 'Herramienta genérica', types: ['presentación', 'infografía', 'material imprimible', 'actividad interactiva', 'video', 'guion'] },
];

const ExternalPromptsPage = defineComponent({
  setup() {
    if (!guard()) return () => null;

    const plannings = ref([]);
    const loading = ref(false);
    const err = ref('');
    const ok = ref('');

    const selTool = ref('canva');
    const selResource = ref('infografía');
    const selPlanning = ref('');
    const screens = ref(6);
    const result = ref(null);
    const generatedId = ref(null);
    const exportBusy = ref(false);

    const resourceTypes = computed(() => {
      const tool = TOOLS.find(t => t.tool === selTool.value);
      return tool ? tool.types : [];
    });

    const loadPlannings = async () => {
      try {
        const pSnap = await getDocs(query(collection(db, 'plannings'), where('userId', '==', store.user.uid), orderBy('createdAt', 'desc'), limit(20)));
        plannings.value = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        reportError(e);
      }
    };

    const generate = async () => {
      err.value = ''; ok.value = ''; result.value = null; generatedId.value = null;
      loading.value = true;
      try {
        const res = await generateExternalToolPromptFn({
          tool: selTool.value,
          resourceType: selResource.value,
          planningId: selPlanning.value || undefined,
          context: { screens: screens.value },
        });
        generatedId.value = res.data.promptId;
        result.value = res.data;
        ok.value = 'Prompt generado. Revisa el guion y pégalo manualmente en la herramienta.';
      } catch (e) {
        const m = {
          HERRAMIENTA_NO_VERIFICADA: 'Herramienta no verificada. Solo se ofrecen perfiles documentados.',
          PROMPT_INVALIDO: 'La IA no produjo un guion válido. Intenta de nuevo.',
          FLAG_DESACTIVADO: 'El generador de prompts externos está desactivado.',
        }[e.message] || mapError(e) || 'No se pudo generar el prompt.';
        err.value = m;
      } finally { loading.value = false; }
    };

    const exportPkg = async (format) => {
      if (!generatedId.value) return;
      exportBusy.value = true;
      try {
        const res = await exportExternalPromptFn({ promptId: generatedId.value, format });
        const blob = new Blob([res.data.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-${selTool.value}.${format === 'json' ? 'json' : 'md'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        err.value = mapError(e) || 'No se pudo exportar.';
      } finally { exportBusy.value = false; }
    };

    const copyPrompt = async () => {
      if (!result.value || !result.value.package?.prompt) return;
      try {
        await navigator.clipboard.writeText(result.value.package.prompt);
        ok.value = 'Prompt copiado al portapapeles.';
      } catch (e) {
        err.value = 'No se pudo copiar automáticamente.';
      }
    };

    // U16: feedback ligero del piloto por módulo (adopción de prompts).
    const fbUseful = ref(false);
    const sendUseful = async () => {
      try {
        await submitFeedbackFn({ module: 'prompts', quality: 5, pedagogic: 5, ease: 4, rating: 4, comments: 'El generador de prompts me resultó útil en el piloto.' });
        fbUseful.value = true;
      } catch (e) { /* best-effort */ }
    };

    onMounted(loadPlannings);

    return () => h(Layout, { title: 'Prompts externos' }, () => [
      h('div', { class: 'max-w-3xl mx-auto p-6 space-y-4' }, [
        h(PageTitle, { title: 'Generador de prompts externos', subtitle: 'Guiones específicos para Genially, Canva y Prezi. Se pegan manualmente en la herramienta: no son integraciones automáticas.' }),
        err.value ? Alert('error', err.value) : null,
        ok.value ? Alert('success', ok.value) : null,
        Card([h('div', { class: 'p-6 space-y-4' }, [
          h('label', { class: 'block text-xs font-medium text-slate-500' }, 'Herramienta'),
          h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: selTool.value, onChange: (e) => { selTool.value = e.target.value; selResource.value = TOOLS.find(t => t.tool === selTool.value)?.types[0] || ''; } }, [
            ...TOOLS.map(t => h('option', { value: t.tool }, t.name)),
          ]),
          h('label', { class: 'block text-xs font-medium text-slate-500' }, 'Tipo de recurso'),
          h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: selResource.value, onChange: (e) => { selResource.value = e.target.value; } }, [
            ...resourceTypes.value.map(t => h('option', { value: t }, t)),
          ]),
          h('label', { class: 'block text-xs font-medium text-slate-500' }, 'Planificación fuente (opcional)'),
          h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: selPlanning.value, onChange: (e) => { selPlanning.value = e.target.value; } }, [
            h('option', { value: '', disabled: true }, 'Selecciona una planificación (opcional)'),
            ...plannings.value.map(p => h('option', { value: p.id }, p.title || p.id)),
          ]),
          h('label', { class: 'block text-xs font-medium text-slate-500' }, 'Cantidad estimada de pantallas/secciones'),
          h('input', { type: 'number', min: 1, max: 40, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', value: screens.value, onInput: (e) => { screens.value = Number(e.target.value) || 6; } }),
          h('button', { class: 'w-full bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition disabled:opacity-50', disabled: loading.value, onClick: generate }, loading.value ? 'Generando...' : 'Generar prompt'),
        ])]),
        result.value ? Card([h('div', { class: 'p-6 space-y-3' }, [
          h('div', { class: 'flex flex-wrap items-center gap-2' }, [
            h('p', { class: 'text-xs font-medium text-slate-500' }, 'Guion generado'),
            h('button', { class: 'text-xs bg-slate-600 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition', onClick: copyPrompt }, 'Copiar prompt'),
            h('button', { class: 'text-xs text-violet-600 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition', disabled: exportBusy.value, onClick: () => exportPkg('text') }, exportBusy.value ? 'Exportando...' : 'Exportar texto'),
            h('button', { class: 'text-xs text-violet-600 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition', disabled: exportBusy.value, onClick: () => exportPkg('markdown') }, 'Exportar Markdown'),
            h('button', { class: 'text-xs text-violet-600 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition', disabled: exportBusy.value, onClick: () => exportPkg('json') }, 'Exportar JSON'),
            fbUseful.value
              ? h('span', { class: 'text-xs text-green-600' }, 'Gracias por tu feedback')
              : h('button', { type: 'button', class: 'text-xs text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition', onClick: sendUseful }, 'Me fue útil'),
          ]),
          h('div', { class: 'bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap' }, result.value.package?.prompt || ''),
          (result.value.package?.checklist || []).length > 0 ? h('div', { class: 'bg-amber-50 rounded-lg p-3' }, [
            h('p', { class: 'text-xs font-medium text-amber-700 mb-1' }, 'Checklist de montaje'),
            h('div', { class: 'space-y-1' }, result.value.package.checklist.map(c => h('p', { class: 'text-xs text-amber-800' }, `• ${c}`))),
          ]) : null,
        ])]) : null,
      ]),
    ]);
  }
});

export { ExternalPromptsPage };
