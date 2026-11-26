const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

// ================= KHỞI TẠO CƠ SỞ DỮ LIỆU SQLITE =================
const db = new DatabaseSync(DB_PATH);

// 1. Bảng Đơn hàng (orders)
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    customer_address TEXT,
    customer_note TEXT,
    payment_method TEXT,
    items_json TEXT,
    subtotal INTEGER,
    discount INTEGER,
    shipping INTEGER,
    total INTEGER,
    status TEXT DEFAULT 'Chờ xác nhận',
    created_at INTEGER
  );
`);

const orderColumns = db.prepare('PRAGMA table_info(orders)').all();
if (!orderColumns.some(col => col.name === 'payment_status')) {
  db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'Chưa thanh toán'");
}

// 2. Bảng Két sắt chờ 24h - Mua sắm lý trí (vault)
db.exec(`
  CREATE TABLE IF NOT EXISTS vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_code TEXT UNIQUE NOT NULL,
    user_contact TEXT,
    product_id TEXT,
    product_name TEXT,
    product_price INTEGER,
    locked_at INTEGER,
    expires_at INTEGER,
    status TEXT DEFAULT 'locked',
    created_at INTEGER
  );
`);

// 3. Bảng Quản lý hàng tồn kho (inventory - Quyền Admin)
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cat TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 50,
    sold INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER,
    stock_known INTEGER NOT NULL DEFAULT 1
  );
`);

const inventoryColumns = db.prepare('PRAGMA table_info(inventory)').all();
if (!inventoryColumns.some(col => col.name === 'stock_known')) {
  db.exec('ALTER TABLE inventory ADD COLUMN stock_known INTEGER NOT NULL DEFAULT 1');
}

// 4. Bảng Người dùng & Phân quyền (users - roles: 'admin' | 'customer')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'customer',
    avatar TEXT,
    provider TEXT DEFAULT 'local',
    created_at INTEGER
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all();
if (!userColumns.some(col => col.name === 'password_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
}

// 5. Bảng Phiên đăng nhập xác thực (sessions) - Chống giả mạo quyền Admin
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

// 6. Bảng Quan hệ Mua kèm & Combo (product_relations)
db.exec(`
  CREATE TABLE IF NOT EXISTS product_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    main_product_id TEXT NOT NULL,
    addon_product_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'enhancement',
    discount_percent INTEGER NOT NULL DEFAULT 15,
    fixed_deal_price INTEGER DEFAULT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    badge_text TEXT DEFAULT 'Chuẩn tương thích',
    created_at INTEGER,
    UNIQUE(main_product_id, addon_product_id)
  );
`);

// Cấu hình bảo mật từ biến môi trường (Production)
const AUTH_SALT = process.env.AUTH_SALT || 'USBAK_SALT_2026';
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@usbak.vn').trim().toLowerCase();
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Admin@123';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(',').map(s => s.trim().toLowerCase())
  : [DEFAULT_ADMIN_EMAIL, 'khtnn03us@gmail.com']);

// Hàm băm mật khẩu SHA-256
function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw) + '_' + AUTH_SALT).digest('hex');
}

// Khởi tạo tài khoản Admin ban đầu nếu chưa tồn tại trong CSDL (giữ nguyên mật khẩu nếu đã đổi)
try {
  const adminCheck = db.prepare('SELECT id FROM users WHERE email = ?').get(DEFAULT_ADMIN_EMAIL);
  if (!adminCheck) {
    db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role, provider, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('Quản trị viên USBAK', DEFAULT_ADMIN_EMAIL, '0366277077', hashPassword(DEFAULT_ADMIN_PASS), 'admin', 'system', Date.now());
  } else {
    db.prepare('UPDATE users SET role = ? WHERE email = ?').run('admin', DEFAULT_ADMIN_EMAIL);
  }
} catch (e) { }

// Đồng bộ 107 SKU từ danh mục Excel vào kho
const CATALOG_PATH = path.join(__dirname, 'catalog-products.json');
let catalogProducts = [];
try {
  catalogProducts = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
} catch (error) {
  console.warn('⚠️ Không đọc được catalog-products.json:', error.message);
}

const addCatalogInventory = db.prepare(`
  INSERT OR IGNORE INTO inventory (id, name, cat, price, stock, sold, updated_at, stock_known)
  VALUES (?, ?, ?, ?, 25, 0, ?, 1)
`);

for (const product of catalogProducts) {
  addCatalogInventory.run(product.id, product.name, product.cat, Number(product.price) || 0, Date.now());
}
console.log(`📦 Đã đồng bộ ${catalogProducts.length} SKU từ danh mục Excel vào kho SQLite.`);

