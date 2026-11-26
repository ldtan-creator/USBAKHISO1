// app.js - Giao diện dùng chung, Lựa chọn Phiên bản (Màu sắc / Dung lượng / RAM), Giỏ hàng, So sánh & Két sắt 24h
(function () {
  const CART_KEY = 'usbak_cart_v1';
  const COMPARE_KEY = 'usbak_compare_v1';
  const VAULT_KEY = 'usbak_vault24h_v1';
  const VARIANT_SEL_KEY = 'usbak_variant_sel_v1';
  const VAULT_DURATION_MS = 24 * 60 * 60 * 1000;

  const fmt = n => Number(n || 0).toLocaleString('vi-VN') + ' ₫';

  function fallbackSvg(p) {
    const colors = {
      'dien-thoai': ['#0f172a', '#0284c7'],
      'laptop': ['#1e1b4b', '#4f46e5'],
      'tablet': ['#134e4a', '#0d9488'],
      'tai-nghe': ['#3b0764', '#9333ea'],
      'phu-kien': ['#1f2937', '#4b5563']
    };
    const [c1, c2] = colors[p.cat] || ['#111827', '#374151'];
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
        <rect width="400" height="320" rx="16" fill="url(#g)"/>
        <text x="50%" y="38%" dominant-baseline="middle" text-anchor="middle" fill="#bae6fd" font-family="Arial,sans-serif" font-size="13" font-weight="bold">${(p.brand || 'USBAKHISO1').toUpperCase()}</text>
        <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="15" font-weight="bold">${(p.name || '').slice(0, 28)}</text>
        <text x="50%" y="66%" dominant-baseline="middle" text-anchor="middle" fill="#e2e8f0" font-family="Arial,sans-serif" font-size="12">${p.sku || ''}</text>
      </svg>`
    );
  }

  function showToast(msg, type) {
    let box = document.getElementById('usbakToastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'usbakToastBox';
      box.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
      document.body.appendChild(box);
    }
    const bg = type === 'error' ? '#dc2626' : type === 'success' ? '#15803d' : '#111827';
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `background:${bg};color:#fff;padding:11px 20px;border-radius:999px;font-size:13px;font-weight:500;box-shadow:0 10px 25px rgba(0,0,0,0.22);transition:opacity .25s;`;
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 260); }, 2500);
  }
  window.showToast = showToast;

  // ================= HỆ THỐNG TỰ ĐỘNG SINH PHIÊN BẢN SẢN PHẨM (MÀU SẮC / BỘ NHỚ / CẤU HÌNH) =================
  function getProductVariants(p) {
    if (p.variants && p.variants.colors && p.variants.storages) {
      return p.variants;
    }
    const name = (p.name || '').toLowerCase();
    const brand = (p.brand || '').toLowerCase();
    const cat = p.cat || '';

    // 1. Nhóm màu sắc đặc trưng theo hãng & dòng máy
    let colors = [
      { name: 'Đen Không Gian', hex: '#1e293b', delta: 0 },
      { name: 'Bạc Ánh Kim', hex: '#cbd5e1', delta: 0 },
      { name: 'Xanh Titan', hex: '#1d4ed8', delta: 200000 }
    ];

    if (brand.includes('apple')) {
      if (name.includes('pro')) {
        colors = [
          { name: 'Titan Sa Mạc', hex: '#c2a68c', delta: 300000 },
          { name: 'Titan Tự Nhiên', hex: '#9ca3af', delta: 0 },
          { name: 'Titan Đen', hex: '#18181b', delta: 0 },
          { name: 'Titan Trắng', hex: '#f8fafc', delta: 0 }
        ];
      } else if (cat === 'laptop') {
        colors = [
          { name: 'Đêm Xanh Thẳm', hex: '#1e293b', delta: 0 },
          { name: 'Ánh Sao (Starlight)', hex: '#e7e5e4', delta: 0 },
          { name: 'Bạc (Silver)', hex: '#cbd5e1', delta: 0 },
          { name: 'Xám Không Gian', hex: '#52525b', delta: 0 }
        ];
      } else if (cat === 'tai-nghe') {
        colors = [
          { name: 'Trắng Sứ', hex: '#f8fafc', delta: 0 }
        ];
      } else {
        colors = [
          { name: 'Xanh Lưu Ly', hex: '#3b82f6', delta: 0 },
          { name: 'Hồng Phấn', hex: '#f472b6', delta: 0 },
          { name: 'Đen', hex: '#18181b', delta: 0 },
          { name: 'Trắng', hex: '#f8fafc', delta: 0 }
        ];
      }
    } else if (brand.includes('samsung')) {
      colors = [
        { name: 'Xám Titan', hex: '#64748b', delta: 0 },
        { name: 'Đen Tuyền', hex: '#0f172a', delta: 0 },
        { name: 'Xanh Băng', hex: '#38bdf8', delta: 200000 },
        { name: 'Tím Bạc', hex: '#a855f7', delta: 200000 }
      ];
    } else if (brand.includes('xiaomi') || brand.includes('redmi')) {
      colors = [
        { name: 'Đen Khoáng Thạch', hex: '#1f2937', delta: 0 },
        { name: 'Trắng Ngọc Trai', hex: '#f1f5f9', delta: 0 },
        { name: 'Xanh Ngọc Lục', hex: '#10b981', delta: 150000 }
      ];
    } else if (cat === 'phu-kien') {
      colors = [
        { name: 'Trắng', hex: '#f8fafc', delta: 0 },
        { name: 'Đen', hex: '#111827', delta: 0 },
        { name: 'Xám Ghi', hex: '#6b7280', delta: 0 }
      ];
    }

    // 2. Nhóm tùy chọn Bộ nhớ trong / Cấu hình
    let storageLabel = 'Bộ nhớ trong';
    let storages = [];

    if (cat === 'dien-thoai' || cat === 'tablet') {
      storageLabel = 'Bộ nhớ trong';
      if (name.includes('512gb')) {
        storages = [
          { label: '512GB (Chuẩn)', delta: 0 },
          { label: '1TB', delta: 5500000 }
        ];
      } else if (name.includes('1tb')) {
        storages = [
          { label: '1TB (Max)', delta: 0 }
        ];
      } else if (name.includes('128gb')) {
        storages = [
          { label: '128GB', delta: 0 },
          { label: '256GB', delta: 2500000 },
          { label: '512GB', delta: 5500000 }
        ];
      } else {
        storages = [
          { label: '256GB', delta: 0 },
          { label: '512GB', delta: 3500000 },
          { label: '1TB', delta: 7500000 }
        ];
      }
    } else if (cat === 'laptop') {
      storageLabel = 'RAM / Ổ cứng SSD';
      storages = [
        { label: '16GB / 512GB SSD', delta: 0 },
        { label: '24GB / 512GB SSD', delta: 4500000 },
        { label: '32GB / 1TB SSD', delta: 9000000 }
      ];
    } else if (cat === 'tai-nghe') {
      storageLabel = 'Phiên bản sạc';
      storages = [
        { label: 'Hộp sạc USB-C', delta: 0 },
        { label: 'Bản MagSafe + AppleCare+', delta: 690000 }
      ];
    } else {
      storageLabel = 'Chiều dài / Chuẩn';
      if (name.includes('cáp') || name.includes('cable')) {
        storages = [
          { label: 'Dài 1 mét', delta: 0 },
          { label: 'Dài 2 mét', delta: 150000 }
        ];
      } else {
        storages = [
          { label: 'Tiêu chuẩn', delta: 0 },
          { label: 'Kèm gói Bảo hành 1 đổi 1', delta: 190000 }
        ];
      }
    }

    return { colors, storageLabel, storages };
  }

  function getSelectedVariantState(id) {
    try {
      const all = JSON.parse(localStorage.getItem(VARIANT_SEL_KEY) || '{}');
      return all[id] || { colorIdx: 0, storageIdx: 0 };
    } catch (e) {
      return { colorIdx: 0, storageIdx: 0 };
    }
  }

  function saveSelectedVariantState(id, colorIdx, storageIdx) {
    try {
      const all = JSON.parse(localStorage.getItem(VARIANT_SEL_KEY) || '{}');
      all[id] = { colorIdx, storageIdx };
      localStorage.setItem(VARIANT_SEL_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function resolveVariantDetails(prod, overrideState) {
    const v = getProductVariants(prod);
    const st = overrideState || getSelectedVariantState(prod.id);
    const cIdx = Math.min(Math.max(0, st.colorIdx || 0), v.colors.length - 1);
    const sIdx = Math.min(Math.max(0, st.storageIdx || 0), v.storages.length - 1);
    const colorObj = v.colors[cIdx];
    const storageObj = v.storages[sIdx];
    const finalPrice = Number(prod.price || 0) + (colorObj?.delta || 0) + (storageObj?.delta || 0);
    const variantText = `${colorObj.name} • ${storageObj.label}`;
    return { v, cIdx, sIdx, colorObj, storageObj, finalPrice, variantText };
  }

  // Cập nhật trực tiếp trên thẻ sản phẩm khi bấm chọn màu hoặc bộ nhớ
  window.selectCardVariant = function (id, type, idx) {
    const prod = (window.PRODUCTS || []).find(p => p.id === id);
    if (!prod) return;
    const cur = getSelectedVariantState(id);
    const nextColor = type === 'color' ? idx : cur.colorIdx;
    const nextStorage = type === 'storage' ? idx : cur.storageIdx;
    saveSelectedVariantState(id, nextColor, nextStorage);

    const info = resolveVariantDetails(prod, { colorIdx: nextColor, storageIdx: nextStorage });

    // Cập nhật UI các thẻ sản phẩm cùng ID trên trang
    document.querySelectorAll(`[data-prod-card="${id}"]`).forEach(card => {
      const priceEl = card.querySelector('.js-card-price');
      if (priceEl) priceEl.textContent = fmt(info.finalPrice);

      const labelEl = card.querySelector('.js-variant-label');
      if (labelEl) labelEl.textContent = info.variantText;

      card.querySelectorAll('.js-color-dot').forEach((btn, i) => {
        btn.style.outline = i === info.cIdx ? '2px solid #111' : '1px solid #cbd5e1';
        btn.style.outlineOffset = i === info.cIdx ? '2px' : '0px';
      });

      card.querySelectorAll('.js-storage-chip').forEach((btn, i) => {
        btn.style.background = i === info.sIdx ? '#111' : '#f8fafc';
        btn.style.color = i === info.sIdx ? '#fff' : '#334155';
        btn.style.borderColor = i === info.sIdx ? '#111' : '#e2e8f0';
      });
    });

    // Cập nhật nếu đang mở modal chọn phiên bản
    const modalPrice = document.getElementById('vmPrice');
    const modalVariant = document.getElementById('vmVariantText');
    if (modalPrice && modalPrice.getAttribute('data-pid') === id) {
      modalPrice.textContent = fmt(info.finalPrice);
      if (modalVariant) modalVariant.textContent = info.variantText;
      document.querySelectorAll('#variantModal .vm-color-btn').forEach((b, i) => {
        b.style.borderColor = i === info.cIdx ? '#111' : '#e2e8f0';
        b.style.background = i === info.cIdx ? '#f1f5f9' : '#fff';
      });
      document.querySelectorAll('#variantModal .vm-storage-btn').forEach((b, i) => {
        b.style.borderColor = i === info.sIdx ? '#111' : '#e2e8f0';
        b.style.background = i === info.sIdx ? '#111' : '#fff';
        b.style.color = i === info.sIdx ? '#fff' : '#111';
      });
      initCrossSellForProduct(prod);
    }
  };

  // ================= MODAL CHỌN PHIÊN BẢN CHI TIẾT =================
  window.openVariantModal = function (id) {
    const prod = (window.PRODUCTS || []).find(p => p.id === id);
    if (!prod) return;
    const old = document.getElementById('variantModal');
    if (old) old.remove();

    const info = resolveVariantDetails(prod);
    const fb = fallbackSvg(prod);

    const modal = document.createElement('div');
    modal.id = 'variantModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:22px;width:100%;max-width:860px;padding:26px;box-shadow:0 24px 60px rgba(0,0,0,.28);position:relative;max-height:92vh;overflow-y:auto;">
        <button type="button" onclick="document.getElementById('variantModal').remove()" style="position:absolute;right:18px;top:16px;border:none;background:#f1f5f9;width:32px;height:32px;border-radius:50%;font-size:20px;cursor:pointer;">&times;</button>
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid #f1f5f9;">
          <img src="${prod.img || fb}" onerror="this.src='${fb}'" style="width:84px;height:84px;object-fit:contain;padding:6px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
          <div>
            <span style="font-size:11px;background:#f1f5f9;padding:3px 9px;border-radius:999px;font-weight:600;color:#475569;">${prod.brand || ''} • ${prod.sku || ''}</span>
            <h3 style="font-size:17px;font-weight:700;margin:6px 0 4px;">${prod.name}</h3>
            <div id="vmPrice" data-pid="${prod.id}" style="font-size:20px;font-weight:800;color:#0284c7;">${fmt(info.finalPrice)}</div>
            <div id="vmVariantText" style="font-size:12px;color:#64748b;margin-top:2px;">Phiên bản: ${info.variantText}</div>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:8px;">1. Chọn màu sắc:</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
            ${info.v.colors.map((c, idx) => `
              <button type="button" class="vm-color-btn" onclick="selectCardVariant('${prod.id}','color',${idx})"
                style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1.5px solid ${idx === info.cIdx ? '#111' : '#e2e8f0'};background:${idx === info.cIdx ? '#f1f5f9' : '#fff'};cursor:pointer;text-align:left;">
                <span style="width:18px;height:18px;border-radius:50%;background:${c.hex};border:1px solid #94a3b8;flex:none;"></span>
                <div style="font-size:12.5px;font-weight:600;">
                  ${c.name}
                  ${c.delta > 0 ? `<div style="font-size:11px;color:#0284c7;">+${fmt(c.delta)}</div>` : ''}
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:8px;">2. Chọn ${info.v.storageLabel.toLowerCase()}:</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">
            ${info.v.storages.map((s, idx) => `
              <button type="button" class="vm-storage-btn" onclick="selectCardVariant('${prod.id}','storage',${idx})"
                style="padding:10px 12px;border-radius:12px;border:1.5px solid ${idx === info.sIdx ? '#111' : '#e2e8f0'};background:${idx === info.sIdx ? '#111' : '#fff'};color:${idx === info.sIdx ? '#fff' : '#111'};cursor:pointer;text-align:center;">
                <div style="font-size:13px;font-weight:700;">${s.label}</div>
                <div style="font-size:11px;opacity:.8;margin-top:2px;">${s.delta > 0 ? '+' + fmt(s.delta) : 'Giá tiêu chuẩn'}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button type="button" onclick="addToCart('${prod.id}');document.getElementById('variantModal').remove();" style="padding:12px;border-radius:999px;background:#111;color:#fff;border:none;font-weight:600;font-size:13.5px;cursor:pointer;">+ Thêm phiên bản vào giỏ</button>
          <button type="button" onclick="toggleVault24h('${prod.id}');document.getElementById('variantModal').remove();" style="padding:12px;border-radius:999px;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;font-weight:600;font-size:13.5px;cursor:pointer;">🔐 Khóa giá Két sắt 24h</button>
          <div id="fbtWidgetMount"></div>
        </div>
      </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    initCrossSellForProduct(prod);
  };

  // ================= GIỎ HÀNG (LƯU ĐÚNG PHIÊN BẢN MÀU + BỘ NHỚ + GIÁ) =================
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadges();
  }

  window.addToCart = function (id, customPrice, customVariant) {
    const prod = (window.PRODUCTS || []).find(p => p.id === id);
    if (!prod) return;
    const info = resolveVariantDetails(prod);
    const variantLabel = customVariant || info.variantText;
    const finalPrice = typeof customPrice === 'number' ? customPrice : info.finalPrice;
    const cartKey = `${prod.id}__${variantLabel}__${finalPrice}`;

    const cart = getCart();
    const found = cart.find(i => (i.cartKey || `${i.id}__${i.variant || ''}__${i.price}`) === cartKey);
    if (found) {
      found.qty += 1;
    } else {
      cart.push({
        cartKey,
        id: prod.id,
        name: `${prod.name} (${variantLabel})`,
        baseName: prod.name,
        variant: variantLabel,
        price: finalPrice,
        img: prod.img,
        qty: 1
      });
    }
    saveCart(cart);
    showToast(`Đã thêm "${prod.name}" [${variantLabel}] vào giỏ!`, 'success');
  };

  // ================= SO SÁNH SẢN PHẨM =================
  function getCompare() {
    try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveCompare(list) {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(list));
    updateBadges();
    renderCompareBar();
    document.querySelectorAll('[data-cmp-btn]').forEach(btn => {
      const pid = btn.getAttribute('data-cmp-btn');
      const active = list.includes(pid);
      btn.textContent = active ? '✓ Đang so sánh' : '⇄ So sánh';
      btn.style.background = active ? '#0f172a' : '#fff';
      btn.style.color = active ? '#fff' : '#111';
      btn.style.borderColor = active ? '#0f172a' : '#cbd5e1';
    });
  }

  window.toggleCompare = function (id) {
    let list = getCompare();
    if (list.includes(id)) {
      list = list.filter(x => x !== id);
      saveCompare(list);
      showToast('Đã bỏ sản phẩm khỏi danh sách so sánh');
    } else {
      if (list.length >= 3) {
        showToast('Chỉ chọn tối đa 3 sản phẩm để so sánh cùng lúc!', 'error');
        return;
      }
      list.push(id);
      saveCompare(list);
      showToast('Đã thêm vào bảng so sánh (' + list.length + '/3)');
    }
  };

  window.clearCompare = function () {
    saveCompare([]);
    if (window.location.pathname.endsWith('compare.html')) window.location.reload();
  };

  function renderCompareBar() {
    let bar = document.getElementById('usbakCompareBar');
    const list = getCompare();
    if (!list.length || window.location.pathname.endsWith('compare.html')) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'usbakCompareBar';
      bar.style.cssText = 'position:fixed;bottom:18px;right:18px;background:#0f172a;color:#fff;padding:12px 18px;border-radius:16px;display:flex;align-items:center;gap:14px;z-index:9990;box-shadow:0 12px 32px rgba(0,0,0,0.28);font-size:13px;';
      document.body.appendChild(bar);
    }
    const items = (window.PRODUCTS || []).filter(p => list.includes(p.id));
    const names = items.map(i => i.name.split('(')[0].trim()).join(' • ');
    bar.innerHTML = `
      <div>
        <div style="font-weight:700;">So sánh sản phẩm (${list.length}/3)</div>
        <div style="font-size:11px;color:#94a3b8;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${names}</div>
      </div>
      <a href="compare.html" style="background:#0284c7;color:#fff;padding:8px 14px;border-radius:999px;font-weight:600;text-decoration:none;">Đối chiếu ngay</a>
      <button onclick="clearCompare()" title="Xóa" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">&times;</button>
    `;
  }

  // ================= KÉT SẮT 24H (GIỮ GIÁ THEO ĐÚNG PHIÊN BẢN ĐÃ CHỌN) =================
  function getVault() {
    try {
      const raw = JSON.parse(localStorage.getItem(VAULT_KEY) || '[]');
      const now = Date.now();
      const valid = raw.filter(item => item.expiresAt > now);
      if (valid.length !== raw.length) {
        localStorage.setItem(VAULT_KEY, JSON.stringify(valid));
      }
      return valid;
    } catch (e) { return []; }
  }
  function saveVault(list) {
    localStorage.setItem(VAULT_KEY, JSON.stringify(list));
    updateBadges();
    document.querySelectorAll('[data-vault-btn]').forEach(btn => {
      const pid = btn.getAttribute('data-vault-btn');
      const inVault = list.some(x => x.id === pid);
      btn.textContent = inVault ? '🔒 Đã khóa giá 24h' : '🔐 Két sắt 24h';
      btn.style.background = inVault ? '#fef3c7' : '#fff';
      btn.style.color = inVault ? '#92400e' : '#111';
      btn.style.borderColor = inVault ? '#f59e0b' : '#cbd5e1';
    });
  }

  window.toggleVault24h = function (id) {
    const prod = (window.PRODUCTS || []).find(p => p.id === id);
    if (!prod) return;
    let list = getVault();
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      saveVault(list);
      showToast('Đã mở khóa sản phẩm khỏi Két sắt 24h');
    } else {
      const info = resolveVariantDetails(prod);
      const lockedPrice = Math.round(info.finalPrice * 0.95 / 10000) * 10000;
      list.push({
        id: prod.id,
        variant: info.variantText,
        lockedPrice,
        originalPrice: info.finalPrice,
        lockedAt: Date.now(),
        expiresAt: Date.now() + VAULT_DURATION_MS
      });
      saveVault(list);
      showToast(`🔐 Đã khóa phiên bản [${info.variantText}] giá ${fmt(lockedPrice)} trong 24h!`, 'success');
    }
  };

  function updateBadges() {
    const totalQty = getCart().reduce((s, i) => s + (i.qty || 1), 0);
    const cmpCount = getCompare().length;
    const vaultCount = getVault().length;
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalQty; });
    document.querySelectorAll('.compare-count').forEach(el => { el.textContent = cmpCount; });
    document.querySelectorAll('.vault-count').forEach(el => { el.textContent = vaultCount; });
  }

  // ================= THẺ SẢN PHẨM TÍCH HỢP CHỌN MÀU & BỘ NHỚ TRỰC TIẾP =================
  window.cardHTML = function (p, showBadge) {
    const badge = showBadge ? `<span class="badge">${p.brand || ''} • ${p.cat}</span>` : '';
    const fb = fallbackSvg(p);
    const imgSrc = p.img || fb;
    const isCmp = getCompare().includes(p.id);
    const isVault = getVault().some(x => x.id === p.id);
    const info = resolveVariantDetails(p);

    const colorDotsHtml = info.v.colors.map((c, idx) => `
      <button type="button" class="js-color-dot" title="${c.name}" onclick="selectCardVariant('${p.id}','color',${idx})"
        style="width:16px;height:16px;border-radius:50%;background:${c.hex};border:none;cursor:pointer;outline:${idx === info.cIdx ? '2px solid #111' : '1px solid #cbd5e1'};outline-offset:${idx === info.cIdx ? '2px' : '0px'};"></button>
    `).join('');

    const storageChipsHtml = info.v.storages.map((s, idx) => `
      <button type="button" class="js-storage-chip" onclick="selectCardVariant('${p.id}','storage',${idx})"
        style="padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:600;cursor:pointer;border:1px solid ${idx === info.sIdx ? '#111' : '#e2e8f0'};background:${idx === info.sIdx ? '#111' : '#f8fafc'};color:${idx === info.sIdx ? '#fff' : '#334155'};">
        ${s.label.split(' ')[0]}
      </button>
    `).join('');

    return `
      <div class="product-card" data-prod-card="${p.id}" style="border:1px solid #e5e7eb;border-radius:16px;padding:14px;display:flex;flex-direction:column;background:#fff;transition:box-shadow .2s;">
        <div class="thumb" onclick="openVariantModal('${p.id}')" title="Nhấn để chọn chi tiết màu sắc & cấu hình" style="cursor:pointer;background:#f8fafc;border-radius:12px;aspect-ratio:1/.85;overflow:hidden;margin-bottom:10px;display:flex;align-items:center;justify-content:center;position:relative;">
          <img src="${imgSrc}" alt="${p.name}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fb}';" style="width:100%;height:100%;object-fit:contain;padding:10px;">
          <span style="position:absolute;bottom:8px;right:8px;background:rgba(15,23,42,.78);color:#fff;font-size:10px;padding:3px 8px;border-radius:999px;backdrop-filter:blur(2px);">Tùy chọn bản</span>
        </div>
        ${badge}
        <h3 onclick="openVariantModal('${p.id}')" style="cursor:pointer;font-size:14px;font-weight:600;line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:39px;">${p.name}</h3>
        <p class="desc" style="font-size:11.5px;color:#64748b;line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1;">${p.desc || ''}</p>

        <!-- Bộ chọn nhanh Màu sắc & Bộ nhớ ngay trên thẻ -->
        <div style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:10px;padding:8px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:6px;">${colorDotsHtml}</div>
            <button type="button" onclick="openVariantModal('${p.id}')" style="background:none;border:none;color:#0284c7;font-size:10.5px;font-weight:600;cursor:pointer;text-decoration:underline;">Chi tiết</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">${storageChipsHtml}</div>
          <div class="js-variant-label" style="font-size:10.5px;color:#475569;font-weight:500;">${info.variantText}</div>
        </div>

        <div class="price js-card-price" style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:10px;">${fmt(info.finalPrice)}</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          <button class="btn btn-dark" style="width:100%;padding:10px 14px;font-size:13px;" onclick="addToCart('${p.id}')">+ Thêm vào giỏ</button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button type="button" data-cmp-btn="${p.id}" onclick="toggleCompare('${p.id}')" style="padding:7px 8px;border-radius:999px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid ${isCmp ? '#0f172a' : '#cbd5e1'};background:${isCmp ? '#0f172a' : '#fff'};color:${isCmp ? '#fff' : '#111'};">
              ${isCmp ? '✓ Đang so sánh' : '⇄ So sánh'}
            </button>
            <button type="button" data-vault-btn="${p.id}" onclick="toggleVault24h('${p.id}')" style="padding:7px 8px;border-radius:999px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid ${isVault ? '#f59e0b' : '#cbd5e1'};background:${isVault ? '#fef3c7' : '#fff'};color:${isVault ? '#92400e' : '#111'};">
              ${isVault ? '🔒 Đã khóa 24h' : '🔐 Két sắt 24h'}
            </button>
          </div>
        </div>
      </div>
    `;
  };

  // ================= HEADER & DROPDOWN TÀI KHOẢN =================
  function renderHeader() {
    const headerEl = document.getElementById('app-header');
    if (!headerEl) return;
    const user = window.USBAK_AUTH && window.USBAK_AUTH.getUser();
    const isAdmin = user && user.role === 'admin';
    const path = window.location.pathname;
    const initial = user && user.name ? user.name.trim().charAt(0).toUpperCase() : 'U';

    const authHtml = user
      ? `<div class="usbak-user-wrap" style="position:relative;">
           <button type="button" id="userMenuToggle" style="display:inline-flex;align-items:center;gap:8px;background:#f1f5f9;border:1px solid #e2e8f0;padding:5px 12px 5px 6px;border-radius:999px;font-size:13px;cursor:pointer;color:#0f172a;">
             <span style="width:28px;height:28px;border-radius:50%;background:#111;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${initial}</span>
             <span style="font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.name}</span>
             ${isAdmin ? '<span style="background:#0284c7;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;">ADMIN</span>' : ''}
             <span style="font-size:10px;color:#64748b;">▼</span>
           </button>
           <div id="userDropdownMenu" style="display:none;position:absolute;right:0;top:calc(100% + 8px);width:240px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 16px 36px rgba(0,0,0,0.14);padding:8px;z-index:999;">
             <div style="padding:8px 12px;border-bottom:1px solid #f1f5f9;margin-bottom:6px;">
               <div style="font-weight:700;font-size:13.5px;color:#0f172a;">${user.name}</div>
               <div style="font-size:11.5px;color:#64748b;word-break:break-all;">${user.email}</div>
             </div>
             ${isAdmin ? '<a href="admin.html" style="display:block;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#0369a1;background:#f0f9ff;margin-bottom:4px;">🔐 Bảng điều khiển Admin</a>' : ''}
             <button type="button" onclick="openAccountModal()" style="width:100%;text-align:left;background:none;border:none;padding:9px 12px;border-radius:10px;font-size:13px;cursor:pointer;color:#0f172a;">👤 Hồ sơ & Đổi mật khẩu</button>
             <a href="cart.html#myOrders" style="display:block;padding:9px 12px;border-radius:10px;font-size:13px;color:#0f172a;">📦 Lịch sử đơn hàng của tôi</a>
             <a href="vault.html" style="display:block;padding:9px 12px;border-radius:10px;font-size:13px;color:#b45309;">🔐 Két sắt 24h (<span class="vault-count">0</span>)</a>
             <div style="border-top:1px solid #f1f5f9;margin:6px 0;"></div>
             <button type="button" onclick="USBAK_AUTH.logout()" style="width:100%;text-align:left;background:none;border:none;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:#dc2626;">🚪 Đăng xuất</button>
           </div>
         </div>`
      : `<button type="button" class="btn-login" style="white-space:nowrap;padding:10px 20px;border-radius:999px;background:#111;color:#fff;border:none;font-weight:600;font-size:13px;cursor:pointer;" onclick="openAuthModal('login')">Đăng nhập</button>`;

    headerEl.innerHTML = `
      <header class="header" style="background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:100;">
        <div class="container" style="display:flex;align-items:center;gap:20px;min-height:76px;flex-wrap:wrap;padding-top:8px;padding-bottom:8px;">
          <a href="index.html" class="logo" style="display:inline-flex;align-items:center;text-decoration:none;flex-shrink:0;" title="Trang chủ USBAKHISO1">
  <img src="images/logo.png" alt="USBAKHISO1" style="height:44px;width:auto;object-fit:contain;display:block;">
</a>
          <nav class="nav" style="display:flex;align-items:center;gap:18px;font-size:13.5px;font-weight:500;flex-wrap:wrap;">
            <a href="index.html" style="${path.endsWith('index.html') || path === '/' ? 'font-weight:700;border-bottom:2px solid #111;' : ''}">Trang chủ</a>
            <a href="products.html" style="${path.endsWith('products.html') ? 'font-weight:700;border-bottom:2px solid #111;' : ''}">Sản phẩm</a>
            <a href="compare.html" style="${path.endsWith('compare.html') ? 'font-weight:700;border-bottom:2px solid #111;' : ''}">So sánh (<span class="compare-count">0</span>)</a>
            <a href="vault.html" style="${path.endsWith('vault.html') ? 'font-weight:700;border-bottom:2px solid #111;' : ''}color:#b45309;font-weight:600;">🔐 Két sắt 24h (<span class="vault-count">0</span>)</a>
            <a href="cart.html" style="${path.endsWith('cart.html') ? 'font-weight:700;border-bottom:2px solid #111;' : ''}">Giỏ hàng (<span class="cart-count">0</span>)</a>
          </nav>
          <form class="search" style="flex:1;min-width:200px;max-width:320px;background:#f1f5f9;border-radius:12px;padding:0 14px;height:40px;display:flex;align-items:center;" onsubmit="event.preventDefault(); window.location.href='products.html?q='+encodeURIComponent(document.getElementById('globalSearch').value)">
            <input type="text" id="globalSearch" placeholder="Tìm sản phẩm, mã SKU..." style="width:100%;border:none;background:transparent;outline:none;font-size:13.5px;">
          </form>
          <div class="header-actions" style="margin-left:auto;">
            ${authHtml}
          </div>
        </div>
      </header>
    `;

    const toggleBtn = document.getElementById('userMenuToggle');
    const dropdown = document.getElementById('userDropdownMenu');
    if (toggleBtn && dropdown) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
      });
      document.addEventListener('click', () => {
        dropdown.style.display = 'none';
      });
    }
    updateBadges();
  }

  // ================= FOOTER ĐỒNG BỘ 4 CỘT =================
  function renderFooter() {
    const footerEl = document.getElementById('app-footer');
    if (!footerEl) return;
    footerEl.innerHTML = `
      <style>
        .usbak-footer { background: #111827; color: #e5e7eb; margin-top: 80px; border-top: 1px solid #1f2937; font-family: 'Inter', sans-serif; }
        .usbak-footer-inner { max-width: 1200px; margin: 0 auto; padding: 52px 24px 36px; display: grid; grid-template-columns: 1.5fr 1fr 1fr 1.2fr; gap: 36px; align-items: start; }
        .usbak-footer h4 { color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
        .usbak-footer p { font-size: 13px; color: #9ca3af; line-height: 1.75; margin-bottom: 10px; }
        .usbak-footer ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .usbak-footer li a { font-size: 13px; color: #9ca3af; text-decoration: none; transition: color .15s; }
        .usbak-footer li a:hover { color: #ffffff; }
        .usbak-footer-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .usbak-footer-badges span { background: #1f2937; border: 1px solid #374151; color: #d1d5db; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
        .usbak-footer-bottom { border-top: 1px solid #1f2937; padding: 20px 24px; max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #6b7280; }
        @media (max-width: 960px) { .usbak-footer-inner { grid-template-columns: repeat(2, 1fr); gap: 28px; } }
        @media (max-width: 560px) { .usbak-footer-inner { grid-template-columns: 1fr; } .usbak-footer-bottom { flex-direction: column; text-align: center; } }
      </style>
      <footer class="usbak-footer">
        <div class="usbak-footer-inner">
          <div>
            <a href="index.html" style="display:inline-flex;align-items:center;background:#ffffff;padding:4px 10px;border-radius:6px;margin-bottom:14px;text-decoration:none;" title="Về trang chủ">
  <img src="images/logo.png" alt="USBAKHISO1" style="height:40px;width:auto;object-fit:contain;display:block;">
</a>
            <p>Hệ thống bán lẻ thiết bị công nghệ tối giản chính hãng: Apple, Samsung, Xiaomi, Redmi, ASUS, Dell & Phụ kiện chuẩn MFi.</p>
            <p>Cam kết bảo hành 1 đổi 1, trợ giá sinh viên & giữ giá Két sắt 24h minh bạch.</p>
            <div class="usbak-footer-badges">
              <span>COD Toàn Quốc</span>
              <span>Chuyển khoản 24/7</span>
              <span>Bảo hành 12 tháng</span>
            </div>
          </div>

          <div>
            <h4>Danh mục sản phẩm</h4>
            <ul>
              <li><a href="products.html?cat=dien-thoai">Điện thoại thông minh</a></li>
              <li><a href="products.html?cat=laptop">Laptop & MacBook</a></li>
              <li><a href="products.html?cat=tablet">Máy tính bảng (iPad / Tab)</a></li>
              <li><a href="products.html?cat=tai-nghe">Tai nghe không dây</a></li>
              <li><a href="products.html?cat=phu-kien">Phụ kiện & Cáp sạc</a></li>
            </ul>
          </div>

          <div>
            <h4>Tính năng & Dịch vụ</h4>
            <ul>
              <li><a href="compare.html">⇄ Bảng so sánh thông số</a></li>
              <li><a href="vault.html">🔐 Két sắt 24h (-5% giá)</a></li>
              <li><a href="cart.html">🛒 Giỏ hàng & Thanh toán</a></li>
              <li><a href="cart.html#myOrders">📦 Tra cứu đơn hàng</a></li>
              <li><a href="admin.html">⚙️ Quản trị hệ thống</a></li>
            </ul>
          </div>

          <div>
            <h4>Hỗ trợ & Tài khoản</h4>
            <p>Hotline tư vấn: <b style="color:#fff;">0366 277 077</b> (8:00 – 21:30)</p>
            <p>Email CSKH: <b style="color:#fff;">support@usbak.vn</b></p>
            <div style="background:#1f2937;border:1px solid #374151;border-radius:12px;padding:12px 14px;margin-top:10px;">
              <div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">Thời gian phục vụ & Bảo hành:</div>
              <div style="font-size:12px;color:#fff;">Thứ 2 – Chủ Nhật • 08:00 – 21:30</div>
            </div>
          </div>
        </div>
        <div class="usbak-footer-bottom">
          <span>© 2026 USBAKHISO1. Tất cả quyền được bảo lưu.</span>
          <span>Hệ thống xác thực Token & SQLite Database • Phiên bản 2026</span>
        </div>
      </footer>
    `;
  }

  // ================= MODAL ĐĂNG NHẬP / ĐĂNG KÝ =================
  window.openAuthModal = function (defaultMode) {
    const existing = document.getElementById('authModal');
    if (existing) existing.remove();

    let isRegister = defaultMode === 'register';
    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;';

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:100%;max-width:430px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,.28);position:relative;">
        <button type="button" id="closeAuthModal" style="position:absolute;right:18px;top:16px;border:none;background:#f1f5f9;width:32px;height:32px;border-radius:50%;font-size:20px;cursor:pointer;line-height:1;">&times;</button>

        <div style="display:grid;grid-template-columns:1fr 1fr;background:#f1f5f9;padding:4px;border-radius:999px;margin-bottom:20px;margin-top:6px;">
          <button type="button" id="tabLoginBtn" style="padding:9px;border-radius:999px;border:none;font-size:13px;font-weight:600;cursor:pointer;">Đăng nhập</button>
          <button type="button" id="tabRegBtn" style="padding:9px;border-radius:999px;border:none;font-size:13px;font-weight:600;cursor:pointer;">Đăng ký mới</button>
        </div>

        <h2 id="authTitle" style="font-size:21px;font-weight:700;margin-bottom:4px;">Chào mừng trở lại</h2>
        <p id="authSub" style="font-size:13px;color:#64748b;margin-bottom:16px;">Đăng nhập để quản lý đơn hàng và sử dụng Két sắt 24h.</p>

        <div id="authErrorBox" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12.5px;padding:10px 12px;border-radius:10px;margin-bottom:14px;"></div>

        <form id="authForm">
          <div id="regOnlyFields" style="display:none;flex-direction:column;gap:12px;margin-bottom:12px;">
            <div style="display:flex;flex-direction:column;gap:5px;">
              <label style="font-size:13px;font-weight:600;">Họ và tên <span style="color:#dc2626;">*</span></label>
              <input type="text" id="authName" placeholder="Ví dụ: Nguyễn Nhật Nam" style="padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;outline:none;">
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              <label style="font-size:13px;font-weight:600;">Số điện thoại</label>
              <input type="tel" id="authPhone" placeholder="Ví dụ: 0901234567" style="padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;outline:none;">
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">
            <label style="font-size:13px;font-weight:600;">Email <span style="color:#dc2626;">*</span></label>
            <input type="email" id="authEmail" required placeholder="nhapemail@example.com" style="padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;outline:none;">
          </div>

          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;">
            <label style="font-size:13px;font-weight:600;">Mật khẩu <span style="color:#dc2626;">*</span></label>
            <div style="position:relative;display:flex;align-items:center;">
              <input type="password" id="authPass" required placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)" style="width:100%;padding:10px 44px 10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;outline:none;">
              <button type="button" id="togglePassVis" style="position:absolute;right:10px;background:none;border:none;font-size:12px;color:#64748b;cursor:pointer;font-weight:600;">Hiện</button>
            </div>
          </div>



          <button type="submit" id="authSubmitBtn" style="width:100%;padding:12px;border-radius:999px;background:#111;color:#fff;border:none;font-weight:600;font-size:14px;cursor:pointer;">Đăng nhập ngay</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const errBox = document.getElementById('authErrorBox');
    function showErr(msg) {
      errBox.textContent = msg;
      errBox.style.display = msg ? 'block' : 'none';
    }

    function updateModeUI() {
      showErr('');
      const tabLogin = document.getElementById('tabLoginBtn');
      const tabReg = document.getElementById('tabRegBtn');
      tabLogin.style.background = !isRegister ? '#111' : 'transparent';
      tabLogin.style.color = !isRegister ? '#fff' : '#475569';
      tabReg.style.background = isRegister ? '#111' : 'transparent';
      tabReg.style.color = isRegister ? '#fff' : '#475569';

      document.getElementById('authTitle').textContent = isRegister ? 'Tạo tài khoản mới' : 'Chào mừng trở lại';
      document.getElementById('authSub').textContent = isRegister
        ? 'Đăng ký thành viên để lưu lịch sử mua hàng & bảo hành.'
        : 'Đăng nhập bằng email của bạn hoặc tài khoản quản trị viên.';
      document.getElementById('regOnlyFields').style.display = isRegister ? 'flex' : 'none';
      document.getElementById('authSubmitBtn').textContent = isRegister ? 'Hoàn tất Đăng ký' : 'Đăng nhập ngay';
    }

    document.getElementById('tabLoginBtn').onclick = () => { isRegister = false; updateModeUI(); };
    document.getElementById('tabRegBtn').onclick = () => { isRegister = true; updateModeUI(); };
    document.getElementById('closeAuthModal').onclick = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('togglePassVis').onclick = function () {
      const inp = document.getElementById('authPass');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      this.textContent = show ? 'Ẩn' : 'Hiện';
    };



    document.getElementById('authForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      showErr('');
      const btn = document.getElementById('authSubmitBtn');
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPass').value;
      const name = document.getElementById('authName').value.trim();
      const phone = document.getElementById('authPhone').value.trim();

      if (isRegister && !name) return showErr('Vui lòng nhập họ và tên của bạn.');
      if (password.length < 6) return showErr('Mật khẩu phải có tối thiểu 6 ký tự.');

      btn.disabled = true;
      btn.textContent = 'Đang xử lý...';

      try {
        const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, email, password })
        });
        const data = await res.json();
        if (data.ok && data.token) {
          USBAK_AUTH.saveSession(data.user, data.token);
          modal.remove();
          showToast('Xin chào ' + data.user.name + '!', 'success');
          if (data.user.role === 'admin' && new URLSearchParams(window.location.search).get('login') === 'admin') {
            window.location.href = 'admin.html';
          } else {
            renderHeader();
            if (typeof window.PAGE_INIT === 'function') window.PAGE_INIT();
          }
        } else {
          showErr(data.error || 'Thông tin đăng nhập không chính xác.');
        }
      } catch (err) {
        showErr('Không thể kết nối đến máy chủ. Vui lòng kiểm tra server Node.js.');
      } finally {
        btn.disabled = false;
        btn.textContent = isRegister ? 'Hoàn tất Đăng ký' : 'Đăng nhập ngay';
      }
    });

    updateModeUI();
  };

  // ================= MODAL HỒ SƠ & ĐỔI MẬT KHẨU =================
  window.openAccountModal = function () {
    const user = window.USBAK_AUTH && window.USBAK_AUTH.getUser();
    if (!user) return openAuthModal('login');

    const existing = document.getElementById('accountModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'accountModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:100%;max-width:450px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,.28);position:relative;">
        <button type="button" onclick="document.getElementById('accountModal').remove()" style="position:absolute;right:18px;top:16px;border:none;background:#f1f5f9;width:32px;height:32px;border-radius:50%;font-size:20px;cursor:pointer;">&times;</button>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:4px;">Tài khoản của tôi</h2>
        <p style="font-size:13px;color:#64748b;margin-bottom:18px;">Email: <b>${user.email}</b> • Vai trò: <b>${user.role.toUpperCase()}</b></p>

        <form id="profileForm" style="margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #e2e8f0;">
          <h4 style="font-size:13.5px;margin-bottom:10px;color:#0f172a;">Thông tin cá nhân</h4>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;">
            <label style="font-size:12.5px;font-weight:600;">Họ và tên</label>
            <input type="text" id="profName" value="${user.name || ''}" required style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:13.5px;">
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">
            <label style="font-size:12.5px;font-weight:600;">Số điện thoại</label>
            <input type="tel" id="profPhone" value="${user.phone || ''}" placeholder="Chưa cập nhật" style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:13.5px;">
          </div>
          <button type="submit" style="padding:9px 18px;border-radius:999px;background:#111;color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;">Lưu thông tin</button>
        </form>

        <form id="passChangeForm">
          <h4 style="font-size:13.5px;margin-bottom:10px;color:#0f172a;">Đổi mật khẩu</h4>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
            <input type="password" id="oldPassInp" placeholder="Mật khẩu hiện tại" required style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:13.5px;">
            <input type="password" id="newPassInp" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" required style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:13.5px;">
          </div>
          <button type="submit" style="padding:9px 18px;border-radius:999px;background:#0284c7;color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;">Cập nhật mật khẩu</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('profileForm').onsubmit = async (e) => {
      e.preventDefault();
      const res = await USBAK_AUTH.apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: document.getElementById('profName').value.trim(),
          phone: document.getElementById('profPhone').value.trim()
        })
      });
      const data = await res.json();
      if (data.ok) {
        USBAK_AUTH.saveSession(data.user, USBAK_AUTH.getToken());
        renderHeader();
        showToast('Đã cập nhật hồ sơ cá nhân!', 'success');
      } else {
        showToast(data.error || 'Lỗi cập nhật', 'error');
      }
    };

    document.getElementById('passChangeForm').onsubmit = async (e) => {
      e.preventDefault();
      const res = await USBAK_AUTH.apiFetch('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: document.getElementById('oldPassInp').value,
          newPassword: document.getElementById('newPassInp').value
        })
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('oldPassInp').value = '';
        document.getElementById('newPassInp').value = '';
        showToast('Đổi mật khẩu thành công!', 'success');
      } else {
        showToast(data.error || 'Sai mật khẩu hiện tại', 'error');
      }
    };
  };
