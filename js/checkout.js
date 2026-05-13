// checkout.js — SantoPadre® Checkout Logic
document.addEventListener('DOMContentLoaded', () => {
  const checkoutData = JSON.parse(localStorage.getItem('santopadre_checkout'));
  
  if (!checkoutData || !checkoutData.items || checkoutData.items.length === 0) {
    window.location.href = 'index.html';
    return;
  }

  renderSummary(checkoutData);
  initOrderTypeToggle();
  initCartExtras(checkoutData);
  initFormHandler(checkoutData);
  renderCheckoutReviews();
});

function getStarRating(rating) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  
  let html = '<div class="tp-stars">';
  const svgStar = `<svg viewBox="0 0 24 24" fill="white"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
  
  for(let i=0; i<fullStars; i++) html += `<div class="tp-star-box full">${svgStar}</div>`;
  if(hasHalf) html += `<div class="tp-star-box half">${svgStar}</div>`;
  for(let i=0; i<emptyStars; i++) html += `<div class="tp-star-box">${svgStar}</div>`;
  
  html += '</div>';
  return html;
}

function renderCheckoutReviews() {
  const container = document.getElementById('checkout-reviews');
  if (!container || typeof CATALOG === 'undefined' || !CATALOG.reviews || CATALOG.reviews.length === 0) return;

  const reviews = CATALOG.reviews;
  let currentIndex = 0;
  
  container.innerHTML = `
    <style>
    .zelle-details, .pm-details { display: none; margin-top: 10px; width: 100%; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; }
    input[value="zelle"]:checked ~ .card-content .zelle-details { display: block; }
    input[value="pago-movil"]:checked ~ .card-content .pm-details { display: block; }
    .payment-card input:checked ~ .card-content { border-color: #ff6b00; background: rgba(255, 107, 0, 0.1); }
    </style>
    <h3 style="margin-top: 40px; margin-bottom: 20px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--bone);">Lo que dicen de nosotros</h3>
    <div id="checkout-review-content" style="transition: opacity 0.3s ease;">
    </div>
  `;

  const contentDiv = document.getElementById('checkout-review-content');

  function showReview(index) {
    const rev = reviews[index];
    contentDiv.style.opacity = 0;
    
    setTimeout(() => {
      contentDiv.innerHTML = `
        <div class="review-card-checkout">
          ${getStarRating(rev.rating)}
          <p class="quote">"${rev.quote}"</p>
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
        </div>
      `;
      contentDiv.style.opacity = 1;
    }, 300);
  }

  showReview(currentIndex);

  setInterval(() => {
    currentIndex = (currentIndex + 1) % reviews.length;
    showReview(currentIndex);
  }, 4000);
}

function renderSummary(data) {
  const container = document.getElementById('summary-items');
  const subtotalEl = document.getElementById('summary-subtotal');
  const totalEl = document.getElementById('summary-total');
  const vipRow = document.getElementById('vip-row');
  const vipEl = document.getElementById('summary-vip');
  const bonusRow = document.getElementById('bonus-row');
  const bonusEl = document.getElementById('summary-bonus');

  let subtotal = 0;
  let bonusDiscount = 0;
  let discountedItemUid = null;
  let runningSubtotal = 0;

  container.innerHTML = data.items.map(item => {
    const basePrice = item.selectedVariant ? item.selectedVariant.price : item.price;
    const extrasPrice = (item.selectedExtras ? item.selectedExtras.length : 0) * 0.90; // Fallback price
    const unitPrice = basePrice + extrasPrice;
    
    // Logic for bonus (same as app.js)
    if (runningSubtotal >= 60 && !discountedItemUid) {
      discountedItemUid = item.uniqueId || item.id;
      bonusDiscount = unitPrice * 0.15;
    }

    runningSubtotal += unitPrice * item.qty;
    subtotal += unitPrice * item.qty;

    let displayVariant = null;
    if (item.selectedVariant) {
      displayVariant = item.selectedVariant.name;
    } else if (item.id.startsWith('tacos-')) {
      const flavor = item.name.split(' (')[0].replace('Tacos ', '').replace('de ', '');
      displayVariant = `Proteína: ${flavor}`;
    } else if (item.id.startsWith('flauta-')) {
       const flavor = item.name.split(' (')[0].replace('Flauta ', '').replace('de ', '');
       displayVariant = `Sabor: ${flavor}`;
    }

    const isDiscounted = (item.uniqueId || item.id) === discountedItemUid;
    const finalItemPrice = (unitPrice * item.qty) - (isDiscounted ? bonusDiscount : 0);

    return `
      <div class="summary-item cart-item ${isDiscounted ? 'bonus-applied' : ''}">
        <img src="${item.image || 'https://i.ibb.co/mrnbBWpw/IMG-7618.avif'}" alt="${item.name}">
        <div class="item-info">
          <h4>${item.name} ${isDiscounted ? '<span class="bonus-tag">-15% BONUS</span>' : ''}</h4>
          
          <div class="item-selection">
            ${displayVariant ? `<div class="sel-variant">• ${displayVariant}</div>` : ''}
            ${item.selectedExtras && item.selectedExtras.length > 0 ? `
              <div class="sel-extras"><strong>Extras:</strong> ${item.selectedExtras.join(', ')}</div>
            ` : ''}
          </div>

          <div class="item-price">
            ${isDiscounted ? `<span class="old-price">$${(unitPrice * item.qty).toFixed(2)}</span> ` : ''}
            $${finalItemPrice.toFixed(2)}
          </div>
          <div class="qty-controls">
            <span class="item-qty">Cant: ${item.qty}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (data.items.length > 3) {
    container.classList.add('collapsed');
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mobile-summary-toggle';
    toggleBtn.innerText = 'Ver todo el pedido ▼';
    toggleBtn.type = 'button';
    toggleBtn.onclick = () => {
      container.classList.toggle('collapsed');
      if (container.classList.contains('collapsed')) {
        toggleBtn.innerText = 'Ver todo el pedido ▼';
      } else {
        toggleBtn.innerText = 'Resumir pedido ▲';
      }
    };
    // Append it after container, inside the summary block
    container.parentNode.insertBefore(toggleBtn, container.nextSibling);
  }

  let total = subtotal - bonusDiscount;

  if (bonusDiscount > 0) {
    bonusRow.style.display = 'flex';
    bonusEl.innerText = `-$${bonusDiscount.toFixed(2)}`;
  }

  if (data.isVip) {
    const vipDiscount = total * 0.1;
    total -= vipDiscount;
    vipRow.style.display = 'flex';
    vipEl.innerText = `-$${vipDiscount.toFixed(2)}`;
  }

  subtotalEl.innerText = `$${subtotal.toFixed(2)}`;
  totalEl.innerText = `$${total.toFixed(2)}`;
}

