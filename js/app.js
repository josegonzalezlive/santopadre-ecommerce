// app.js — SantoPadre® Logic Engine
let cart = [];

/**
 * ELITE SEO TECHNIQUE 4: Dynamic SEO Manager (Edge SEO Simulation)
 * Updates page metadata based on user scroll and section interaction.
 */
const DynamicSEOManager = {
  config: {
    baseTitle: "SantoPadre®",
    sections: {
      "section-taqueria": { title: "Los Mejores Tacos de Araure | Birria y Pastor", desc: "Prueba la auténtica taquería mexicana en Araure. Tacos de birria con consomé, al pastor y punta trasera." },
      "section-entrantes": { title: "Entrantes Mexicanos Crujientes en Acarigua", desc: "Flautas de cochinita, nachos con guacamole real y entradas que manchan." },
      "section-especialidades": { title: "Burritos XXL y Especialidades en Portuguesa", desc: "Burritos de 1kg, Birria Ramen y fajitas premium para los más atrevidos." },
      "culture-hub": { title: "Cultura & Tradición Mexicana | El Manifiesto SantoPadre", desc: "Explora la historia detrás de nuestra birria y la técnica de nixtamalización." }
    }
  },
  init() {
    this.observeSections();
    window.addEventListener('hashchange', () => this.updateByHash());
    this.updateByHash();
  },
  observeSections() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.updateMetadata(entry.target.id);
        }
      });
    }, { threshold: 0.5 });
    
    Object.keys(this.config.sections).forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  },
  updateByHash() {
    const hash = window.location.hash.replace('#', '');
    if (this.config.sections[hash]) this.updateMetadata(hash);
  },
  updateMetadata(sectionId) {
    const data = this.config.sections[sectionId];
    if (data) {
      document.title = `${data.title} | ${this.config.baseTitle}`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', data.desc);
    }
  }
};

// 1. Initial Rendering
document.addEventListener('DOMContentLoaded', () => {
  const storedCheckout = localStorage.getItem('santopadre_checkout');
  if (storedCheckout) {
    try {
      const data = JSON.parse(storedCheckout);
      if (data && data.items) cart = data.items;
      if (data && data.isVip) {
        const vipCheck = document.getElementById('vip-check');
        if (vipCheck) vipCheck.checked = true;
      }
    } catch (e) {
      console.error("Error loading cart:", e);
    }
  }

  renderProducts();
  renderReviews();
  renderFAQ();
  updateFooter();
  updateCartUI();
  initGSAP();
  initReveal();
  initRain();
  
  // Iniciar SEO Dinámico
  DynamicSEOManager.init();


  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('cart') === 'open') {
    // Retrasar levemente para asegurar que todo haya cargado
    setTimeout(() => {
      document.getElementById('cart-panel').classList.add('active');
      document.getElementById('backdrop').classList.add('active');
    }, 100);
  }
});

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

function updateFooter() {
  const footerText = document.querySelector('footer .brand p');
  if (footerText && CATALOG.info) {
    footerText.innerText = `${CATALOG.info.location}. ${CATALOG.info.hours}. ${CATALOG.info.tagline || ''}`;
  }
}

function renderFAQ() {
  const container = document.getElementById('faq-grid');
  if (!container || !CATALOG.faq) return;

  container.innerHTML = CATALOG.faq.map((item, idx) => `
    <div class="faq-item reveal" id="faq-${idx}">
      <div class="faq-header" onclick="toggleFAQ(${idx})">
        <h3>${item.q}</h3>
        <div class="icon"></div>
      </div>
      <div class="faq-content">
        <p>${item.a}</p>
      </div>
    </div>
  `).join('');
}

function toggleFAQ(idx) {
  const items = document.querySelectorAll('.faq-item');
  const current = document.getElementById(`faq-${idx}`);
  
  // Close others (optional, comment out if you want multiple open)
  items.forEach(item => {
    if (item !== current) item.classList.remove('active');
  });

  current.classList.toggle('active');
}

function initGSAP() {
  if (typeof gsap === 'undefined') return;
  
  gsap.registerPlugin(ScrollTrigger);
  const target = document.querySelector(".js-fill > span");

  if (target && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.to(target, {
      backgroundSize: "200% 200%",
      ease: "none",
      scrollTrigger: {
        trigger: ".js-fill",
        start: "top 80%",
        end: "bottom 35%",
        scrub: true
      }
    });
  }
}

