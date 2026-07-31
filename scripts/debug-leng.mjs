const res = await fetch('https://www.curriculumnacional.cl/curriculum/7o-basico-2-medio/curso/7-basico', { headers: { 'User-Agent': 'Mozilla/5.0' } });
const html = await res.text();
const linkRe = /href="(\/curriculum\/7o-basico-2-medio\/[^"]+)"/g;
const seen = new Set();
let m;
while ((m = linkRe.exec(html)) !== null) {
  const url = m[1];
  if (!seen.has(url) && !url.endsWith('/curso') && !url.endsWith('/curso/7-basico')) {
    seen.add(url);
    console.log(url);
  }
}