function initOrderTypeToggle() {
  const radios = document.querySelectorAll('input[name="orderType"]');
  const addressField = document.getElementById('address-field');

  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'delivery') {
        addressField.style.display = 'block';
        document.getElementById('address1').required = true;
      } else {
        addressField.style.display = 'none';
        document.getElementById('address1').required = false;
      }
    });
  });
}

function initFormHandler(checkoutData) {
  const form = document.getElementById('checkout-form');
  const googleBtn = document.getElementById('google-autofill');

  // Helper para decodificar el JWT que devuelve Google
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch(e) {
      return {};
    }
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      if (typeof google === 'undefined' || !google.accounts) {
        alert("La conexión con Google aún está cargando o fue bloqueada. Inténtalo de nuevo.");
        return;
      }

      // TODO: Reemplazar con tu Client ID real de Google Cloud Console
      const GOOGLE_CLIENT_ID = "878959693718-7n1jfp5urh5o1u6rvu8shjlldqne0jdu.apps.googleusercontent.com";

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          const data = parseJwt(response.credential);
          
          if (data.name) document.getElementById('name').value = data.name;
          if (data.email) document.getElementById('email').value = data.email;
          
          // Feedback visual de éxito
          const originalHtml = googleBtn.innerHTML;
          googleBtn.innerHTML = "✓ Datos Autorrellenados";
          googleBtn.style.background = "#34A853"; 
          googleBtn.style.color = "#ffffff";
          googleBtn.style.borderColor = "#34A853";
          
          setTimeout(() => {
            googleBtn.innerHTML = originalHtml;
            googleBtn.style.background = "var(--ink)";
            googleBtn.style.color = "#ffffff";
            googleBtn.style.borderColor = "var(--line)";
          }, 3000);
        }
      });
      
      // Mostrar el prompt de Google (One Tap o Pop-up)
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.warn("Google Sign-In prompt no se mostró. Esto es normal si no se ha configurado un Client ID real.");
        }
      });
    });
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const orderDetails = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      orderType: formData.get('orderType'),
      address1: formData.get('address1'),
      address2: formData.get('address2'),
      reference: formData.get('reference'),
      payment: formData.get('payment'),
      items: checkoutData.items,
      isVip: checkoutData.isVip
    };

    if (orderDetails.payment === 'phantom') {
      const totalAmountStr = document.getElementById('summary-total').innerText.replace('$', '');
      const totalAmount = parseFloat(totalAmountStr);
      
      const submitBtn = document.querySelector('.checkout-submit span');
      const originalText = submitBtn.innerText;
      submitBtn.innerText = "Conectando con Phantom...";
      
      try {
        const txHash = await processPhantomPayment(totalAmount);
        orderDetails.txHash = txHash;
        await syncToSheets(orderDetails);
        sendToWhatsApp(orderDetails);
      } catch (error) {
        console.error(error);
        alert(error.message);
      } finally {
        submitBtn.innerText = originalText;
      }
    } else {
      await syncToSheets(orderDetails);
      sendToWhatsApp(orderDetails);
    }
  });
}

