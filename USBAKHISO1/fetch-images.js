const fs = require('fs');
const path = require('path');
const https = require('https');

global.window = {};
require('./catalog-products.js');
const products = window.PRODUCTS;

const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'USBAKHISO1-Catalog/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'USBAKHISO1-Catalog/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, dest));
      }
      if (res.statusCode !== 200) return resolve(false);
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
    }).on('error', () => resolve(false));
  });
}

(async () => {
  console.log(`Đang tìm và tải ảnh cho ${products.length} sản phẩm...`);
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const cleanQuery = p.name.replace(/\([^)]*\)/g, '').replace(/\d+GB|\d+TB/gi, '').trim();
    const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;
    const json = await fetchJson(api);
    const pages = json?.query?.pages;
    const first = pages ? Object.values(pages)[0] : null;
    const imgUrl = first?.imageinfo?.[0]?.thumburl || first?.imageinfo?.[0]?.url;

    if (imgUrl) {
      const ext = path.extname(new URL(imgUrl).pathname).toLowerCase() || '.jpg';
      const filename = `${p.id}${ext.match(/\.(jpg|jpeg|png|webp)$/) ? ext : '.jpg'}`;
      const ok = await downloadFile(imgUrl, path.join(imgDir, filename));
      if (ok) {
        p.img = `images/${filename}`;
        console.log(`[${i + 1}/${products.length}] OK: ${p.name} -> ${p.img}`);
        continue;
      }
    }
    console.log(`[${i + 1}/${products.length}] Giữ ảnh mặc định: ${p.name}`);
  }

  const lines = ['window.PRODUCTS = ['];
  products.forEach((p, idx) => {
    lines.push('  ' + JSON.stringify(p) + (idx < products.length - 1 ? ',' : ''));
  });
  lines.push('];');
  fs.writeFileSync('catalog-products.js', lines.join('\n'), 'utf8');
  fs.writeFileSync('catalog-products.json', JSON.stringify(products, null, 2), 'utf8');
  console.log('Hoàn tất cập nhật catalog-products.js và catalog-products.json!');
})();
