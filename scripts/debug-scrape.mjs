async function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&deg;/g, '°').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n');
}

const res = await fetch('https://www.curriculumnacional.cl/curriculum/1o-6o-basico/matematica/5-basico', { headers: { 'User-Agent': 'Mozilla/5.0' } });
const html = await res.text();
const text = await stripHtml(html);
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

// Find lines containing 'Objetivo de aprendizaje' with OA
let found = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Objetivo de aprendizaje') && lines[i].includes('OA')) {
    console.log(`L${i}: ${JSON.stringify(lines[i].slice(0, 130))}`);
    console.log(`L${i + 1}: ${JSON.stringify((lines[i + 1] || '').slice(0, 100))}`);
    found++;
    if (found >= 3) break;
  }
}

console.log('\n--- Axis lines (Números) ---');
let axisCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (/^N[úu]meros/.test(lines[i]) && lines[i].length < 40) {
    console.log(`L${i}: ${JSON.stringify(lines[i])}`);
    axisCount++;
    if (axisCount >= 1) break;
  }
}
console.log('Total lines:', lines.length);