// ================= HỆ THỐNG GỢI Ý MUA KÈM & COMBO THÔNG MINH =================
  const DIGITAL_CATALOG = [
    {
      id: 'srv-careplus-12m',
      sku: 'SRV-CARE-12M',
      brand: 'USBAK Care+',
      cat: 'phu-kien',
      line: 'Dịch vụ bảo hành',
      name: 'Gói Bảo hành rơi vỡ & vào nước USBAK Care+ (12 tháng)',
      desc: 'Bảo vệ toàn diện rơi vỡ, vào nước, thay linh kiện chính hãng miễn phí 100%.',
      price: 1290000,
      img: ''
    },
    {
      id: 'srv-office365-1y',
      sku: 'SRV-O365-1Y',
      brand: 'Microsoft',
      cat: 'phu-kien',
      line: 'Phần mềm bản quyền',
      name: 'Phần mềm bản quyền Microsoft 365 Personal (1 năm)',
      desc: 'Word, Excel, PowerPoint bản quyền + 1TB OneDrive Cloud cho PC/Mac/iPad.',
      price: 990000,
      img: ''
    }
  ];

  function getAllCatalogItems() {
    const base = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const existingIds = new Set(base.map(p => p.id));
    return base.concat(DIGITAL_CATALOG.filter(d => !existingIds.has(d.id)));
  }

  // Trích xuất kích thước màn hình (inch) từ tên hoặc thông số
  function extractScreenInches(prod) {
    const text = `${prod.name || ''} ${(prod.specs && prod.specs['Thông số nổi bật']) || ''}`;
    const m = text.match(/(\d{2}(?:\.\d)?)\s*(?:inch|")/i);
    return m ? parseFloat(m[1]) : null;
  }

  // Luật tương thích kỹ thuật (Compatibility Rules Engine)
  function isHardwareCompatible(mainProd, addonProd, mainVariantText) {
    if (!mainProd || !addonProd || mainProd.id === addonProd.id) return false;
    if (addonProd.id.startsWith('srv-')) {
      if (addonProd.id === 'srv-office365-1y') return ['laptop', 'tablet'].includes(mainProd.cat);
      return ['dien-thoai', 'laptop', 'tablet'].includes(mainProd.cat);
    }

    const mName = `${mainProd.name || ''} ${mainVariantText || ''}`.toLowerCase();
    const aName = (addonProd.name || '').toLowerCase();
    const mBrand = (mainProd.brand || '').toLowerCase();
    const aBrand = (addonProd.brand || '').toLowerCase();

    // 1. Không gợi ý phụ kiện chuyên biệt của hãng khác (VD: Apple Pencil cho Galaxy Tab, S-Pen cho iPad)
    if (aName.includes('apple pencil') && !mBrand.includes('apple')) return false;
    if (aName.includes('s-pen') && !mBrand.includes('samsung')) return false;
    if (aName.includes('magsafe') && !mBrand.includes('apple')) return false;

    // 2. Ràng buộc ốp lưng đúng chính xác dòng máy (Edge Case #2: đổi biến thể dòng máy)
    if (aName.includes('ốp lưng') || aName.includes('bao da')) {
      if (aName.includes('iphone 18 pro max') && !mName.includes('iphone 18 pro max')) return false;
      if (aName.includes('galaxy s26 ultra') && !mName.includes('s26 ultra')) return false;
      if (aName.includes('tab s12 ultra') && !mName.includes('tab s12 ultra')) return false;
      if (aName.includes('ipad pro 13') && !(mName.includes('ipad pro') && mName.includes('13'))) return false;
    }

    // 3. Ràng buộc kích thước Balo / Túi chống sốc >= kích thước màn hình Laptop
    if (mainProd.cat === 'laptop' && (aName.includes('balo') || aName.includes('túi chống sốc'))) {
      const laptopSize = extractScreenInches(mainProd);
      const bagSize = extractScreenInches(addonProd);
      if (laptopSize && bagSize && bagSize < laptopSize) return false;
    }

    // 4. Ràng buộc bút cảm ứng theo dòng tablet
    if (aName.includes('apple pencil') && mainProd.cat !== 'tablet') return false;
    if (aName.includes('magic keyboard') && mainProd.cat !== 'tablet') return false;
    if (aName.includes('s-pen') && mainProd.cat !== 'tablet') return false;

    // 5. Không gợi ý phụ kiện quá lệch hệ sinh thái (VD: Củ sạc Xiaomi 120W cho iPhone)
    if (mBrand.includes('apple') && (aBrand.includes('samsung') || aBrand.includes('xiaomi') || aBrand.includes('dell') || aBrand.includes('asus'))) {
      return false;
    }
    if (mBrand.includes('samsung') && (aBrand.includes('apple') || aBrand.includes('xiaomi') || aBrand.includes('dell') || aBrand.includes('asus'))) {
      return false;
    }

    return true;
  }

  // Sinh danh sách gợi ý theo Ranking 3 tầng + Fallback
  async function getSmartCrossSellItems(mainProd, mainVariantText) {
    const catalog = getAllCatalogItems();
    const byId = new Map(catalog.map(p => [p.id, p]));
    let serverData = { pinned: [], collaborative: [], stockMap: {} };

    try {
      const res = await fetch('/api/cross-sell/' + encodeURIComponent(mainProd.id));
      const json = await res.json();
      if (json.ok) serverData = json;
    } catch (e) {}

    const results = [];
    const usedIds = new Set([mainProd.id]);

    const pushCandidate = (addonId, meta) => {
      if (usedIds.has(addonId)) return;
      const prod = byId.get(addonId);
      if (!prod) return;
      if (!isHardwareCompatible(mainProd, prod, mainVariantText)) return;

      const stockInfo = serverData.stockMap[addonId];
      const stock = stockInfo ? Number(stockInfo.stock) : 25;
      const discountPct = Number(meta.discount_percent || 15);
      const typeLabels = {
        essential: 'Thiết yếu',
        protection: 'Bảo vệ máy',
        enhancement: 'Mở rộng',
        digital: 'Dịch vụ số'
      };

      usedIds.add(addonId);
      results.push({
        product: prod,
        relationType: meta.relation_type || 'enhancement',
        relationLabel: typeLabels[meta.relation_type] || 'Mở rộng',
        discountPercent: discountPct,
        badgeText: meta.badge_text || `Tiết kiệm ${discountPct}%`,
        stock,
        outOfStock: stock <= 0,
        selected: stock > 0 && results.filter(r => !r.outOfStock).length < 2, // Mặc định tick 2 món còn hàng đầu tiên
        variantIdx: 0
      });
    };

    // Tầng 1: Admin Pinned
    (serverData.pinned || []).forEach(p => pushCandidate(p.addon_product_id, p));

    // Tầng 2: Collaborative Filtering
    (serverData.collaborative || []).forEach(c => pushCandidate(c.addon_product_id, c));

    // Tầng 3: Fallback theo hãng, danh mục phù hợp & tồn kho > 0
    const fallbackPool = catalog.filter(p =>
      ['phu-kien', 'tai-nghe'].includes(p.cat) &&
      isHardwareCompatible(mainProd, p, mainVariantText)
    );
    fallbackPool.forEach(p => {
      const st = serverData.stockMap[p.id];
      if (!st || st.stock > 0) {
        pushCandidate(p.id, {
          relation_type: p.id.startsWith('srv-') ? 'digital' : (p.name.toLowerCase().includes('sạc') ? 'essential' : 'enhancement'),
          discount_percent: 12,
          badge_text: 'Chuẩn tương thích'
        });
      }
    });

    return results;
  }

  // Biến trạng thái bộ combo đang mở trong Modal
  let activeComboState = null;

  function computeComboPricing() {
    if (!activeComboState) return null;
    const { mainProd, mainInfo, items } = activeComboState;
    const mainPrice = mainInfo.finalPrice;

    let originalTotal = mainPrice;
    let addonOriginalSum = 0;
    let addonDealSum = 0;
    let selectedAddons = [];

    items.forEach(it => {
      if (!it.selected || it.outOfStock) return;
      const vInfo = resolveVariantDetails(it.product, { colorIdx: it.variantIdx, storageIdx: 0 });
      const origPrice = vInfo.finalPrice;
      const dealPrice = Math.round((origPrice * (100 - it.discountPercent) / 100) / 1000) * 1000;

      originalTotal += origPrice;
      addonOriginalSum += origPrice;
      addonDealSum += dealPrice;
      selectedAddons.push({
        ...it,
        variantLabel: vInfo.variantText,
        origPrice,
        dealPrice
      });
    });

    // Bundle Discount: Chọn từ 2 phụ kiện trở lên giảm thêm 5% trên tổng phụ kiện
    const extraBundleDiscount = selectedAddons.length >= 2 ? Math.round((addonDealSum * 0.05) / 1000) * 1000 : 0;
    const finalAddonsTotal = Math.max(0, addonDealSum - extraBundleDiscount);
    const finalTotal = mainPrice + finalAddonsTotal;
    const totalSaved = originalTotal - finalTotal;

    return {
      mainPrice,
      originalTotal,
      totalSaved,
      finalTotal,
      extraBundleDiscount,
      selectedAddons,
      totalItemsCount: 1 + selectedAddons.length
    };
  }

  function renderCrossSellWidget(containerId, showAllModal) {
    const wrap = document.getElementById(containerId);
    if (!wrap || !activeComboState) return;
    const { mainProd, mainInfo, items } = activeComboState;
    const pricing = computeComboPricing();
    const visibleItems = showAllModal ? items : items.slice(0, 3);
    const fbMain = fallbackSvg(mainProd);

    const renderCard = (it, realIdx) => {
      const p = it.product;
      const fb = fallbackSvg(p);
      const vInfo = resolveVariantDetails(p, { colorIdx: it.variantIdx, storageIdx: 0 });
      const origPrice = vInfo.finalPrice;
      const dealPrice = Math.round((origPrice * (100 - it.discountPercent) / 100) / 1000) * 1000;
      const hasVariants = vInfo.v.colors.length > 1;

      return `
        <div class="fbt-card ${it.outOfStock ? 'is-oos' : ''} ${it.selected ? 'is-checked' : ''}"
          style="position:relative;border:1.5px solid ${it.selected ? '#0284c7' : '#e2e8f0'};background:${it.outOfStock ? '#f8fafc' : (it.selected ? '#f0f9ff' : '#fff')};opacity:${it.outOfStock ? '0.55' : '1'};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;transition:.2s;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:${it.outOfStock ? 'not-allowed' : 'pointer'};font-size:11px;font-weight:700;color:#0369a1;">
              <input type="checkbox" ${it.selected ? 'checked' : ''} ${it.outOfStock ? 'disabled' : ''}
                onchange="window.toggleFbtItem(${realIdx}, this.checked)"
                style="width:16px;height:16px;accent-color:#0284c7;cursor:pointer;">
              <span>${it.relationLabel}</span>
            </label>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${it.outOfStock ? '#fee2e2;color:#b91c1c' : '#dcfce7;color:#15803d'};">
              ${it.outOfStock ? 'Hết hàng' : it.badgeText}
            </span>
          </div>

          <div style="display:flex;gap:10px;align-items:center;">
            <img src="${p.img || fb}" onerror="this.src='${fb}'" style="width:54px;height:54px;object-fit:contain;border-radius:10px;background:#fff;border:1px solid #e2e8f0;padding:4px;flex:none;">
            <div style="min-width:0;flex:1;">
              <div title="${p.name}" style="font-size:12.5px;font-weight:600;color:#0f172a;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.name}</div>
              <div style="margin-top:4px;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
                <span style="font-size:13.5px;font-weight:800;color:#dc2626;">${fmt(dealPrice)}</span>
                <span style="font-size:11px;color:#94a3b8;text-decoration:line-through;">${fmt(origPrice)}</span>
              </div>
            </div>
          </div>

          ${hasVariants && !it.outOfStock ? `
            <select onchange="window.changeFbtVariant(${realIdx}, this.value)"
              style="width:100%;padding:5px 8px;border-radius:8px;border:1px solid #cbd5e1;font-size:11.5px;background:#fff;color:#334155;">
              ${vInfo.v.colors.map((c, cIdx) => `<option value="${cIdx}" ${cIdx === it.variantIdx ? 'selected' : ''}>Màu: ${c.name}</option>`).join('')}
            </select>
          ` : ''}
        </div>
      `;
    };

    const hasAddonsSelected = pricing.selectedAddons.length > 0;
    const ctaText = hasAddonsSelected
      ? `Thêm cả ${pricing.totalItemsCount} món vào giỏ hàng`
      : 'Thêm sản phẩm chính vào giỏ';

    wrap.innerHTML = `
      <style>
        .fbt-formula { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 10px; align-items: stretch; }
        .fbt-plus { display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: #64748b; }
        @media (max-width: 760px) {
          .fbt-formula { grid-template-columns: 1fr; }
          .fbt-plus { display: none; }
          .fbt-sticky-summary { position: sticky; bottom: 0; z-index: 20; box-shadow: 0 -6px 20px rgba(0,0,0,.08); }
        }
      </style>
      <div style="margin-top:20px;padding-top:18px;border-top:1.5px dashed #e2e8f0;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:15px;font-weight:800;color:#0f172a;">⚡ Thường được mua cùng nhau (Combo chuẩn tương thích)</div>
            <div style="font-size:12px;color:#64748b;">Chọn từ 2 phụ kiện trở lên để <b>giảm thêm 5%</b> trên tổng nhóm phụ kiện.</div>
          </div>
          ${items.length > 3 && !showAllModal ? `<button type="button" onclick="window.openAllAccessoriesModal()" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;">Xem thêm phụ kiện (${items.length}) →</button>` : ''}
        </div>

        <div class="fbt-formula">
          <!-- Sản phẩm chính (Mặc định khóa chọn) -->
          <div style="border:1.5px solid #111;background:#f8fafc;border-radius:14px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:700;color:#111;">✓ Sản phẩm chính</span>
              <span style="font-size:10px;background:#111;color:#fff;padding:2px 7px;border-radius:999px;">Đang chọn</span>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              <img src="${mainProd.img || fbMain}" onerror="this.src='${fbMain}'" style="width:54px;height:54px;object-fit:contain;border-radius:10px;background:#fff;border:1px solid #e2e8f0;padding:4px;flex:none;">
              <div style="min-width:0;">
                <div style="font-size:12.5px;font-weight:700;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${mainProd.name}</div>
                <div style="font-size:11px;color:#0284c7;font-weight:600;margin-top:2px;">${mainInfo.variantText}</div>
                <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-top:2px;">${fmt(pricing.mainPrice)}</div>
              </div>
            </div>
          </div>

          ${visibleItems.map((it, idx) => `
            <div class="fbt-plus">+</div>
            ${renderCard(it, idx)}
          `).join('')}
        </div>

        <!-- Khung tổng kết giá & Nút CTA động -->
        <div class="fbt-sticky-summary" style="margin-top:14px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:16px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
          <div style="font-size:13px;line-height:1.6;">
            ${hasAddonsSelected ? `
              <div>Tổng giá gốc: <span style="text-decoration:line-through;color:#64748b;">${fmt(pricing.originalTotal)}</span></div>
              <div>Tổng tiết kiệm được: <b style="color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:999px;">-${fmt(pricing.totalSaved)}</b> ${pricing.extraBundleDiscount > 0 ? '<small style="color:#15803d;">(Đã gồm -5% Bundle)</small>' : ''}</div>
            ` : '<div style="color:#64748b;">Chưa chọn phụ kiện mua kèm (tick chọn ở trên để nhận ưu đãi).</div>'}
            <div style="font-size:15px;font-weight:800;color:#0f172a;margin-top:2px;">
              Thành tiền ${hasAddonsSelected ? 'combo' : ''}: <span style="font-size:18px;color:#0284c7;">${fmt(pricing.finalTotal)}</span>
            </div>
          </div>

          <button type="button" onclick="window.addComboToCart()"
            style="padding:12px 22px;border-radius:999px;background:${hasAddonsSelected ? '#0284c7' : '#111'};color:#fff;border:none;font-weight:700;font-size:13.5px;cursor:pointer;white-space:nowrap;">
            🛒 ${ctaText}
          </button>
        </div>
      </div>
    `;
  }

  window.toggleFbtItem = function (idx, checked) {
    if (!activeComboState || !activeComboState.items[idx]) return;
    if (activeComboState.items[idx].outOfStock) return;
    activeComboState.items[idx].selected = checked;
    renderCrossSellWidget('fbtWidgetMount', false);
    if (document.getElementById('fbtDrawerMount')) renderCrossSellWidget('fbtDrawerMount', true);
  };

  window.changeFbtVariant = function (idx, cIdx) {
    if (!activeComboState || !activeComboState.items[idx]) return;
    activeComboState.items[idx].variantIdx = Number(cIdx) || 0;
    renderCrossSellWidget('fbtWidgetMount', false);
    if (document.getElementById('fbtDrawerMount')) renderCrossSellWidget('fbtDrawerMount', true);
  };

  window.openAllAccessoriesModal = function () {
    if (!activeComboState) return;
    const old = document.getElementById('fbtAllModal');
    if (old) old.remove();
    const drawer = document.createElement('div');
    drawer.id = 'fbtAllModal';
    drawer.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;z-index:1100;padding:16px;';
    drawer.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:100%;max-width:760px;max-height:88vh;overflow-y:auto;padding:24px;position:relative;">
        <button type="button" onclick="document.getElementById('fbtAllModal').remove()" style="position:absolute;right:16px;top:14px;width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;font-size:20px;cursor:pointer;">×</button>
        <h3 style="font-size:18px;font-weight:800;margin-bottom:4px;">Tất cả phụ kiện & dịch vụ tương thích</h3>
        <p style="font-size:12.5px;color:#64748b;margin-bottom:12px;">Đã lọc tự động theo chuẩn phần cứng & tồn kho thực tế của ${activeComboState.mainProd.name}.</p>
        <div id="fbtDrawerMount"></div>
      </div>
    `;
    drawer.addEventListener('click', e => { if (e.target === drawer) drawer.remove(); });
    document.body.appendChild(drawer);
    renderCrossSellWidget('fbtDrawerMount', true);
  };

  window.addComboToCart = function () {
    if (!activeComboState) return;
    const pricing = computeComboPricing();
    const { mainProd, mainInfo } = activeComboState;

    // 1. Thêm sản phẩm chính
    window.addToCart(mainProd.id, mainInfo.finalPrice, mainInfo.variantText);

    // 2. Thêm các phụ kiện đang được tick với giá ưu đãi combo
    pricing.selectedAddons.forEach((it, index) => {
      // Nếu có bundle discount 5%, phân bổ nốt vào món cuối để tổng khớp tuyệt đối
      let finalAddonPrice = it.dealPrice;
      if (pricing.extraBundleDiscount > 0) {
        finalAddonPrice = Math.round((it.dealPrice * 0.95) / 1000) * 1000;
      }
      const badgeNote = `Mua kèm ${mainProd.name.split('(')[0].trim()} (-${it.discountPercent}%${pricing.extraBundleDiscount > 0 ? ' +5% Bundle' : ''})`;
      window.addToCart(it.product.id, finalAddonPrice, `${it.variantLabel} • ${badgeNote}`);
    });

    const vm = document.getElementById('variantModal');
    if (vm) vm.remove();
    const fm = document.getElementById('fbtAllModal');
    if (fm) fm.remove();
    showToast(`Đã thêm combo ${pricing.totalItemsCount} món (Tiết kiệm ${fmt(pricing.totalSaved)}) vào giỏ hàng!`, 'success');
  };

  async function initCrossSellForProduct(prod) {
    const info = resolveVariantDetails(prod);
    const items = await getSmartCrossSellItems(prod, info.variantText);
    activeComboState = { mainProd: prod, mainInfo: info, items };
    renderCrossSellWidget('fbtWidgetMount', false);
  }
  window.USBAK_CART = { getCart, saveCart, fmt };
  window.USBAK_COMPARE = { getCompare, saveCompare };
  window.USBAK_VAULT = { getVault, saveVault, fmt };
  window.USBAK_VARIANTS = { resolveVariantDetails, getProductVariants };

  document.addEventListener('DOMContentLoaded', async function () {
    if (window.USBAK_AUTH && window.USBAK_AUTH.getToken()) {
      await window.USBAK_AUTH.syncSession();
    }
    renderHeader();
    renderFooter();
    renderCompareBar();

    if (new URLSearchParams(window.location.search).get('login') === 'admin' && !window.USBAK_AUTH.getUser()) {
      openAuthModal('login');
    }
    if (typeof window.PAGE_INIT === 'function') {
      window.PAGE_INIT();
    }
  });
})();