async function syncToSheets(order) {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbynJa91G-xQCCZ_Kh1yquB9ctvLMnxx_C7TnORcCASQa8tIJ8fWcUa7OYerZnJwWYNp/exec";
  if (SCRIPT_URL.includes("TU_GOOGLE_SCRIPT_URL")) {
    console.warn("Google Sheets Script URL no configurada.");
    return;
  }

  const itemsDetail = order.items.map(i => `${i.qty}x ${i.name}`).join(', ');
  const total = document.getElementById('summary-total').innerText;

  const data = {
    type: "Pedido Web",
    name: order.name,
    email: order.email,
    phone: order.phone,
    details: itemsDetail,
    total: total,
    payment: order.payment.toUpperCase() + (order.txHash ? ` (${order.txHash.slice(0,8)}...)` : '')
  };

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(data)
    });
  } catch (err) {
    console.error("Error syncing to sheets:", err);
  }
}

function sendToWhatsApp(order) {
  // 📊 TRACKING ESPÍA: Disparar evento de Compra (Purchase)
  try {
    let trackingTotal = 0;
    order.items.forEach(i => trackingTotal += (i.price * i.qty));
    
    // Google Analytics 4 Event
    if (typeof gtag === 'function') {
      gtag('event', 'purchase', {
        transaction_id: 'SP-' + Date.now(),
        currency: 'USD',
        value: trackingTotal,
        items: order.items.map(item => ({ item_id: item.uniqueId || item.id, item_name: item.name, price: item.price, quantity: item.qty }))
      });
    }
    // Meta Pixel Event
    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', {
        value: trackingTotal,
        currency: 'USD',
        content_type: 'product',
        contents: order.items.map(item => ({ id: item.uniqueId || item.id, quantity: item.qty }))
      });
    }
  } catch (e) { console.warn("Tracking block error:", e); }

  let subtotal = 0;
  let bonusDiscount = 0;
  let discountedItemUid = null;
  let runningSubtotal = 0;

  let message = `¡Hola SantoPadre! ⛪\n\n*NUEVO PEDIDO WEB*\n\n`;
  message += `👤 *Cliente:* ${order.name}\n`;
  message += `📧 *Email:* ${order.email}\n`;
  message += `📞 *Teléfono:* ${order.phone}\n`;
  message += `📍 *Tipo:* ${order.orderType.toUpperCase()}\n`;
  if (order.orderType === 'delivery' && order.address1) {
    message += `🏠 *Dirección:* ${order.address1}\n`;
    if (order.address2) message += `   ↳ _Apto/Casa:_ ${order.address2}\n`;
    if (order.reference) message += `   ↳ _Ref:_ ${order.reference}\n`;
  }
  
  if (order.payment === 'phantom' && order.txHash) {
    message += `💳 *Pago:* PHANTOM (Web3)\n`;
    message += `🔗 *Tx Hash:* ${order.txHash}\n\n`;
  } else {
    message += `💳 *Pago:* ${order.payment.toUpperCase()}\n\n`;
  }

  message += `🧾 *DETALLE:* \n`;
  order.items.forEach(item => {
    const basePrice = item.selectedVariant ? item.selectedVariant.price : item.price;
    const extrasPrice = (item.selectedExtras ? item.selectedExtras.length : 0) * 0.90;
    const unitPrice = basePrice + extrasPrice;

    if (runningSubtotal >= 60 && !discountedItemUid) {
      discountedItemUid = item.uniqueId || item.id;
      bonusDiscount = unitPrice * 0.15;
    }

    runningSubtotal += unitPrice * item.qty;
    subtotal += unitPrice * item.qty;

    message += `▪️ ${item.qty}x ${item.name}\n`;
    if (item.selectedVariant) message += `   ↳ _${item.selectedVariant.name}_\n`;
    if (item.selectedExtras?.length > 0) message += `   ↳ _Extras: ${item.selectedExtras.join(', ')}_\n`;
  });

  let total = subtotal - bonusDiscount;
  if (order.isVip) {
    const vipDiscount = total * 0.1;
    total -= vipDiscount;
    message += `\n🌟 *VIP:* -10% aplicado`;
  }
  if (bonusDiscount > 0) message += `\n🎁 *Bonus:* -$${bonusDiscount.toFixed(2)} aplicado`;

  message += `\n\n💰 *Subtotal:* $${subtotal.toFixed(2)}`;
  message += `\n💵 *TOTAL BCV:* $${total.toFixed(2)}\n\n`;
  message += `¡Bendiciones! 🙏`;

  // Use the phone number from catalog if available
  const whatsappNum = (typeof CATALOG !== 'undefined' && CATALOG.info) ? CATALOG.info.whatsapp : "584120000000";
  window.open(`https://wa.me/${whatsappNum}?text=${encodeURIComponent(message)}`, '_blank');
  
  // Optional: Clear cart after successful order
  // localStorage.removeItem('santopadre_checkout');
}

