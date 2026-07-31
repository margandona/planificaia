const res = await fetch('https://www.curriculumnacional.cl/curriculum/7o-basico-2-medio/curso/7-basico', { headers: { 'User-Agent': 'Mozilla/5.0' } });
console.log('Status:', res.status);
const html = await res.text();

// Find all links containing '7-basico' or 'lenguaje'
const linkRe = /href="([^"]+)"[^>]*>([^<]{2,60})<\/a>/g;
let m;
let count = 0;
while ((m = linkRe.exec(html)) !== null) {
  const url = m[1];
  const text = m[2].trim();
  if ((url.includes('7-basico') || text.toLowerCase().includes('lenguaje') || text.toLowerCase().includes('matem') || text.toLowerCase().includes('ciencias')) && !url.includes('#') && !url.includes('buscador')) {
    console.log(`${text} -> ${url}`);
    count++;
    if (count > 20) break;
  }
}
console.log('--- total mostrados:', count);
