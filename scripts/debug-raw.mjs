const res = await fetch('https://www.curriculumnacional.cl/curriculum/1o-6o-basico/matematica/5-basico', { headers: { 'User-Agent': 'Mozilla/5.0' } });
const html = await res.text();

// Find the raw HTML around "Objetivo de aprendizaje"
const idx = html.indexOf('Objetivo de aprendizaje');
console.log('=== RAW HTML alrededor del primer OA ===');
console.log(html.slice(idx - 400, idx + 600));

// Also find the axis heading raw HTML
const axisIdx = html.indexOf('Números y operaciones');
console.log('\n=== RAW HTML alrededor del eje "Números y operaciones" ===');
console.log(html.slice(axisIdx - 300, axisIdx + 200));