function initCartExtras(checkoutData) {
  const applyBtn = document.getElementById('apply-discount');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const code = document.getElementById('discount-code').value;
      if (code) alert("Código no válido en este momento.");
    });
  }

  const giftBtns = document.querySelectorAll('.btn-gift');
  giftBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const amount = parseInt(e.target.dataset.amount);
      const btnEl = e.target;
      
      const existingIndex = checkoutData.items.findIndex(i => i.id === `gift-card-${amount}`);
      
      if (existingIndex > -1) {
        // Remover
        checkoutData.items.splice(existingIndex, 1);
        localStorage.setItem('santopadre_checkout', JSON.stringify(checkoutData));
        renderSummary(checkoutData);

        const originalText = btnEl.dataset.originalText || btnEl.innerText;
        btnEl.dataset.originalText = originalText;
        btnEl.innerText = "× Quitada";
        btnEl.style.color = "var(--accent)";
        btnEl.style.borderColor = "var(--accent)";
        
        setTimeout(() => {
          btnEl.innerText = originalText;
          btnEl.style.color = "";
          btnEl.style.borderColor = "";
        }, 2000);

      } else {
        // Añadir
        const giftItem = {
          id: `gift-card-${amount}`,
          name: `Gift Card $${amount}`,
          price: amount,
          qty: 1,
          image: 'https://i.ibb.co/mrnbBWpw/IMG-7618.avif'
        };
        checkoutData.items.push(giftItem);
        localStorage.setItem('santopadre_checkout', JSON.stringify(checkoutData));
        renderSummary(checkoutData);
        
        const originalText = btnEl.dataset.originalText || btnEl.innerText;
        btnEl.dataset.originalText = originalText;
        btnEl.innerText = "✓ Añadida";
        btnEl.style.color = "#34A853";
        btnEl.style.borderColor = "#34A853";
        
        setTimeout(() => {
          btnEl.innerText = originalText;
          btnEl.style.color = "";
          btnEl.style.borderColor = "";
        }, 2000);
      }
    });
  });
}

// Phantom Payment Logic
async function processPhantomPayment(usdAmount) {
  const provider = window.phantom?.solana;

  if (!provider?.isPhantom) {
    throw new Error("Phantom wallet no encontrada. Por favor, instala la extensión de Phantom en tu navegador.");
  }

  // TODO: Reemplaza esto con tu Wallet real de Solana
  const RECEIVER_WALLET = "7pHnSvY3ki2SZ9YgXUt2ZxeS2F3cS5j2qNwgdHTQLFk3"; // SantoPadre Wallet

  await provider.connect();
  const payerKey = provider.publicKey;

  const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');
  
  // Conversión DEMO: Asumimos que 1 SOL = $150 USD (Debes integrar un API de precios real)
  const solPrice = 150; 
  const solAmount = usdAmount / solPrice;
  const lamports = Math.round(solAmount * solanaWeb3.LAMPORTS_PER_SOL);

  const transaction = new solanaWeb3.Transaction().add(
    solanaWeb3.SystemProgram.transfer({
      fromPubkey: payerKey,
      toPubkey: new solanaWeb3.PublicKey(RECEIVER_WALLET),
      lamports: lamports,
    })
  );

  transaction.feePayer = payerKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  const { signature } = await provider.signAndSendTransaction(transaction);
  await connection.confirmTransaction(signature);
  
  return signature;
}
