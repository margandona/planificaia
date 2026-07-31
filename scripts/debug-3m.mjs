const res = await fetch('https://www.curriculumnacional.cl/curriculum/3o-4o-medio/matematica-3o-medio/3-medio-fg', { headers: { 'User-Agent': 'Mozilla/5.0' } });
console.log('Status:', res.status);
const html = await res.text();

const idx = html.indexOf('Objetivo de aprendizaje');
console.log('=== HTML alrededor del primer OA ===');
console.log(idx === -1 ? 'No encontrado "Objetivo de aprendizaje"' : html.slice(idx - 300, idx + 500));
