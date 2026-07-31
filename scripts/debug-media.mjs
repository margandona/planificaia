const res = await fetch('https://www.curriculumnacional.cl/curriculum/3o-4o-medio/curso/3-medio-fg', { headers: { 'User-Agent': 'Mozilla/5.0' } });
const html = await res.text();

// Find links to subject pages
const linkRe = /href="(\/curriculum\/3o-4o-medio\/[^"]+)"/g;
const seen = new Set();
let m;
while ((m = linkRe.exec(html)) !== null) {
  const url = m[1];
  if (!seen.has(url)) {
    seen.add(url);
    console.log(url);
  }
}
console.log('--- Total:', seen.size);