// Nạp gói dịch vụ bảo hành & phần mềm mặc định vào kho (nếu chưa có)
const digitalServices = [
  { id: 'srv-careplus-12m', name: 'Gói Bảo hành rơi vỡ & vào nước USBAK Care+ (12 tháng)', cat: 'phu-kien', price: 1290000 },
  { id: 'srv-office365-1y', name: 'Phần mềm bản quyền Microsoft 365 Personal (1 năm)', cat: 'phu-kien', price: 990000 }
];
for (const srv of digitalServices) {
  addCatalogInventory.run(srv.id, srv.name, srv.cat, srv.price, Date.now());
}

// Khởi tạo combo ghim mẫu nếu bảng đang trống
const relCount = db.prepare('SELECT COUNT(*) as c FROM product_relations').get().c;
if (relCount === 0) {
  const seedRel = db.prepare(`
    INSERT OR IGNORE INTO product_relations
    (main_product_id, addon_product_id, relation_type, discount_percent, priority, badge_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  // iPhone 18 Pro Max
  seedRel.run('apl-ip18pm-256', 'apl-acc-chg20w', 'essential', 20, 1, 'Thiết yếu -20%', now);
  seedRel.run('apl-ip18pm-256', 'apl-acc-case18pm', 'protection', 15, 2, 'Chuẩn iPhone 18 PM', now);
  seedRel.run('apl-ip18pm-256', 'apl-app3', 'enhancement', 10, 3, 'Bán chạy nhất', now);
  seedRel.run('apl-ip18pm-256', 'srv-careplus-12m', 'digital', 25, 4, 'Tiết kiệm 25%', now);
  // MacBook Air 13 M5
  seedRel.run('apl-mba13m5-16', 'apl-acc-chg70w', 'essential', 18, 1, 'Sạc nhanh 70W', now);
  seedRel.run('apl-mba13m5-16', 'apl-acc-cable240', 'protection', 20, 2, 'Cáp dù 240W', now);
  seedRel.run('apl-mba13m5-16', 'srv-office365-1y', 'digital', 30, 3, 'Deal sốc -30%', now);
  // Samsung Galaxy S26 Ultra
  seedRel.run('sam-s26u-256', 'sam-acc-chg45w', 'essential', 20, 1, 'Sạc siêu nhanh 45W', now);
  seedRel.run('sam-s26u-256', 'sam-acc-cases26u', 'protection', 15, 2, 'Chuẩn S26 Ultra', now);
  seedRel.run('sam-s26u-256', 'sam-buds4p', 'enhancement', 12, 3, 'Combo Galaxy', now);
}

// ================= TIỆN ÍCH HTTP & XÁC THỰC PHÂN QUYỀN =================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
  });
  res.end(JSON.stringify(data));
}

// Tạo session token khi đăng nhập thành công
function createSession(email, role) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // Hết hạn sau 7 ngày
  db.prepare('INSERT INTO sessions (token, email, role, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, email, role, expiresAt);
  return token;
}

// Lấy thông tin người dùng hiện tại từ Header Authorization: Bearer <token>
function getAuthenticatedUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const session = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .get(token, Date.now());
  if (!session) return null;

  // Luôn đối chiếu lại role mới nhất từ bảng users trong SQLite
  const user = db.prepare('SELECT id, name, email, phone, role, avatar FROM users WHERE email = ?')
    .get(session.email);
  return user || null;
}

// Middleware bắt buộc quyền ADMIN
function requireAdmin(req, res) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    sendJson(res, 401, {
      ok: false,
      error: 'Chưa đăng nhập hoặc phiên đăng nhập hết hạn. Vui lòng đăng nhập tài khoản Admin.'
    });
    return null;
  }
  if (user.role !== 'admin') {
    sendJson(res, 403, {
      ok: false,
      error: 'Truy cập bị từ chối! Tài khoản của bạn không có quyền Quản trị viên (Admin).'
    });
    return null;
  }
  return user;
}

// ================= BỘ LỌC TƯƠNG THÍCH & GỢI Ý COMBO =================
function inferBrand(prod) {
  const s = `${prod.id} ${prod.name}`.toLowerCase();
  if (s.startsWith('apl-') || s.includes('apple') || s.includes('iphone') || s.includes('ipad') || s.includes('macbook') || s.includes('airpods') || s.includes('magsafe')) return 'apple';
  if (s.startsWith('sam-') || s.includes('samsung') || s.includes('galaxy')) return 'samsung';
  if (s.startsWith('xia-') || s.includes('xiaomi') || s.includes('redmi') || s.includes('poco')) return 'xiaomi';
  if (s.startsWith('opp-') || s.includes('oppo') || s.includes('reno') || s.includes('find x')) return 'oppo';
  if (s.startsWith('asus-') || s.includes('asus') || s.includes('rog') || s.includes('zenbook') || s.includes('vivobook')) return 'asus';
  if (s.startsWith('len-') || s.includes('lenovo') || s.includes('thinkpad') || s.includes('legion')) return 'lenovo';
  if (s.startsWith('dell-') || s.includes('dell') || s.includes('xps')) return 'dell';
  if (s.startsWith('hp-') || s.includes('hp ')) return 'hp';
  if (s.startsWith('sony-') || s.includes('sony')) return 'sony';
  return 'universal';
}

function isStrictCompatible(mainProd, addonProd) {
  if (!mainProd || !addonProd || mainProd.id === addonProd.id) return false;
  if (Number(addonProd.stock) <= 0) return false;

  const mName = mainProd.name.toLowerCase();
  const aName = addonProd.name.toLowerCase();
  const mBrand = inferBrand(mainProd);
  const aBrand = inferBrand(addonProd);

  // 1. Chặn tuyệt đối phụ kiện lệch hãng khi gắn nhãn riêng (VD: Ốp Samsung cho iPhone, Sạc Oppo cho iPhone)
  if (mBrand === 'apple' && ['samsung', 'xiaomi', 'oppo'].includes(aBrand)) return false;
  if (mBrand !== 'apple' && aBrand === 'apple' && (aName.includes('iphone') || aName.includes('ipad') || aName.includes('macbook') || aName.includes('magsafe') || aName.includes('pencil'))) return false;

  // 2. Chặn tuyệt đối ốp lưng / bao da sai đời máy
  if (aName.includes('ốp') || aName.includes('bao da') || aName.includes('case') || aName.includes('cường lực')) {
    const modelTokens = ['18 pro max', '18 pro', '18 plus', 'iphone 18', '17 pro max', '17 pro', 'iphone 17', '16 pro max', 's26 ultra', 's26+', 's26', 's25 ultra', 'z fold', 'z flip', 'ipad pro', 'ipad air'];
    const addonTarget = modelTokens.find(t => aName.includes(t));
    if (addonTarget && !mName.includes(addonTarget)) return false;
  }

  // 3. Kiểm tra chuẩn cổng sạc & công suất cho Laptop vs Điện thoại
  if (mainProd.cat === 'laptop') {
    // Không gợi ý củ sạc điện thoại công suất thấp (20W, 25W, 30W) cho Laptop
    if ((aName.includes('sạc') || aName.includes('adapter')) && /\b(15w|20w|25w|30w|33w)\b/.test(aName)) return false;
    // Không gợi ý ốp lưng điện thoại/tablet cho Laptop
    if (aName.includes('ốp') || aName.includes('cường lực')) return false;
  } else if (mainProd.cat === 'dien-thoai') {
    // Không gợi ý sạc laptop công suất lớn cồng kềnh (70W, 96W, 100W, 140W) làm mặc định cho điện thoại
    if ((aName.includes('sạc') || aName.includes('adapter')) && /\b(70w|85w|96w|100w|140w)\b/.test(aName)) return false;
  }

  return true;
}

// ================= XỬ LÝ REQUEST =================
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  if (req.method === 'GET' && pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email'
    });
    return res.end();
  }

  // --- API ĐĂNG KÝ TÀI KHOẢN LOCAL ---
  if (req.method === 'POST' && pathname === '/api/auth/register') {
    try {
      const data = await readBody(req);
      const email = (data.email || '').trim().toLowerCase();
      const name = (data.name || '').trim();
      const phone = (data.phone || '').trim();
      const password = data.password || '';

      if (!email || !name || !password) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' });
      }
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return sendJson(res, 409, { ok: false, error: 'Email này đã được đăng ký.' });
      }

      // Tuyệt đối không cho client tự truyền role='admin' từ form đăng ký
      const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'customer';
      db.prepare(`
        INSERT INTO users (name, email, phone, password_hash, role, provider, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(name, email, phone, hashPassword(password), role, 'local', Date.now());

      const user = db.prepare('SELECT id, name, email, phone, role, avatar FROM users WHERE email = ?').get(email);
      const token = createSession(user.email, user.role);
      return sendJson(res, 201, { ok: true, user, token });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API ĐĂNG NHẬP LOCAL (EMAIL + MẬT KHẨU) ---
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const data = await readBody(req);
      const email = (data.email || '').trim().toLowerCase();
      const password = data.password || '';

      const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!userRow || userRow.password_hash !== hashPassword(password)) {
        return sendJson(res, 401, { ok: false, error: 'Sai email hoặc mật khẩu.' });
      }

      const role = ADMIN_EMAILS.includes(email) ? 'admin' : userRow.role;
      const token = createSession(userRow.email, role);
      const user = { id: userRow.id, name: userRow.name, email: userRow.email, phone: userRow.phone, role, avatar: userRow.avatar };
      return sendJson(res, 200, { ok: true, user, token });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API XÁC THỰC & ĐĂNG NHẬP GOOGLE ---
  if (req.method === 'POST' && pathname === '/api/auth/google') {
    try {
      const data = await readBody(req);
      const email = (data.email || '').trim().toLowerCase();
      const name = data.name || email.split('@')[0];
      const avatar = data.picture || data.avatar || '';

      if (!email) {
        return sendJson(res, 400, { ok: false, error: 'Thiếu thông tin email Google' });
      }

      // Chỉ cấp quyền admin nếu email nằm trong danh sách ADMIN_EMAILS ở server
      const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'customer';

      const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existing) {
        const finalRole = existing.role === 'admin' ? 'admin' : role;
        db.prepare('UPDATE users SET name = ?, avatar = ?, role = ? WHERE email = ?')
          .run(name, avatar, finalRole, email);
      } else {
        db.prepare(`
          INSERT INTO users (name, email, role, avatar, provider, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(name, email, role, avatar, 'google', Date.now());
      }

      const user = db.prepare('SELECT id, name, email, phone, role, avatar FROM users WHERE email = ?').get(email);
      const token = createSession(user.email, user.role);
      console.log(`[Google Login] ${user.name} (${user.email}) - Quyền: ${user.role}`);
      return sendJson(res, 200, { ok: true, user, token });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API ĐĂNG XUẤT (HỦY SESSION TRÊN SERVER) ---
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try { db.prepare('DELETE FROM sessions WHERE token = ?').run(token); } catch (e) { }
      }
    }
    return sendJson(res, 200, { ok: true });
  }

  // --- API CẬP NHẬT HỒ SƠ CÁ NHÂN ---
  if (req.method === 'PATCH' && pathname === '/api/auth/profile') {
    const user = getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.' });
    try {
      const data = await readBody(req);
      const name = (data.name || user.name || '').trim();
      const phone = (data.phone || '').trim();
      if (!name) return sendJson(res, 400, { ok: false, error: 'Họ tên không được để trống.' });
      db.prepare('UPDATE users SET name = ?, phone = ? WHERE email = ?').run(name, phone, user.email);
      const updated = db.prepare('SELECT id, name, email, phone, role, avatar FROM users WHERE email = ?').get(user.email);
      return sendJson(res, 200, { ok: true, user: updated });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API ĐỔI MẬT KHẨU ---
  if (req.method === 'POST' && pathname === '/api/auth/password') {
    const user = getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.' });
    try {
      const data = await readBody(req);
      const oldPassword = data.oldPassword || '';
      const newPassword = data.newPassword || '';
      if (newPassword.length < 6) {
        return sendJson(res, 400, { ok: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      }
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(user.email);
      if (row && row.password_hash && row.password_hash !== hashPassword(oldPassword)) {
        return sendJson(res, 400, { ok: false, error: 'Mật khẩu hiện tại không chính xác.' });
      }
      db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hashPassword(newPassword), user.email);
      return sendJson(res, 200, { ok: true, message: 'Đổi mật khẩu thành công!' });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API KIỂM TRA PHIÊN HIỆN TẠI (/api/auth/me) ---
  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { ok: false, error: 'Chưa đăng nhập' });
    return sendJson(res, 200, { ok: true, user });
  }

  // --- API QUẢN LÝ HÀNG TỒN KHO (INVENTORY) ---
  // Khách xem tồn kho công khai, nhưng chỉ Admin mới được sửa kho
  if (req.method === 'GET' && pathname === '/api/inventory') {
    try {
      const rows = db.prepare('SELECT * FROM inventory ORDER BY cat ASC, price DESC').all();
      return sendJson(res, 200, { ok: true, items: rows });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // [BẢO MẬT ADMIN] Cập nhật số lượng tồn kho hoặc giá
  if (req.method === 'PATCH' && pathname.startsWith('/api/inventory/')) {
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return;

    const id = decodeURIComponent(pathname.replace('/api/inventory/', ''));
    try {
      const data = await readBody(req);
      const current = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
      if (!current) {
        return sendJson(res, 404, { ok: false, error: 'Không tìm thấy sản phẩm trong kho' });
      }

      const newStock = data.stock !== undefined ? Math.max(0, Number(data.stock)) : current.stock;
      const newPrice = data.price !== undefined ? Math.max(0, Number(data.price)) : current.price;

      db.prepare('UPDATE inventory SET stock = ?, price = ?, stock_known = CASE WHEN ? = 1 THEN 1 ELSE stock_known END, updated_at = ? WHERE id = ?')
        .run(newStock, newPrice, data.stock !== undefined ? 1 : 0, Date.now(), id);

      console.log(`[Admin ${adminUser.email}] Cập nhật kho ${id}: Tồn = ${newStock}, Giá = ${newPrice}đ`);
      return sendJson(res, 200, { ok: true, id, stock: newStock, price: newPrice });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API ĐƠN HÀNG: Lấy danh sách đơn hàng ---
  if (req.method === 'GET' && pathname === '/api/orders') {
    try {
      const currentUser = getAuthenticatedUser(req);
      const queryEmail = (urlObj.searchParams.get('email') || '').trim().toLowerCase();

      let rows;
      if (currentUser && currentUser.role === 'admin') {
        if (queryEmail) {
          rows = db.prepare('SELECT * FROM orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC').all(queryEmail);
        } else {
          rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
        }
      } else {
        if (!currentUser) {
          return sendJson(res, 401, { ok: false, error: 'Vui lòng đăng nhập để xem lịch sử đơn hàng.' });
        }
        rows = db.prepare('SELECT * FROM orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC').all(currentUser.email);
      }

      const orders = rows.map(r => ({
        ...r,
        customer: {
          name: r.customer_name,
          phone: r.customer_phone,
          email: r.customer_email,
          address: r.customer_address,
          note: r.customer_note
        },
        items: JSON.parse(r.items_json || '[]')
      }));
      return sendJson(res, 200, { ok: true, orders });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // API Đơn hàng: Tạo đơn hàng mới & Tự động trừ tồn kho
  if (req.method === 'POST' && pathname === '/api/orders') {
    try {
      const data = await readBody(req);
      if (!data.code) {
        return sendJson(res, 400, { ok: false, error: 'Thiếu mã đơn hàng' });
      }

      const stmt = db.prepare(`
        INSERT INTO orders (
          code, customer_name, customer_phone, customer_email, customer_address, customer_note,
          payment_method, payment_status, items_json, subtotal, discount, shipping, total, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const cust = data.customer || {};
      const items = data.items || [];
      const payMethod = data.payment || 'cod';
      const initPayStatus = payMethod === 'bank' ? 'Chờ xác nhận chuyển khoản' : 'Thanh toán khi nhận hàng (COD)';

      stmt.run(
        data.code,
        cust.name || '',
        cust.phone || '',
        cust.email || '',
        cust.address || '',
        cust.note || '',
        payMethod,
        initPayStatus,
        JSON.stringify(items),
        Number(data.subtotal) || 0,
        Number(data.discount) || 0,
        Number(data.shipping) || 0,
        Number(data.total) || 0,
        data.status || 'Chờ xác nhận',
        Number(data.createdAt) || Date.now()
      );

      const deductStmt = db.prepare(`
        UPDATE inventory
        SET stock = CASE WHEN stock_known = 1 THEN MAX(0, stock - ?) ELSE stock END,
            sold = sold + ?, updated_at = ?
        WHERE id = ?
      `);

      items.forEach(it => {
        try {
          deductStmt.run(Number(it.qty) || 1, Number(it.qty) || 1, Date.now(), it.id);
        } catch (err) { }
      });

      return sendJson(res, 201, { ok: true, code: data.code });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API KHÁCH HÀNG TRA CỨU ĐƠN THEO MÃ / EMAIL ---
  if (req.method === 'GET' && pathname === '/api/orders/lookup') {
    try {
      const code = (urlObj.searchParams.get('code') || '').trim().toUpperCase();
      const email = (urlObj.searchParams.get('email') || '').trim().toLowerCase();
      const currentUser = getAuthenticatedUser(req);

      let rows = [];
      if (code) {
        rows = db.prepare('SELECT * FROM orders WHERE UPPER(code) = ?').all(code);
      } else if (currentUser) {
        rows = db.prepare('SELECT * FROM orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC').all(currentUser.email);
      } else if (email) {
        rows = db.prepare('SELECT * FROM orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC').all(email);
      }

      const orders = rows.map(r => ({
        ...r,
        payment_status: r.payment_status || (r.payment_method === 'bank' ? 'Chờ xác nhận chuyển khoản' : 'Thanh toán khi nhận hàng (COD)'),
        customer: {
          name: r.customer_name,
          phone: r.customer_phone,
          email: r.customer_email,
          address: r.customer_address,
          note: r.customer_note
        },
        items: JSON.parse(r.items_json || '[]')
      }));
      return sendJson(res, 200, { ok: true, orders });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API KHÁCH HÀNG TỰ HỦY ĐƠN HÀNG CỦA MÌNH & HOÀN TỒN KHO ---
  if (req.method === 'POST' && pathname.endsWith('/cancel')) {
    const parts = pathname.split('/');
    const code = decodeURIComponent(parts[3] || '').trim();
    try {
      const data = await readBody(req);
      const currentUser = getAuthenticatedUser(req);
      const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
      if (!order) {
        return sendJson(res, 404, { ok: false, error: 'Không tìm thấy đơn hàng.' });
      }

      const reqEmail = (data.email || '').trim().toLowerCase();
      const ownerEmail = (order.customer_email || '').trim().toLowerCase();
      const isOwner = (currentUser && (currentUser.role === 'admin' || currentUser.email === ownerEmail)) || (reqEmail && reqEmail === ownerEmail);
      if (!isOwner) {
        return sendJson(res, 403, { ok: false, error: 'Bạn không có quyền hủy đơn hàng này.' });
      }

      if (['Đang giao hàng', 'Hoàn thành', 'Đã hủy'].includes(order.status)) {
        return sendJson(res, 400, { ok: false, error: `Không thể hủy đơn hàng đang ở trạng thái "${order.status}".` });
      }

      const reason = (data.reason || 'Khách hàng chủ động hủy đơn').trim();
      const newNote = order.customer_note ? `${order.customer_note} | Lý do hủy: ${reason}` : `Lý do hủy: ${reason}`;
      db.prepare("UPDATE orders SET status = 'Đã hủy', customer_note = ? WHERE code = ?").run(newNote, code);

      const items = JSON.parse(order.items_json || '[]');
      const restoreStmt = db.prepare(`
        UPDATE inventory
        SET stock = CASE WHEN stock_known = 1 THEN stock + ? ELSE stock END,
            sold = MAX(0, sold - ?), updated_at = ?
        WHERE id = ?
      `);
      items.forEach(it => {
        try { restoreStmt.run(Number(it.qty) || 1, Number(it.qty) || 1, Date.now(), it.id); } catch (err) { }
      });

      console.log(`[Order Cancel] Đơn ${code} đã được hủy bởi khách (${ownerEmail}).`);
      return sendJson(res, 200, { ok: true, code, status: 'Đã hủy' });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- [BẢO MẬT ADMIN] XÁC NHẬN TRẠNG THÁI CHUYỂN KHOẢN ---
  if ((req.method === 'PATCH' || req.method === 'POST') && pathname.endsWith('/payment-status')) {
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return;

    const parts = pathname.split('/');
    const code = decodeURIComponent(parts[3] || '');
    try {
      const data = await readBody(req);
      const payStatus = data.payment_status || 'Chờ xác nhận chuyển khoản';
      db.prepare('UPDATE orders SET payment_status = ? WHERE code = ?').run(payStatus, code);
      if (payStatus === 'Đã chuyển khoản thành công') {
        db.prepare("UPDATE orders SET status = 'Đã duyệt' WHERE code = ? AND status = 'Chờ xác nhận'").run(code);
      }
      console.log(`[Admin ${adminUser.email}] Xác nhận thanh toán đơn ${code} -> ${payStatus}`);
      return sendJson(res, 200, { ok: true, code, payment_status: payStatus });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // [BẢO MẬT ADMIN] Cập nhật trạng thái đơn hàng
  if ((req.method === 'PATCH' || req.method === 'POST') && pathname.includes('/status')) {
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return;

    const parts = pathname.split('/');
    const code = decodeURIComponent(parts[3] || '');
    try {
      const data = await readBody(req);
      const stmt = db.prepare('UPDATE orders SET status = ? WHERE code = ?');
      stmt.run(data.status || 'Đang xử lý', code);
      console.log(`[Admin ${adminUser.email}] Đổi trạng thái đơn ${code} -> ${data.status}`);
      return sendJson(res, 200, { ok: true, code, status: data.status });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // [BẢO MẬT ADMIN] Xóa đơn hàng
  if (req.method === 'DELETE' && pathname.startsWith('/api/orders/')) {
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return;

    const code = decodeURIComponent(pathname.replace('/api/orders/', ''));
    try {
      db.prepare('DELETE FROM orders WHERE code = ?').run(code);
      console.log(`[Admin ${adminUser.email}] Đã xóa đơn hàng ${code}`);
      return sendJson(res, 200, { ok: true, code });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API KÉT SẮT 24H ---
  if (req.method === 'GET' && pathname === '/api/vault') {
    try {
      const contact = urlObj.searchParams.get('contact');
      let rows;
      if (contact) {
        rows = db.prepare('SELECT * FROM vault WHERE user_contact = ? ORDER BY created_at DESC').all(contact);
      } else {
        const adminUser = requireAdmin(req, res);
        if (!adminUser) return;
        rows = db.prepare('SELECT * FROM vault ORDER BY created_at DESC').all();
      }
      return sendJson(res, 200, { ok: true, items: rows });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/vault') {
    try {
      const data = await readBody(req);
      const vaultCode = data.id || ('V' + Math.floor(100000 + Math.random() * 900000));
      db.prepare(`
        INSERT OR REPLACE INTO vault (
          vault_code, user_contact, product_id, product_name, product_price,
          locked_at, expires_at, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        vaultCode,
        data.userContact || '',
        data.productId || '',
        data.productName || '',
        Number(data.productPrice) || 0,
        Number(data.lockedAt) || Date.now(),
        Number(data.expiresAt) || (Date.now() + 24 * 3600 * 1000),
        data.status || 'locked',
        Date.now()
      );
      return sendJson(res, 201, { ok: true, vaultCode });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname.includes('/claim')) {
    const parts = pathname.split('/');
    const code = decodeURIComponent(parts[3] || '');
    try {
      db.prepare("UPDATE vault SET status = 'converted' WHERE vault_code = ?").run(code);
      return sendJson(res, 200, { ok: true, vaultCode: code, status: 'converted' });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- API GỢI Ý COMBO & MUA KÈM THÔNG MINH (CROSS-SELL & UP-SELL) ---
  if (req.method === 'GET' && pathname.startsWith('/api/recommendations/')) {
    const productId = decodeURIComponent(pathname.replace('/api/recommendations/', '')).trim();
    try {
      const mainProd = db.prepare('SELECT * FROM inventory WHERE id = ?').get(productId);
      if (!mainProd) {
        return sendJson(res, 404, { ok: false, error: 'Không tìm thấy sản phẩm chính' });
      }

      const allInv = db.prepare('SELECT * FROM inventory').all();
      const invMap = new Map(allInv.map(i => [i.id, i]));
      const recommendations = [];
      const seenIds = new Set([productId]);

      // Tầng 1: Quan hệ ghim thủ công từ Admin (product_relations)
      const pinnedRows = db.prepare(`
        SELECT * FROM product_relations
        WHERE main_product_id = ?
        ORDER BY priority ASC, id ASC
      `).all(productId);

      for (const rel of pinnedRows) {
        const addon = invMap.get(rel.addon_product_id);
        if (!addon || seenIds.has(addon.id) || Number(addon.stock) <= 0) continue;
        seenIds.add(addon.id);

        const origPrice = Number(addon.price) || 0;
        const discPct = Number(rel.discount_percent) || 0;
        const dealPrice = rel.fixed_deal_price != null
          ? Number(rel.fixed_deal_price)
          : Math.round(origPrice * (1 - discPct / 100) / 1000) * 1000;

        recommendations.push({
          id: addon.id,
          name: addon.name,
          cat: addon.cat,
          originalPrice: origPrice,
          dealPrice,
          discountPercent: origPrice > 0 ? Math.round((1 - dealPrice / origPrice) * 100) : 0,
          relationType: rel.relation_type,
          badge: rel.badge_text || `Giảm ${discPct}%`,
          source: 'pinned',
          stock: addon.stock
        });
      }

      // Tầng 2: Khai phá giỏ hàng đồng xuất hiện (Market Basket / Co-occurrence) từ đơn hàng thành công
      if (recommendations.length < 4 && ['dien-thoai', 'laptop', 'tablet'].includes(mainProd.cat)) {
        const recentOrders = db.prepare("SELECT items_json FROM orders WHERE status != 'Đã hủy' ORDER BY created_at DESC LIMIT 200").all();
        const coCount = new Map();

        for (const ord of recentOrders) {
          const items = JSON.parse(ord.items_json || '[]');
          const hasMain = items.some(it => it.id === productId);
          if (!hasMain) continue;
          for (const it of items) {
            if (it.id && it.id !== productId) {
              coCount.set(it.id, (coCount.get(it.id) || 0) + (Number(it.qty) || 1));
            }
          }
        }

        const sortedCo = [...coCount.entries()].sort((a, b) => b[1] - a[1]);
        for (const [addonId, freq] of sortedCo) {
          if (recommendations.length >= 4) break;
          if (seenIds.has(addonId)) continue;
          const addon = invMap.get(addonId);
          if (!addon || !isStrictCompatible(mainProd, addon)) continue;
          seenIds.add(addon.id);

          const origPrice = Number(addon.price) || 0;
          const dealPrice = Math.round(origPrice * 0.88 / 1000) * 1000; // Ưu đãi 12% combo
          recommendations.push({
            id: addon.id,
            name: addon.name,
            cat: addon.cat,
            originalPrice: origPrice,
            dealPrice,
            discountPercent: 12,
            relationType: 'co_occurrence',
            badge: freq >= 2 ? `Khách hay mua cùng (${freq}+)` : 'Mua kèm -12%',
            source: 'basket',
            stock: addon.stock
          });
        }
      }

      // Tầng 3: Bổ sung theo luật tương thích thông minh (Rule-based Compatibility) nếu chưa đủ 3-4 món
      if (recommendations.length < 4 && ['dien-thoai', 'laptop', 'tablet'].includes(mainProd.cat)) {
        const mBrand = inferBrand(mainProd);
        const candidates = allInv
          .filter(item => !seenIds.has(item.id) && (['phu-kien', 'tai-nghe'].includes(item.cat) || item.id.startsWith('srv-')))
          .filter(item => isStrictCompatible(mainProd, item))
          .sort((a, b) => {
            const aMatch = inferBrand(a) === mBrand ? 1 : 0;
            const bMatch = inferBrand(b) === mBrand ? 1 : 0;
            if (bMatch !== aMatch) return bMatch - aMatch;
            return (Number(b.sold) || 0) - (Number(a.sold) || 0);
          });

        for (const addon of candidates) {
          if (recommendations.length >= 4) break;
          seenIds.add(addon.id);
          const origPrice = Number(addon.price) || 0;
          const discPct = addon.id.startsWith('srv-') ? 20 : 12;
          const dealPrice = Math.round(origPrice * (1 - discPct / 100) / 1000) * 1000;

          recommendations.push({
            id: addon.id,
            name: addon.name,
            cat: addon.cat,
            originalPrice: origPrice,
            dealPrice,
            discountPercent: discPct,
            relationType: addon.id.startsWith('srv-') ? 'digital' : 'compatible',
            badge: addon.id.startsWith('srv-') ? 'Bảo vệ toàn diện -20%' : 'Chuẩn tương thích -12%',
            source: 'rule',
            stock: addon.stock
          });
        }
      }

      // Lựa chọn 1 bản nâng cấp cấu hình (Up-sell Tier) nếu cùng dòng máy
      let upsellProduct = null;
      const basePrefix = productId.replace(/-(128|256|512|1tb|16|32|64)$/i, '');
      if (basePrefix !== productId) {
        const higherTier = allInv
          .filter(i => i.id.startsWith(basePrefix + '-') && i.id !== productId && Number(i.price) > Number(mainProd.price) && Number(i.stock) > 0)
          .sort((a, b) => Number(a.price) - Number(b.price))[0];
        if (higherTier) {
          upsellProduct = {
            id: higherTier.id,
            name: higherTier.name,
            price: Number(higherTier.price),
            diff: Number(higherTier.price) - Number(mainProd.price)
          };
        }
      }

      return sendJson(res, 200, {
        ok: true,
        mainProduct: { id: mainProd.id, name: mainProd.name, price: Number(mainProd.price), cat: mainProd.cat },
        recommendations,
        upsellProduct
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- [ADMIN] API QUẢN LÝ CẤU HÌNH COMBO / MUA KÈM ---
  if (req.method === 'GET' && pathname === '/api/admin/relations') {
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return;
    try {
      const rows = db.prepare('SELECT * FROM product_relations ORDER BY main_product_id ASC, priority ASC, id DESC').all();
      return sendJson(res, 200, { ok: true, relations: rows });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/admin/relations') {
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return;
    try {
      const data = await readBody(req);
      const mainId = (data.main_product_id || '').trim();
      const addonId = (data.addon_product_id || '').trim();
      if (!mainId || !addonId || mainId === addonId) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng chọn sản phẩm chính và phụ kiện hợp lệ.' });
      }
      const disc = Math.min(80, Math.max(0, Number(data.discount_percent) || 15));
      const relType = data.relation_type || 'enhancement';
      const badge = (data.badge_text || `Ưu đãi mua kèm -${disc}%`).trim();
      const priority = Number(data.priority) || 1;

      db.prepare(`
        INSERT OR REPLACE INTO product_relations
        (main_product_id, addon_product_id, relation_type, discount_percent, priority, badge_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(mainId, addonId, relType, disc, priority, badge, Date.now());

      console.log(`[Admin ${adminUser.email}] Ghim combo: ${mainId} + ${addonId} (-${disc}%)`);
      return sendJson(res, 201, { ok: true });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/admin/relations/')) {
    const adminUser = requireAdmin(req, res);
    if (!adminUser) return;
    const id = Number(pathname.replace('/api/admin/relations/', ''));
    try {
      db.prepare('DELETE FROM product_relations WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- PHỤC VỤ FILE TĨNH (FRONTEND HTML/JS/CSS) ---
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, decodeURIComponent(filePath));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 - Không tìm thấy trang');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 USBAK TECHSTORE BACKEND ĐANG CHẠY TẠI: http://localhost:${PORT}`);
  console.log(`📂 Cơ sở dữ liệu SQLite: ${DB_PATH}`);
  console.log(`🔐 Admin mặc định: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASS}`);
  console.log('====================================================');
});