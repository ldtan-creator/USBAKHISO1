const fs = require('fs');
const path = require('path');
const https = require('https');

global.window = {};
require('./catalog-products.js');
const products = window.PRODUCTS;

const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

function getText(url, headers = {}) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getText(res.headers.location, headers));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function downloadImg(url, dest) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('https://')) return resolve(false);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://duckduckgo.com/' }, timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadImg(res.headers.location, dest));
      }
      const type = res.headers['content-type'] || '';
      if (res.statusCode !== 200 || !type.startsWith('image/')) return resolve(false);
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => {
        const stat = fs.statSync(dest);
        if (stat.size < 3000) { fs.unlinkSync(dest); return resolve(false); }
        resolve(true);
      }));
    }).on('error', () => resolve(false));
  });
}

async function searchProductImage(query) {
  const html = await getText(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const vqdMatch = html.match(/vqd=["']?([^"'&]+)["']?/);
  if (!vqdMatch) return null;
  const jsonStr = await getText(`https://duckduckgo.com/i.js?l=vn-vi&o=json&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&f=,,,&p=1`, { 'Referer': 'https://duckduckgo.com/' });
  try {
    const data = JSON.parse(jsonStr);
    const results = data.results || [];
    for (const r of results.slice(0, 5)) {
      if (r.image && (r.image.includes('cellphones') || r.image.includes('tgdd') || r.image.includes('fptshop') || r.width >= 400)) {
        return r.image;
      }
    }
    return results[0]?.image || null;
  } catch { return null; }
}

(async () => {
  console.log(`Bắt đầu tìm ảnh cho ${products.length} sản phẩm...`);
  let okCount = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const q = `${p.name.replace(/\([^)]*\)/g, '').trim()} chính hãng`;
    const imgUrl = await searchProductImage(q);
    const filename = `${p.id}.jpg`;
    const dest = path.join(imgDir, filename);

    if (imgUrl && await downloadImg(imgUrl, dest)) {
      p.img = `images/${filename}`;
      okCount++;
      console.log(`[${i + 1}/${products.length}] Đã tải: ${p.name}`);
    } else {
      console.log(`[${i + 1}/${products.length}] Bỏ qua: ${p.name}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  const lines = ['window.PRODUCTS = ['];
  products.forEach((p, idx) => lines.push('  ' + JSON.stringify(p) + (idx < products.length - 1 ? ',' : '')));
  lines.push('];');
  fs.writeFileSync('catalog-products.js', lines.join('\n'), 'utf8');
  fs.writeFileSync('catalog-products.json', JSON.stringify(products, null, 2), 'utf8');
  console.log(`Hoàn tất! Đã tải thành công ${okCount}/${products.length} ảnh riêng biệt.`);
})();