function renderProducts() {
  const container = document.getElementById('menu-sections');
  if (!container) return;

  container.innerHTML = CATALOG.categories.map(cat => {
    const rainSections = ['entrantes', 'taqueria', 'especialidades', 'bebidas'];
    const hasRain = rainSections.includes(cat.id);
    const icon = cat.id === 'bebidas' ? 'Element-3.webp' : 'element-8.webp';
    
    return `
      <section id="section-${cat.id}" class="container">
        ${hasRain ? `<div class="rain-container" data-icon="${icon}"></div>` : ''}
        <div class="smart-title">
          <h2 class="reveal">${cat.name}</h2>
          <p class="reveal">${cat.subtitle || 'Los favoritos de la Parroquia, preparados con honestidad radical.'}</p>
        </div>
        <div class="products-grid">
          ${cat.items.map(item => renderProductCard(item, cat.id)).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function initRain() {
  const containers = document.querySelectorAll('.rain-container');
  if (!containers.length) return;

  const cols = [15, 50, 85]; // 3 columns positions in %

  const rainObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const container = entry.target;
      if (entry.isIntersecting && !container._rainActive) {
        container._rainActive = true;
        const iconName = container.getAttribute('data-icon') || 'element-8.webp';
        cols.forEach(col => spawnIcon(container, col, iconName));
        let currentCol = 0;
        container._rainInterval = setInterval(() => {
          if (!container._rainActive) return;
          spawnIcon(container, cols[currentCol], iconName);
          currentCol = (currentCol + 1) % cols.length;
        }, 2500); // Slower interval to reduce DOM churn
      } else if (!entry.isIntersecting && container._rainActive) {
        container._rainActive = false;
        if (container._rainInterval) clearInterval(container._rainInterval);
      }
    });
  }, { threshold: 0.05 });

  containers.forEach(container => rainObserver.observe(container));
}

function spawnIcon(container, xPos, iconName) {
  const icon = document.createElement('div');
  icon.className = 'rain-icon';
  icon.style.left = `${xPos}%`;
  icon.style.backgroundImage = `url('assets/${iconName}')`;
  
  // Random slight variation in animation duration for a natural look
  const duration = 8 + Math.random() * 4;
  icon.style.animationDuration = `${duration}s`;
  
  container.appendChild(icon);

  // Remove after animation finished
  setTimeout(() => {
    if (icon.parentNode) icon.remove();
  }, duration * 1000);
}

function scrollToProduct(id) {
  const el = document.getElementById(`product-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.borderColor = 'var(--accent)';
    setTimeout(() => el.style.borderColor = '', 2000);
  }
}

function renderProductCard(item, catId = '') {
  const btnText = 'Agregar +';
  const badgeHtml = item.badges && item.badges.length > 0 
    ? `<div class="badge"><div class="marquee-inner">
        <span class="filled">${item.badges[0]}</span>
        <span>${item.badges[0]}</span>
        <span class="filled">${item.badges[0]}</span>
        <span>${item.badges[0]}</span>
      </div></div>` 
    : '';

  // SEO Alt Text Generation
  const seoAltText = `SantoPadre - ${item.name} en Acarigua/Araure`;

  let mediaHtml = `<div class="thumb" style="background-image: url('${item.image || 'assets/menu/flauta-cochinita.avif'}')">
    <img src="${item.image || 'assets/menu/flauta-cochinita.avif'}" alt="${seoAltText}" loading="lazy" decoding="async" style="display:none;">
  </div>`;

  // ═══════════════════════════════════════════════════════════════
  // PASE CORPORATIVO — Embedded 3D Holographic Ticket Widget
  // ═══════════════════════════════════════════════════════════════
  if (item.id === 'pase-corporativo') {
    mediaHtml = renderPaseCorporativoWidget();
  } else if (item.id === 'gift-card-25') {
    mediaHtml = renderGiftCardWidget(25);
  } else if (item.id === 'gift-card-50') {
    mediaHtml = renderGiftCardWidget(50);
  } else if (item.video) {
    mediaHtml = `
      <div class="thumb">
        <video muted loop playsinline style="width:100%; height:100%; object-fit:cover;" preload="none" poster="${item.image || ''}" onmouseover="this.play()" onmouseout="this.pause()">
          <source src="${item.video}" type="video/mp4">
        </video>
        ${badgeHtml}
      </div>
    `;
  } else {
    mediaHtml = `
      <div class="thumb" style="background-image: url('${item.image || 'assets/menu/flauta-cochinita.avif'}')">
        ${badgeHtml}
      </div>
    `;
  }

  const clickAction = `onclick="handleAddToCart('${item.id}', '${catId}')" style="cursor:pointer"`;
  const isRegalo = catId === 'regalos';

  const spicyHtml = item.spicyLevel > 0 
    ? `<div class="spicy-rating" title="Nivel de picante: ${item.spicyLevel}">${'🌶️'.repeat(item.spicyLevel)}</div>` 
    : '';

  const chefNoteHtml = item.chefNote 
    ? `<div class="chef-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="9" r="3"/></svg>
        <span><strong>Chef:</strong> ${item.chefNote}</span>
       </div>` 
    : '';

  return `
    <div class="product-card reveal" id="product-${item.id}">
      <div class="media-container" ${!isRegalo ? clickAction : ''}>
        ${mediaHtml}
        ${spicyHtml}
      </div>
      <div class="product-info">
        <h3 ${clickAction}>${item.name}</h3>
        ${item.tags ? `<div class="product-tags">${item.tags.map(tag => `<span>${tag}</span>`).join('')}</div>` : ''}
        <p class="desc" ${clickAction}>${item.description || ''}</p>
        ${chefNoteHtml}
        ${item.allergens ? `<p class="allergens"><span>Alergenos:</span> ${item.allergens}</p>` : ''}
      </div>
      <div class="footer">
        <div class="price">$${item.price ? item.price.toFixed(2) : '—'}</div>
        <button class="add-btn" onclick="handleAddToCart('${item.id}', '${catId}')">${btnText}</button>
      </div>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════════════
// PASE CORPORATIVO WIDGET — Self-contained 3D Holographic Ticket
// All classes prefixed with 'sp-ticket-' to avoid CSS collisions.
// ═══════════════════════════════════════════════════════════════════
function renderPaseCorporativoWidget() {
  const SP_LOGO = 'assets/logo-sm.webp';
  const SP_MONOGRAM = "data:image/svg+xml,%3Csvg version='1.0' xmlns='http://www.w3.org/2000/svg' width='640pt' height='640pt' viewBox='0 0 640 640' preserveAspectRatio='xMidYMid meet'%3E%3Cg transform='translate(0.000000,640.000000) scale(0.100000,-0.100000)' fill='%23000000' stroke='none'%3E%3Cpath d='M4665 5121 c-16 -10 -42 -31 -56 -47 -33 -36 -109 -144 -109 -156 0 -22 53 -2 128 48 98 67 124 97 120 138 -2 25 -8 32 -28 34 -14 1 -38 -6 -55 -17z'/%3E%3Cpath d='M4099 5082 c-17 -3 -46 -78 -83 -221 -14 -51 -28 -96 -31 -99 -3 -3 -46 -8 -96 -12 -62 -5 -94 -11 -100 -21 -14 -22 -10 -75 6 -89 8 -7 15 -18 15 -24 0 -6 15 -19 33 -29 17 -10 45 -29 61 -43 l29 -25 -41 -161 c-39 -149 -95 -299 -108 -285 -3 3 6 46 20 96 32 110 41 168 32 213 -6 36 -126 181 -168 205 -33 18 -97 15 -145 -6 -23 -11 -65 -42 -94 -70 -29 -28 -55 -51 -58 -51 -3 0 -19 14 -35 30 -15 16 -41 32 -56 35 -32 7 -106 -10 -116 -26 -3 -6 -8 -47 -10 -92 -8 -147 -84 -424 -134 -487 l-20 -25 6 45 c4 25 22 97 41 160 18 63 36 141 40 172 l6 57 -34 39 c-19 21 -46 53 -61 70 l-26 32 -39 0 c-49 0 -85 -19 -101 -52 l-13 -27 -47 25 -47 26 -54 -6 c-29 -2 -77 -16 -106 -31 -76 -37 -165 -136 -214 -238 -55 -114 -74 -194 -75 -307 l0 -95 23 -52 c16 -36 42 -69 85 -106 87 -77 123 -97 175 -97 62 0 121 32 180 96 30 33 52 50 57 43 3 -6 27 -24 52 -40 56 -35 108 -38 169 -8 23 11 52 34 63 49 l21 29 33 -23 c25 -16 46 -22 85 -21 73 2 86 19 117 151 15 60 37 153 49 206 25 106 67 208 95 233 l17 16 -23 -98 c-28 -113 -31 -225 -9 -280 15 -38 82 -103 146 -142 76 -47 178 -10 251 90 23 33 47 59 52 59 5 0 32 -17 60 -39 28 -21 61 -44 73 -50 31 -16 87 -14 131 4 80 34 118 71 208 203 1 2 33 -21 71 -52 37 -30 91 -68 118 -83 l50 -28 85 0 85 0 58 29 c65 33 154 121 188 186 12 25 37 83 53 129 l31 84 70 25 c86 30 143 68 178 119 31 45 35 96 11 133 -28 42 -107 120 -122 120 -7 0 -30 -19 -50 -42 -48 -54 -83 -88 -92 -88 -4 0 -15 21 -25 46 -23 60 -149 186 -210 210 -65 24 -174 16 -245 -20 -30 -15 -64 -36 -76 -47 l-21 -19 -59 59 c-45 46 -65 59 -81 55 l-20 -6 5 50 4 50 -53 58 c-30 33 -63 72 -75 88 l-20 28 -65 7 c-35 3 -71 5 -80 3z m326 -559 c-29 -70 -47 -121 -61 -180 -10 -37 -26 -79 -37 -93 -10 -14 -36 -52 -57 -86 -21 -33 -52 -71 -70 -84 l-33 -24 6 70 c4 38 22 123 42 188 19 66 38 141 41 166 l6 47 71 1 c38 1 72 4 75 7 12 12 24 4 17 -12z m342 -202 c18 -14 33 -32 33 -40 0 -7 -14 -40 -32 -73 -31 -58 -93 -122 -110 -112 -13 8 -9 56 11 135 27 106 39 132 53 123 7 -4 28 -19 45 -33z m-2037 -265 c-27 -88 -82 -206 -108 -229 l-19 -18 -7 39 c-12 78 53 261 121 343 l28 33 3 -48 c2 -29 -5 -77 -18 -120z'/%3E%3Cpath d='M4885 4996 c-63 -14 -208 -61 -234 -76 l-16 -8 27 -7 c15 -4 32 -4 37 0 6 3 95 10 197 15 l187 9 21 20 c16 17 18 25 10 39 -9 13 -27 17 -90 19 -43 1 -106 -4 -139 -11z'/%3E%3Cpath d='M2745 4971 c-97 -24 -175 -98 -175 -166 0 -62 72 -109 127 -83 37 17 41 53 12 84 -18 20 -21 29 -13 42 34 53 149 74 201 36 56 -42 44 -94 -43 -184 -35 -37 -64 -72 -64 -78 0 -23 132 -14 222 14 95 30 128 48 128 70 0 21 -38 15 -139 -20 -40 -14 -78 -26 -82 -26 -5 0 7 22 26 49 69 95 76 142 32 205 -38 55 -139 79 -232 57z'/%3E%3Cpath d='M1896 4929 c-129 -31 -268 -143 -324 -261 -41 -85 -58 -187 -44 -266 20 -114 59 -180 231 -391 33 -41 78 -107 98 -145 l38 -71 0 -85 0 -85 -27 -50 c-55 -104 -137 -155 -248 -155 -43 0 -64 5 -83 21 -33 25 -51 88 -44 154 6 61 46 148 64 141 7 -3 13 0 14 7 0 7 6 -7 12 -30 10 -34 23 -51 66 -83 30 -22 63 -40 73 -40 22 0 56 32 68 66 16 40 11 105 -10 152 -20 44 -128 165 -165 185 -62 33 -164 25 -247 -20 -65 -35 -153 -130 -186 -200 l-27 -58 0 -110 0 -110 32 -65 c18 -37 53 -85 80 -111 74 -70 229 -166 298 -184 120 -31 252 -13 385 53 106 52 224 169 273 272 48 98 62 187 46 289 -22 148 -74 253 -206 419 -47 59 -98 134 -114 167 -61 127 -21 238 112 305 58 30 69 27 69 -22 0 -50 -33 -123 -65 -144 -13 -8 -28 -28 -35 -43 l-12 -29 16 -30 c8 -16 30 -35 48 -43 18 -7 55 -28 82 -46 27 -19 61 -33 78 -33 89 0 182 119 203 262 9 59 -16 157 -57 220 -38 61 -137 151 -197 180 l-46 23 -105 2 c-58 1 -123 -2 -144 -8z'/%3E%3Cpath d='M5073 3719 c-38 -11 -63 -43 -63 -79 0 -32 17 -50 48 -50 16 0 26 7 29 20 8 30 37 21 41 -13 5 -37 -45 -87 -87 -87 -17 0 -75 24 -135 55 l-106 56 -63 6 c-85 8 -188 -11 -264 -48 -57 -27 -113 -77 -113 -100 0 -15 37 -10 77 11 21 11 72 26 114 35 108 22 206 10 291 -38 35 -19 89 -43 120 -52 119 -34 216 17 248 129 l13 47 -18 39 c-30 66 -69 86 -132 69z'/%3E%3Cpath d='M3899 3635 c-14 -7 -30 -24 -36 -37 -11 -25 -45 -136 -63 -205 -6 -24 -13 -43 -15 -43 -2 0 -39 15 -82 32 l-78 33 -115 0 -115 0 -48 -25 c-90 -46 -144 -138 -115 -197 20 -41 61 -66 109 -66 32 0 47 6 61 23 10 12 18 33 18 46 0 27 -32 64 -55 64 -25 0 0 35 35 50 48 20 161 7 265 -31 50 -17 91 -33 93 -35 4 -3 -38 -215 -44 -226 -3 -4 -21 0 -40 8 -46 19 -102 11 -167 -24 -63 -34 -124 -102 -171 -191 -59 -112 -74 -167 -102 -358 -3 -17 -14 -42 -25 -55 l-20 -23 7 50 c3 28 24 119 46 204 21 85 37 164 34 175 -3 12 -31 47 -62 79 -45 45 -62 57 -88 57 -33 0 -78 -25 -100 -55 l-13 -19 -28 22 c-35 28 -113 29 -170 3 -53 -24 -113 -74 -145 -118 l-25 -36 -8 54 c-11 79 -47 144 -126 230 -49 53 -86 83 -123 100 l-53 24 -145 0 -145 0 -80 -23 c-103 -30 -250 -99 -330 -157 -177 -126 -267 -302 -235 -460 l12 -60 67 -66 c87 -86 120 -103 199 -103 l64 -1 24 28 c41 48 28 111 -35 171 -19 19 -31 40 -31 56 0 78 79 201 165 258 27 18 52 32 56 32 4 0 -3 -26 -16 -58 -29 -73 -46 -139 -84 -331 -17 -85 -42 -191 -55 -235 -13 -45 -38 -135 -54 -201 -40 -158 -68 -230 -99 -255 -36 -28 -56 -25 -77 13 -37 64 -81 116 -99 117 -27 0 -73 -26 -96 -56 -28 -36 -27 -99 2 -155 27 -51 120 -131 192 -165 147 -70 320 21 412 216 42 87 69 179 98 331 l17 86 72 6 c121 9 240 68 335 167 l46 48 1 -62 c0 -33 4 -78 8 -99 13 -69 121 -165 210 -188 l47 -12 43 17 c54 21 119 76 136 116 7 16 15 30 19 30 4 0 24 -18 46 -40 21 -22 53 -45 71 -50 64 -21 163 26 209 100 14 22 29 40 33 40 5 0 19 -12 33 -26 50 -55 148 -71 217 -35 37 19 126 105 133 128 3 8 19 2 47 -17 113 -76 225 -51 323 72 52 65 136 240 177 368 33 102 59 170 67 170 3 0 -4 -21 -14 -48 -10 -26 -33 -101 -51 -166 -25 -92 -30 -130 -25 -165 l7 -46 61 -60 c34 -33 78 -68 99 -78 48 -23 120 -22 166 2 45 23 98 74 119 116 9 17 17 31 18 33 2 2 17 -10 34 -25 17 -16 56 -44 86 -62 l56 -34 72 -5 c57 -3 84 0 129 18 74 27 155 101 191 172 33 65 29 84 -32 143 -23 21 -41 45 -41 52 0 25 -26 12 -95 -49 -103 -91 -171 -112 -193 -63 -21 46 -16 55 32 55 78 0 238 97 304 183 38 50 62 108 62 152 0 60 -33 119 -103 190 -80 80 -119 94 -215 76 -85 -16 -135 -45 -204 -119 -95 -103 -167 -273 -168 -395 0 -36 -39 -119 -82 -176 l-18 -24 0 24 c0 44 40 190 70 259 17 38 30 84 30 102 l0 35 -58 61 -59 62 -81 0 -80 0 -37 50 c-51 69 -80 90 -127 90 -30 0 -46 -7 -68 -28 -50 -51 -51 -162 -1 -223 l19 -23 -45 -131 c-47 -137 -128 -305 -152 -313 l-14 -5 6 84 c8 106 98 540 138 661 16 51 45 123 64 160 l35 68 -61 71 c-34 39 -76 79 -93 90 -36 22 -81 24 -117 4z m1146 -634 c-8 -39 -59 -115 -90 -135 l-25 -16 21 52 c11 29 27 63 35 75 17 28 56 64 62 59 2 -3 1 -18 -3 -35z m-2758 -107 c15 -4 28 -21 39 -51 l18 -45 -11 -75 c-15 -102 -65 -202 -139 -275 -32 -32 -62 -58 -66 -58 -4 0 -8 8 -8 18 0 23 46 197 65 245 28 70 21 92 -49 163 -35 36 -58 67 -52 69 39 13 167 19 203 9z m1388 -116 c-15 -98 -49 -208 -86 -286 -22 -45 -44 -80 -49 -77 -21 13 -7 121 32 254 16 54 32 85 58 113 20 21 40 38 44 38 4 0 5 -19 1 -42z m-721 -125 c-9 -73 -31 -163 -53 -224 -21 -54 -74 -129 -92 -129 -14 0 0 94 26 175 24 71 104 225 117 225 4 0 5 -21 2 -47z'/%3E%3Cpath d='M2646 3336 c-79 -30 -133 -87 -122 -130 9 -35 33 -33 73 6 l34 33 75 3 c99 5 174 -10 276 -57 110 -51 128 -56 128 -38 0 20 -152 134 -220 165 -68 32 -184 40 -244 18z'/%3E%3Cpath d='M4574 2165 c-27 -13 -98 -65 -157 -114 -60 -49 -134 -103 -166 -120 -60 -32 -164 -61 -216 -60 l-30 0 55 18 c80 26 130 54 187 105 l51 46 6 43 c9 59 1 77 -37 77 l-31 0 -85 -88 c-98 -100 -145 -130 -251 -163 l-75 -23 -155 -1 c-85 0 -236 4 -335 9 l-180 8 -95 -20 c-52 -11 -122 -30 -154 -43 -69 -25 -142 -88 -166 -142 l-17 -39 -12 34 c-33 94 -111 156 -209 165 -72 7 -173 -18 -220 -54 -49 -37 -82 -113 -82 -191 0 -74 18 -115 60 -137 48 -25 97 -19 131 14 35 36 37 64 4 96 -29 29 -42 31 -67 8 l-19 -17 -9 14 c-16 25 -11 54 15 92 44 65 185 99 256 63 42 -22 84 -85 110 -163 31 -97 57 -139 97 -158 53 -25 109 -14 150 31 l33 36 -3 36 c-2 25 -11 42 -30 56 l-27 20 -27 -12 c-27 -12 -29 -28 -9 -73 6 -14 2 -18 -17 -18 -40 0 -59 31 -59 93 0 88 42 146 136 188 68 30 222 38 319 15 113 -27 178 -68 258 -164 39 -46 82 -88 96 -93 l27 -10 18 22 c38 48 -10 126 -123 201 l-81 53 58 3 c79 4 217 -12 446 -54 106 -20 237 -38 293 -41 l100 -6 36 17 c42 20 52 46 30 77 l-15 22 -91 -7 c-50 -3 -127 -8 -171 -11 l-80 -5 87 19 c154 34 349 114 475 196 l82 54 6 45 c12 80 -29 97 -121 51z'/%3E%3Cpath d='M3130 1717 c0 -4 22 -18 48 -31 27 -13 75 -52 107 -85 32 -34 67 -61 77 -61 23 0 41 35 32 63 -18 61 -98 108 -196 115 -38 3 -68 2 -68 -1z'/%3E%3C/g%3E%3C/svg%3E";

  return `
    <div class="thumb sp-ticket-wrapper" style="background:var(--ink-2); display:flex; align-items:center; justify-content:center; overflow:visible; position:relative;">
      <style>
        .sp-ticket-app {
          perspective: 1000px;
          --o: 0; --p: 100%; --h: 50%; --r: 0deg;
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Archivo', sans-serif;
          color: #000; overflow: visible;
        }
        .sp-ticket-card {
          width: 55%; aspect-ratio: 20/30;
          display: grid; grid: 1fr/1fr;
          transform: translate3d(0,0,0.1px) rotateY(var(--r));
          transform-style: preserve-3d;
          cursor: grab;
        }
        .sp-ticket-card:active { cursor: grabbing; }
        .sp-ticket-front, .sp-ticket-back {
          grid-area: 1/1;
          background-color: #1a3a2a;
          background-image: radial-gradient(circle at var(--p) 50%, #fff 10%, transparent 100%);
          background-size: 100% 220%; background-position: center; background-repeat: no-repeat;
          border-radius: 10px; display: grid;
          backface-visibility: hidden;
          transform: translateZ(1px); transform-style: preserve-3d;
          mask-image: url(https://assets.codepen.io/13471/ticket-shape.svg);
          -webkit-mask-image: url(https://assets.codepen.io/13471/ticket-shape.svg);
          mask-size: cover; -webkit-mask-size: cover;
          mask-repeat: no-repeat; -webkit-mask-repeat: no-repeat;
          position: relative;
        }
        .sp-ticket-back { transform: rotateY(180deg) translateZ(1px); }
        .sp-ticket-front::after, .sp-ticket-back::after {
          content: ""; position: absolute; inset: 0;
          background-image: linear-gradient(-70deg, transparent 40%, rgba(255,255,255,0.5) 40.5%, transparent);
          background-size: 200% 200%; background-position: var(--p) var(--p);
          z-index: 5; opacity: calc(var(--o) + 0.5); pointer-events: none;
        }
        .sp-ticket-holo {
          position: absolute; inset: 0; border-radius: 10px;
          background-image: repeating-linear-gradient(-45deg,
            hsl(140,80%,40%) 0%, hsl(45,100%,55%) 5%, hsl(150,100%,35%) 10%,
            hsl(80,100%,45%) 15%, hsl(170,80%,40%) 20%, hsl(38,100%,50%) 25%,
            hsl(160,90%,45%) 30%, hsl(30,100%,50%) 35%, hsl(140,80%,40%) 40%);
          background-size: 400% 400%;
          background-position: calc(var(--h)) calc(var(--h));
          mask-image: url("${SP_MONOGRAM}");
          -webkit-mask-image: url("${SP_MONOGRAM}");
          mask-size: 25% auto; -webkit-mask-size: 25% auto;
          mask-repeat: repeat; -webkit-mask-repeat: repeat;
          mix-blend-mode: plus-lighter;
          filter: brightness(1.2) contrast(1.1) saturate(1.5);
          opacity: calc(var(--o) + 0.2);
        }
        .sp-ticket-logo { width: 70%; place-self: center; transform: translateY(-14%); position: relative; z-index: 2; display: block; max-width: 100%; }
        .sp-ticket-back .sp-ticket-logo { position: absolute; right: 8%; top: 13%; width: 16%; }
        .sp-ticket-data { margin: 14% 8%; text-transform: uppercase; position: relative; z-index: 2; }
        .sp-ticket-data h4 { font-size: 8px; font-weight: 400; line-height: 1; margin: 0.2em 0; color: #000; text-transform: uppercase; }
        .sp-ticket-data p { font-size: 14px; font-weight: 400; line-height: 1; margin: 0.2em 0 1em; color: #000; }
        .sp-ticket-qr { max-width: 28%; display: block; }
        .sp-ticket-divider {
          position: absolute; display: flex; align-items: center; justify-content: space-between;
          bottom: 2%; left: 0; right: 0; height: 18%; padding: 0 8%;
          background-image: repeating-linear-gradient(90deg,#fff0 0px,#fff0 8px,#0005 8px,#0005 16px);
          background-size: 100% 1.5px; background-repeat: no-repeat; background-position: -4px top;
          font-size: 10px; font-weight: 400; z-index: 2;
        }
        .sp-ticket-username { display: flex; align-items: center; font-family: 'Archivo', sans-serif; font-weight: 600; }
        .sp-ticket-profile { border-radius: 100%; width: 24px; box-shadow: 0 0 0 1px black; margin-right: 6px; }
        .sp-ticket-verified { width: 12px; margin-left: 3px; }
        .sp-ticket-usernum { font-size: 12px; }
      </style>
      <div class="sp-ticket-app" data-sp-ticket>
        <div class="sp-ticket-card">
          <div class="sp-ticket-front">
            <div class="sp-ticket-holo"></div>
            <img class="sp-ticket-logo" src="${SP_LOGO}" alt="Santo Padre Logo" width="270" height="270">
            <aside class="sp-ticket-divider"></aside>
          </div>
          <div class="sp-ticket-back">
            <div class="sp-ticket-holo"></div>
            <img class="sp-ticket-logo" src="${SP_LOGO}" alt="Santo Padre Logo" width="270" height="270">
            <div class="sp-ticket-data">
              <h4>Pase</h4><p>Corporativo</p>
              <h4>Pedido</h4><p>Compra 10 Obtén 12</p>
              <h4>Usuario</h4><p>Tu nombre</p>
              <a class="sp-ticket-qr" href="https://codepen.io/simeydotme" target="_blank">
                <img src="https://assets.codepen.io/13471/simeyqr.svg" alt="QR" width="100" height="100" style="max-width:100%;display:block;">
              </a>
            </div>
            <aside class="sp-ticket-divider">
              <div class="sp-ticket-username">
                <img class="sp-ticket-profile" src="${SP_LOGO}" alt="Perfil SantoPadre" width="24" height="24">
                <span>santopadre.ve</span>
                <img class="sp-ticket-verified" src="https://assets.codepen.io/13471/verified.png" alt="Verificado" width="12" height="12">
              </div>
              <span class="sp-ticket-usernum">422-5540246</span>
            </aside>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Auto-init ticket widgets after render ───
function initPaseTicketWidgets() {
  document.querySelectorAll('[data-sp-ticket]').forEach(app => {
    if (app._spTicketInit) return; // prevent double-init
    app._spTicketInit = true;

    const card = app.querySelector('.sp-ticket-card');
    const state = { r: 0, p: 100, h: 50, o: 0, flip: false, interacting: false, autoRotating: true, autoAngle: 0 };

    const update = () => {
      app.style.setProperty('--r', `${state.r}deg`);
      app.style.setProperty('--p', `${state.p}%`);
      app.style.setProperty('--h', `${state.h}%`);
      app.style.setProperty('--o', state.o);
    };

    let pauseTimer = null;
    const pause = () => { state.interacting = true; state.autoRotating = false; if (pauseTimer) clearTimeout(pauseTimer); };
    const resume = () => {
      state.interacting = false;
      if (pauseTimer) clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => { state.autoAngle = state.r; state.autoRotating = true; }, 3000);
    };

    // Auto-rotate
    const autoRotate = () => {
      if (state.autoRotating && !state.interacting) {
        state.autoAngle += 0.4;
        state.r = state.autoAngle;
        const n = ((state.autoAngle % 360) + 360) % 360;
        state.flip = n > 90 && n < 270;
        const s = Math.sin(state.autoAngle * Math.PI / 180);
        state.o = Math.abs(s) * 0.35;
        state.h = 50 + s * 20;
        state.p = 50 + s * 30;
        update();
      }
      requestAnimationFrame(autoRotate);
    };
    requestAnimationFrame(autoRotate);

    // Hover tilt
    app.addEventListener('mousemove', (e) => {
      pause();
      const rect = card.getBoundingClientRect();
      const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const ny = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      state.r = (state.flip ? 180 : 0) + nx * 30;
      state.p = 50 + nx * 50; state.h = 50 + nx * 25;
      state.o = Math.min(1, Math.sqrt(nx * nx + ny * ny) * 0.6);
      update();
    });

    app.addEventListener('mouseleave', () => {
      state.r = state.flip ? 180 : 0; state.o = 0; state.p = 100; state.h = 50;
      update(); resume();
    });

    // Click flip (don't flip when clicking add-to-cart or links inside)
    card.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      e.stopPropagation(); pause();
      state.flip = !state.flip; state.r = state.flip ? 180 : 0; state.o = 0;
      update(); resume();
    });
  });
}

// Hook into renderProducts to auto-init ticket widgets after DOM update
const _origRenderProducts = renderProducts;
renderProducts = function() {
  _origRenderProducts();
  // Wait for DOM update then initialize ticket widgets
  requestAnimationFrame(() => {
    initPaseTicketWidgets();
    initGiftCardWidget();
  });
};

// ═══════════════════════════════════════════════════════════════════
// GIFT CARD WIDGET — Self-contained Interactive Gift Card
// ═══════════════════════════════════════════════════════════════════
function renderGiftCardWidget(amount) {
  return `
    <div class="thumb gc-widget-container" style="background:var(--ink-2); display:flex; align-items:center; justify-content:center; overflow:visible; position:relative; aspect-ratio: 9/10;">
      <style>
        .gc-app {
            perspective: 1500px;
            --primary-green: #1a4d32;
            --logo-orange: #f26522;
            --logo-green: #1a4d32;
            --bg-cream: #dfb987;
            --bg-cream-light: #e6c7a0;
            --text-dark: #332111;
            --white: #ffffff;
            --glass-bg: rgba(255, 255, 255, 0.1);
            --glass-border: rgba(255, 255, 255, 0.2);
            --h: 50%; --p: 50%; --o: 0.15;
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
        }

        .gc-card {
            width: 200px; /* Scaled down for the grid */
            height: 315px;
            position: relative;
            transform-style: preserve-3d;
            transition: transform 0.5s ease-out;
            cursor: pointer;
            transform: rotateY(var(--r, 0deg));
        }

        .gc-face {
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 20px rgba(0,0,0,0.4);
        }

        .gc-front {
            background: var(--bg-cream);
            display: flex;
            flex-direction: column;
        }

        .gc-header {
            background: var(--white);
            padding: 8px 12px; /* Balanced padding */
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 50px; /* Thinner header to save space */
            position: relative;
            border-bottom: 1px solid rgba(0,0,0,0.05);
            margin-top: 0; /* Ensure it's at the very top */
        }

        .gc-euro-hanger {
            position: absolute;
            top: 4px;
            left: 50%;
            transform: translateX(-50%);
            width: 35px;
            height: 14px;
            z-index: 10;
        }

        .gc-euro-hanger svg {
            width: 100%;
            height: 100%;
            filter: drop-shadow(0 0.5px 0.5px rgba(255,255,255,0.8));
        }

        .gc-euro-hanger svg path {
            fill: var(--ink-2); /* Matches grid background */
            stroke: rgba(0,0,0,0.1);
            stroke-width: 0.5;
        }

        .gc-label {
            color: var(--primary-green);
            font-weight: 900;
            font-size: 12px;
            line-height: 0.9;
            text-transform: uppercase;
            letter-spacing: -0.5px;
        }

        .gc-amount {
            color: var(--primary-green);
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            line-height: 1;
        }

        .gc-amount .gc-value {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: -2px;
            margin-bottom: -3px;
        }

        .gc-amount .gc-currency {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0px;
        }

        .gc-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 5px 10px;
            background: radial-gradient(circle at center, var(--bg-cream-light) 0%, var(--bg-cream) 100%);
        }

        .gc-logo-img {
            width: 55%; /* Slightly smaller to avoid overlap */
            margin-top: 15px; /* More space from the header */
            margin-bottom: 10px;
            filter: drop-shadow(0 8px 12px rgba(0,0,0,0.15));
        }

        .gc-redeem-text {
            color: var(--text-dark);
            text-align: center;
            font-size: 9px;
            font-weight: 700;
            line-height: 1.3;
            max-width: 95%;
            margin-bottom: 5px;
        }

        .gc-icons-footer {
            display: flex;
            justify-content: center;
            gap: 5px;
            margin-top: 8px;
        }

        .gc-icon-img {
            width: 35px;
            height: auto;
            opacity: 0.9;
        }

        .gc-legal {
            padding: 5px;
            text-align: center;
            font-size: 5px;
            color: rgba(255, 255, 255, 0.9);
            background: rgba(0, 0, 0, 0.05);
            width: 100%;
        }

        .gc-back {
            background: var(--white);
            transform: rotateY(180deg);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 15px;
            border: 1px solid rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
        }

        .gc-holo {
            position: absolute; inset: 0;
            pointer-events: none;
            z-index: 1;
            background-image: repeating-linear-gradient(
                -45deg,
                hsl(140, 80%, 40%) 0%,
                hsl(45, 100%, 55%) 6.25%,
                hsl(150, 100%, 35%) 12.5%,
                hsl(80, 100%, 45%) 18.75%,
                hsl(170, 80%, 40%) 25%,
                hsl(38, 100%, 50%) 31.25%,
                hsl(160, 90%, 45%) 37.5%,
                hsl(30, 100%, 50%) 43.75%,
                hsl(140, 80%, 40%) 50%
            );
            background-size: 150% 150%;
            background-position: var(--p) var(--h);
            mask-image: url('assets/logo-sm.webp');
            mask-size: 15% auto;
            mask-repeat: repeat;
            mix-blend-mode: plus-lighter;
            filter: brightness(1.1) contrast(0.8) saturate(2.5);
            opacity: var(--o);
            transition: opacity 0.3s ease;
        }

        .gc-back-content {
            position: relative;
            z-index: 2;
            width: 100%;
            text-align: center;
        }

        .gc-code-container {
            background: rgba(26, 77, 50, 0.05);
            backdrop-filter: blur(5px);
            border: 1px solid rgba(26, 77, 50, 0.1);
            padding: 15px 10px;
            border-radius: 8px;
            margin: 10px 0;
        }

        .gc-code-label {
            color: var(--primary-green);
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            opacity: 0.8;
        }

        .gc-code-value {
            color: var(--primary-green);
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.5px;
            word-break: break-all;
            transition: all 0.5s ease;
        }

        .gc-blurred {
            filter: blur(4px);
            user-select: none;
            opacity: 0.3;
        }

        .gc-instructions {
            color: var(--primary-green);
            font-size: 8px;
            line-height: 1.4;
            opacity: 0.9;
        }

        .gc-copy-btn {
            margin-top: 10px;
            padding: 6px 15px;
            background: var(--primary-green);
            color: var(--white);
            border: none;
            border-radius: 25px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            cursor: pointer;
            transition: all 0.3s;
        }

        .gc-branding-mini {
            position: absolute;
            bottom: 5px;
            width: 60px;
        }

        .gc-branding-mini img { width: 100%; }
      </style>
      
      <div class="gc-app" data-sp-giftcard data-amount="${amount}">
        <div class="gc-card">
          <!-- FRONT SIDE -->
          <div class="gc-face gc-front">
            <div class="gc-header">
              <div class="gc-label">GIFT<br>CARD</div>
              <div class="gc-euro-hanger">
                <svg viewBox="0 0 100 40"><path d="M10,20 Q10,10 20,10 L40,10 Q40,0 50,0 Q60,0 60,10 L80,10 Q90,10 90,20 Q90,30 80,30 L60,30 Q60,40 50,40 Q40,40 40,30 L20,30 Q10,30 10,20 Z" /></svg>
              </div>
              <div class="gc-amount">
                <span class="gc-value">$${amount}</span>
                <span class="gc-currency">USD</span>
              </div>
            </div>
            <div class="gc-main">
              <img src="assets/logo-sm.webp" alt="Logo" class="gc-logo-img" width="270" height="270">
              <p class="gc-redeem-text">Canjea por cualquier producto en SantoPadre®: comida mexicana auténtica y más</p>
              <div class="gc-icons-footer">
                <img src="assets/globo-Photoroom.webp" alt="Icono globo SantoPadre" class="gc-icon-img" width="35" height="35">
                <img src="assets/C-Photoroom.webp" alt="Icono C SantoPadre" class="gc-icon-img" width="35" height="35">
              </div>
            </div>
            <footer class="gc-legal">Válido en todos los locales de SantoPadre® y tienda online. Aplican términos y condiciones.</footer>
          </div>

          <!-- BACK SIDE -->
          <div class="gc-face gc-back">
            <div class="gc-euro-hanger">
              <svg viewBox="0 0 100 40"><path d="M10,20 Q10,10 20,10 L40,10 Q40,0 50,0 Q60,0 60,10 L80,10 Q90,10 90,20 Q90,30 80,30 L60,30 Q60,40 50,40 Q40,40 40,30 L20,30 Q10,30 10,20 Z" /></svg>
            </div>
            <div class="gc-holo"></div>
            <div class="gc-back-content">
              <h2 style="color: var(--primary-green); font-size: 10px; margin-bottom: 5px;">Tarjeta de Regalo Digital</h2>
              <p class="gc-instructions">Usa el código al finalizar tu compra o en los ajustes de tu cuenta para canjear tu saldo.</p>
              <div class="gc-code-container">
                <div class="gc-code-label">CÓDIGO DE CANJE</div>
                <div class="gc-code-value gc-blurred" data-gc-code>SP${amount}-XXXX-XXXX-XXXX</div>
                <button class="gc-copy-btn" data-gc-btn>Revelar Código</button>
              </div>
              <p class="gc-instructions" style="font-size: 7px; opacity: 0.7; margin-top: 5px;">
                Este código es válido para un solo uso. No compartas este código con nadie.
              </p>
            </div>
            <div class="gc-branding-mini"><img src="assets/logo-sm.webp" alt="Logo" width="60" height="60"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initGiftCardWidget() {
  document.querySelectorAll('[data-sp-giftcard]').forEach(app => {
    if (app._gcInit) return;
    app._gcInit = true;

    const card = app.querySelector('.gc-card');
    const codeEl = app.querySelector('[data-gc-code]');
    const btn = app.querySelector('[data-gc-btn]');
    const amount = app.getAttribute('data-amount') || '25';
    
    // Generate code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = `SP${amount}-`;
    for (let i = 0; i < 3; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) segment += chars.charAt(Math.floor(Math.random() * chars.length));
        code += segment + (i < 2 ? '-' : '');
    }
    codeEl.innerText = code;

    const state = { r: 0, p: 50, h: 50, o: 0.15, flip: false, interacting: false, autoRotating: true, autoAngle: 0 };

    const update = () => {
      app.style.setProperty("--r", `${state.r}deg`);
      app.style.setProperty("--p", `${state.p}%`);
      app.style.setProperty("--h", `${state.h}%`);
      app.style.setProperty("--o", state.o);
    };

    const autoRotate = () => {
      if (state.autoRotating && !state.interacting) {
        state.autoAngle += 0.4;
        state.r = state.autoAngle;
        const normalized = ((state.autoAngle % 360) + 360) % 360;
        state.flip = normalized > 90 && normalized < 270;
        const shimmer = Math.sin(state.autoAngle * Math.PI / 180);
        state.o = state.flip ? (0.4 + Math.abs(shimmer) * 0.3) : 0.15;
        state.h = 50 + shimmer * 20;
        state.p = 50 + shimmer * 30;
        update();
      }
      requestAnimationFrame(autoRotate);
    };
    requestAnimationFrame(autoRotate);

    card.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-gc-btn')) return;
      state.autoRotating = false;
      state.interacting = true;
      state.flip = !state.flip;
      state.r = state.flip ? 180 : 0;
      state.autoAngle = state.r;
      update();
      setTimeout(() => { state.interacting = false; state.autoRotating = true; }, 3000);
    });

    app.addEventListener('mousemove', (e) => {
      state.interacting = true; state.autoRotating = false;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      state.p = (x / rect.width) * 100;
      state.h = (y / rect.height) * 100;
      const nx = (x / rect.width) - 0.5;
      state.r = (state.flip ? 180 : 0) + (nx * 25);
      state.o = state.flip ? 0.7 : 0.25;
      update();
    });

    app.addEventListener('mouseleave', () => {
      state.interacting = false;
      state.r = state.flip ? 180 : 0;
      state.autoAngle = state.r;
      state.p = 50; state.h = 50; state.o = state.flip ? 0.4 : 0.15;
      update();
      setTimeout(() => { if (!state.interacting) state.autoRotating = true; }, 1500);
    });

    let revealed = false;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!revealed) {
        codeEl.classList.remove('gc-blurred');
        btn.innerText = 'Copiar';
        revealed = true;
      } else {
        navigator.clipboard.writeText(codeEl.innerText).then(() => {
          const old = btn.innerText;
          btn.innerText = 'COPIADO!';
          btn.style.background = '#2d5a3f';
          setTimeout(() => { btn.innerText = old; btn.style.background = ''; }, 2000);
        });
      }
    });
  });
}

function getStarRating(rating) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;
  let html = '<div class="tp-stars">';
  for (let i = 0; i < 5; i++) {
    let className = 'tp-star-box';
    if (i < fullStars) className += ' full';
    else if (i === fullStars && hasHalf) className += ' half';
    html += `
      <div class="${className}">
        <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="white"/></svg>
      </div>`;
  }
  html += '</div>';
  return html;
}

function renderReviews() {
  const container = document.getElementById('reviews-grid');
  if (!container) return;

  const reviewCards = CATALOG.reviews.map(rev => {
    const product = findProduct(rev.productId);
    return `
      <div class="review-card" style="cursor:pointer" onclick="scrollToProduct('${rev.productId}')">
        ${getStarRating(rev.rating)}
        <p class="quote">"${rev.quote}"</p>
        <div class="review-footer">
          <div class="author-meta">
            <div class="author">
              — ${rev.author}
              <svg class="verify-badge" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.5 12C22.5 17.799 17.799 22.5 12 22.5C6.20101 22.5 1.5 17.799 1.5 12C1.5 6.20101 6.20101 1.5 12 1.5C17.799 1.5 22.5 6.20101 22.5 12Z" fill="#0095F6"/>
                <path d="M10.375 15.125L7.625 12.375L6.625 13.375L10.375 17.125L17.375 10.125L16.375 9.125L10.375 15.125Z" fill="white"/>
              </svg>
            </div>
            <div class="verified-text">Compra verificada</div>
          </div>
          ${product ? `
            <div class="review-product">
              <div class="prod-thumb" style="background-image: url('${product.image || 'assets/menu/flauta-cochinita.avif'}')"></div>
              <div class="prod-info">
                <div class="prod-name">${product.name}</div>
                <div class="prod-tags">
                  ${(product.tags || []).slice(0, 2).map(tag => `<span>${tag}</span>`).join('')}
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Duplicate for seamless loop
  container.innerHTML = `<div class="marquee-wrapper">${reviewCards}${reviewCards}</div>`;
}

// 2. Cart Logic
let pendingItem = null;

function handleAddToCart(productId, catId = '') {
  const item = findProduct(productId);
  if (!item) return;

  if (item.hasVariants || item.hasExtras) {
    openOptionsModal(item, catId);
  } else {
    addToCart(item);
  }
}

function findProduct(id) {
  for (const cat of CATALOG.categories) {
    const product = cat.items.find(p => p.id === id);
    if (product) return product;
  }
  return null;
}

function openOptionsModal(item, catId = '') {
  pendingItem = JSON.parse(JSON.stringify(item)); // Deep copy
  const modal = document.getElementById('variant-modal');
  const overlay = document.getElementById('overlay');
  
  let html = `<h2 style="margin-bottom: 10px;">${item.name}</h2>`;
  
  // Merch products now behave like regular items
  
  if (item.hasVariants) {
    html += `
      <div class="modal-section">
        <h3>Elegir Opción</h3>
        <div class="modal-options">
          ${item.variants.map((v, idx) => `
            <label class="option-row" onclick="selectVariant('${v.id}')">
              <input type="radio" name="variant" id="v-${v.id}" ${idx === 0 ? 'checked' : ''}>
              <div class="name">${v.name} ${v.recommended ? `<span style="color:var(--forest);font-size:10px;">(${v.recommendedLabel})</span>` : ''}</div>
              <div class="price">$${v.price.toFixed(2)}</div>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    // Select first by default
    pendingItem.selectedVariant = item.variants[0];
  }

  if (item.hasExtras && CATALOG.extras) {
    html += `
      <div class="modal-section">
        <h3>Añadir Extras (+$${CATALOG.extras.individual.price.toFixed(2)} c/u)</h3>
        <div class="modal-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${CATALOG.extras.individual.options.map(opt => `
            <label class="option-row" style="padding: 10px; gap: 10px;">
              <input type="checkbox" onchange="toggleExtra('${opt}')">
              <span class="name" style="font-size:13px; line-height: 1.2;">${opt}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    pendingItem.selectedExtras = [];
  }
  
  html += `
    <div style="display: flex; gap: 10px; margin-top: 30px;">
      <button class="btn primary" style="flex: 1; justify-content: center; padding: 15px;" onclick="confirmOptions()"><span>Aceptar</span></button>
      <button class="btn" style="flex: 1; justify-content: center; padding: 15px; border-color: var(--line);" onclick="closeAll()"><span>Cancelar</span></button>
    </div>
  `;
  
  modal.innerHTML = html;
  modal.classList.add('open');
  overlay.classList.add('active');
}

function selectVariant(variantId) {
  const variant = pendingItem.variants.find(v => v.id === variantId);
  pendingItem.selectedVariant = variant;
}

function toggleExtra(extraName) {
  const index = pendingItem.selectedExtras.indexOf(extraName);
  if (index > -1) {
    pendingItem.selectedExtras.splice(index, 1);
  } else {
    pendingItem.selectedExtras.push(extraName);
  }
}

function confirmOptions() {
  const finalItem = {
    ...pendingItem,
    uniqueId: `${pendingItem.id}-${pendingItem.selectedVariant?.id || 'base'}-${(pendingItem.selectedExtras || []).join('-')}`
  };
  document.getElementById('variant-modal').classList.remove('open');
  addToCart(finalItem);
}

function addToCart(item) {
  const uniqueId = item.uniqueId || item.id;
  const existing = cart.find(i => (i.uniqueId || i.id) === uniqueId);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...item, qty: 1 });
  }

  updateCartUI();
  
  // 📊 TRACKING ESPÍA: Disparar evento de Agregar al Carrito
  try {
    const itemName = item.variantName ? `${item.name} (${item.variantName})` : item.name;
    const itemPrice = item.price || 0;
    
    // Google Analytics 4 Event
    if (typeof gtag === 'function') {
      gtag('event', 'add_to_cart', {
        currency: 'USD',
        value: itemPrice,
        items: [{ item_id: uniqueId, item_name: itemName, price: itemPrice, quantity: 1 }]
      });
    }
    // Meta Pixel Event
    if (typeof fbq === 'function') {
      fbq('track', 'AddToCart', {
        content_name: itemName,
        content_ids: [uniqueId],
        content_type: 'product',
        value: itemPrice,
        currency: 'USD'
      });
    }
  } catch (e) { console.warn("Tracking block error:", e); }

  // Open cart automatically when an item is added
  document.getElementById('cart-panel').classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

function removeFromCart(uniqueId) {
  const index = cart.findIndex(i => (i.uniqueId || i.id) === uniqueId);
  if (index > -1) {
    if (cart[index].qty > 1) {
      cart[index].qty--;
    } else {
      cart.splice(index, 1);
    }
  }
  updateCartUI();
}

function updateCartUI() {
  localStorage.setItem('santopadre_checkout', JSON.stringify({
    items: cart,
    isVip: document.getElementById('vip-check')?.checked || false
  }));

  const itemsContainer = document.getElementById('cart-items');
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  const headerCount = document.getElementById('header-cart-count');
  const rewardsContainer = document.getElementById('cart-rewards');
  const upsellContainer = document.getElementById('upsell-grid');

  let subtotal = 0;
  let count = 0;
  let runningSubtotal = 0;
  let discountedItemUid = null;
  let bonusDiscount = 0;

  // Identify the first item that pushed us over $60 or items added after
  // We'll apply it to the FIRST item added AFTER reaching $60
  cart.forEach((item, index) => {
    const basePrice = item.selectedVariant ? item.selectedVariant.price : item.price;
    const extrasPrice = (item.selectedExtras ? item.selectedExtras.length : 0) * (CATALOG.extras?.individual?.price || 0.90);
    const unitPrice = basePrice + extrasPrice;
    
    // Logic: if subtotal BEFORE this item was >= 60, this is a bonus item
    if (runningSubtotal >= 60 && !discountedItemUid) {
      discountedItemUid = item.uniqueId || item.id;
      bonusDiscount = unitPrice * 0.15; // 15% off ONE unit
    }
    
    runningSubtotal += unitPrice * item.qty;
    subtotal += unitPrice * item.qty;
    count += item.qty;
  });

  itemsContainer.innerHTML = cart.map(item => {
    const basePrice = item.selectedVariant ? item.selectedVariant.price : item.price;
    const extrasPrice = (item.selectedExtras ? item.selectedExtras.length : 0) * (CATALOG.extras?.individual?.price || 0.90);
    const unitPrice = basePrice + extrasPrice;
    const isDiscounted = (item.uniqueId || item.id) === discountedItemUid;
    const itemTotal = (unitPrice * item.qty) - (isDiscounted ? bonusDiscount : 0);

    // Display logic for protein/variant
    let displayVariant = null;
    if (item.selectedVariant) {
      displayVariant = item.selectedVariant.name;
    } else if (item.id.startsWith('tacos-')) {
      // Fallback for Tacos: Extract flavor from name
      const flavor = item.name.split(' (')[0].replace('Tacos ', '').replace('de ', '');
      displayVariant = `Proteína: ${flavor}`;
    } else if (item.id.startsWith('flauta-')) {
       const flavor = item.name.split(' (')[0].replace('Flauta ', '').replace('de ', '');
       displayVariant = `Sabor: ${flavor}`;
    }

    return `
      <div class="cart-item ${isDiscounted ? 'bonus-applied' : ''}">
        <img src="${item.image || 'assets/menu/flauta-cochinita.avif'}" alt="${item.name}">
        <div class="item-info">
          <h4>${item.name} ${isDiscounted ? '<span class="bonus-tag">-15% BONUS</span>' : ''}</h4>
          
          <div class="item-selection">
            ${displayVariant ? `<div class="sel-variant">• ${displayVariant}</div>` : ''}
            ${item.selectedExtras && item.selectedExtras.length > 0 ? `
              <div class="sel-extras"><strong>Extras:</strong> ${item.selectedExtras.join(', ')}</div>
            ` : ''}
          </div>

          <div class="item-price">
            ${isDiscounted ? `<span class="old-price">$${unitPrice.toFixed(2)}</span> ` : ''}
            $${unitPrice.toFixed(2)}
          </div>
          <div class="qty-controls">
            <button class="qty-btn" onclick="modifyQty('${item.uniqueId || item.id}', -1)">-</button>
            <span class="item-qty">${item.qty}</span>
            <button class="qty-btn" onclick="modifyQty('${item.uniqueId || item.id}', 1)">+</button>
            <button class="remove-item" onclick="deleteFromCart('${item.uniqueId || item.id}')" style="margin-left:auto">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div style="text-align:center; padding: 40px 0;">
        <p style="color:var(--mute); margin-bottom: 20px;">Tu carrito está vacío.</p>
        <button class="btn" onclick="toggleCart()"><span>Seguir Comprando</span></button>
      </div>
    `;
  }

  // Rewards Bar Logic
  const goal1 = 60;
  let remaining, percent, message;

  if (subtotal < goal1) {
    remaining = goal1 - subtotal;
    percent = (subtotal / goal1) * 75; // More visual weight to the first goal
    message = `Estás a <span>$${remaining.toFixed(2)}</span> del envío GRATIS`;
  } else if (!discountedItemUid) {
    percent = 85;
    message = `¡ENVÍO GRATIS! 🚚 <span>Agrega un plato más</span> con 15% DTO`;
  } else {
    percent = 100;
    message = `¡RECOMPENSAS ACTIVAS! 🔓 Envío Gratis + Bonus 15%`;
  }
  
  rewardsContainer.innerHTML = `
    <div class="reward-text ${subtotal >= goal1 ? 'unlocked' : ''}">${message}</div>
    <div class="progress-bg">
      <div class="progress-fill ${subtotal >= goal1 ? 'unlocked' : ''}" style="width: ${percent}%"></div>
    </div>
  `;

  // Upsells Logic
  if (upsellContainer) {
    upsellContainer.innerHTML = (CATALOG.upsellProducts || []).map(p => `
      <div class="upsell-card">
        <img src="${p.image || 'assets/menu/coca-cola.avif'}" alt="${p.label}">
        <div class="upsell-item-label">${p.label}</div>
        <button onclick="handleAddToCart('${p.id}')">+$${p.price.toFixed(2)}</button>
      </div>
    `).join('');
  }

  // Totals Calculation
  let total = subtotal - bonusDiscount;
  let discountLabel = bonusDiscount > 0 ? " (Bonus applied)" : "";
  
  const isVip = document.getElementById('vip-check')?.checked;
  if (isVip) {
    total = total * 0.9; // 10% VIP Discount on top or instead?
    discountLabel += " (10% VIP)";
  }

  if (subtotalEl) {
    subtotalEl.innerText = `$${subtotal.toFixed(2)}`;
  }
  totalEl.innerText = `$${total.toFixed(2)}${discountLabel}`;
  
  if (headerCount) {
    headerCount.innerText = count;
    headerCount.classList.toggle('active', count > 0);
  }
}

function modifyQty(uniqueId, delta) {
  const item = cart.find(i => (i.uniqueId || i.id) === uniqueId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) deleteFromCart(uniqueId);
    else updateCartUI();
  }
}

function deleteFromCart(uniqueId) {
  cart = cart.filter(i => (i.uniqueId || i.id) !== uniqueId);
  updateCartUI();
}

function toggleCart() {
  document.getElementById('cart-panel').classList.toggle('active');
  document.getElementById('overlay').classList.toggle('active');
}


function closeAll() {
  document.getElementById('cart-panel').classList.remove('active');
  document.getElementById('variant-modal').classList.remove('open');
  document.getElementById('mobile-menu').classList.remove('active');
  document.getElementById('overlay').classList.remove('active');
}

function toggleMenu() {
  document.getElementById('mobile-menu').classList.toggle('active');
  document.getElementById('overlay').classList.toggle('active');
}

function scrollToSection(id) {
  closeAll();
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Add event listeners for new cart elements
document.addEventListener('DOMContentLoaded', () => {
  const vipCheck = document.getElementById('vip-check');
  if (vipCheck) vipCheck.addEventListener('change', updateCartUI);

  const applyBtn = document.getElementById('apply-discount');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const code = document.getElementById('discount-code').value;
      if (code) alert("Código no válido en este momento.");
    });
  }

  const closeBtn = document.getElementById('close-cart');
  if (closeBtn) closeBtn.addEventListener('click', toggleCart);
  
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', goToCheckout);
});

function goToCheckout() {
  if (cart.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }
  
  // 📊 TRACKING ESPÍA: Disparar evento de Iniciar Checkout
  try {
    const totalValue = parseFloat(document.getElementById('cart-total').innerText.replace('$', '')) || 0;
    
    // Google Analytics 4 Event
    if (typeof gtag === 'function') {
      gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: totalValue,
        items: cart.map(item => ({ item_id: item.uniqueId || item.id, item_name: item.name, quantity: item.qty }))
      });
    }
    // Meta Pixel Event
    if (typeof fbq === 'function') {
      fbq('track', 'InitiateCheckout', {
        value: totalValue,
        currency: 'USD',
        num_items: cart.length
      });
    }
  } catch (e) { console.warn("Tracking block error:", e); }

  // Guardar carrito y estado VIP para el checkout
  const checkoutData = {
    items: cart,
    isVip: document.getElementById('vip-check')?.checked || false
  };
  localStorage.setItem('santopadre_checkout', JSON.stringify(checkoutData));
  window.location.href = 'checkout.html';
}

// Update sendToWhatsApp to include VIP status
function sendToWhatsApp() {
  if (cart.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }

  const isVip = document.getElementById('vip-check')?.checked;
  let subtotal = 0;
  let message = `¡Hola SantoPadre! ⛪\n\n🧾 *ORDEN DE PEDIDO:*\n`;

  cart.forEach(item => {
    const basePrice = item.selectedVariant ? item.selectedVariant.price : item.price;
    const extrasPrice = (item.selectedExtras ? item.selectedExtras.length : 0) * (CATALOG.extras?.individual?.price || 0.90);
    const unitPrice = basePrice + extrasPrice;
    const itemTotal = unitPrice * item.qty;
    subtotal += itemTotal;

    message += `▪️ ${item.qty}x ${item.name}\n`;
    if (item.selectedVariant) message += `   ↳ _${item.selectedVariant.name}_\n`;
    if (item.selectedExtras?.length > 0) message += `   ↳ _Extras: ${item.selectedExtras.join(', ')}_\n`;
  });

  let total = subtotal;
  if (isVip) {
    total = subtotal * 0.9;
    message += `\n🌟 *SUSCRIPCIÓN VIP ACTIVA* (-10%)\n`;
  }

  message += `\n💰 *Subtotal:* $${subtotal.toFixed(2)}`;
  if (subtotal >= 60) message += `\n🚚 *Envío:* GRATIS (Promo unlocked)`;
  message += `\n💵 *TOTAL:* $${total.toFixed(2)}\n\n`;
  message += `¡Bendiciones! 🙏`;

  window.open(`https://wa.me/${CATALOG.info.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
}
