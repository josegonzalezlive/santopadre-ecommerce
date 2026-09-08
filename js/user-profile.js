// user-profile.js — SantoPadre® Profile & Loyalty Engine
import { getActiveServices } from "./firebase-config.js";

// Variables globales del módulo
let authService, dbService, functionsService, googleProvider, isMock;
let currentUser = null;
let currentProfile = null;
let pendingWishProductId = null;
let redirectToRewardsAfterLogin = false;

// --- CONTADOR DE ACTIVIDAD SIMULADO PARA EL BADGE DE WISHLIST ---
// No hay backend que cuente guardados agregados de todos los visitantes; este
// numero es prueba social simulada (rango fijo 3-30, nunca 0) para que el
// badge del corazon del header nunca se vea vacio. Se persiste en localStorage
// para que no cambie bruscamente entre recargas, y se mueve un poco cada
// cierto tiempo para dar sensacion de actividad en vivo.
const WISHLIST_ACTIVITY_KEY = 'santopadre_wishlist_activity';
const WISHLIST_ACTIVITY_MIN = 3;
const WISHLIST_ACTIVITY_MAX = 30;

function readWishlistActivity() {
  try {
    const raw = localStorage.getItem(WISHLIST_ACTIVITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.count === 'number' && typeof parsed.updatedAt === 'number') {
        return parsed;
      }
    }
  } catch (e) { /* localStorage no disponible o dato corrupto: se regenera abajo */ }
  const initial = {
    count: Math.floor(Math.random() * (WISHLIST_ACTIVITY_MAX - WISHLIST_ACTIVITY_MIN + 1)) + WISHLIST_ACTIVITY_MIN,
    updatedAt: Date.now()
  };
  writeWishlistActivity(initial);
  return initial;
}

function writeWishlistActivity(state) {
  try {
    localStorage.setItem(WISHLIST_ACTIVITY_KEY, JSON.stringify(state));
  } catch (e) { /* modo privado / storage lleno: seguimos solo en memoria */ }
}

// Da un pequeño empujon aleatorio (+/-1 o +/-2) sin salir nunca del rango 3-30.
function nudgeWishlistActivity() {
  const state = readWishlistActivity();
  const delta = Math.floor(Math.random() * 5) - 2; // -2..+2
  const next = Math.min(WISHLIST_ACTIVITY_MAX, Math.max(WISHLIST_ACTIVITY_MIN, state.count + delta));
  const updated = { count: next, updatedAt: Date.now() };
  writeWishlistActivity(updated);
  return updated;
}

function getWishlistActivityCount() {
  const state = readWishlistActivity();
  // Si pasaron mas de 20s desde el ultimo cambio, movemos el numero para que
  // se sienta "en vivo" en vez de fijo.
  if (Date.now() - state.updatedAt > 20000) {
    return nudgeWishlistActivity().count;
  }
  return state.count;
}

// Inicialización de servicios
const services = getActiveServices();
authService = services.auth;
dbService = services.db;
functionsService = services.functions;
googleProvider = services.googleProvider;
isMock = services.isMock;

// Imports dinámicos para Firebase real
let doc, getDoc, setDoc, collection, addDoc, query, where, orderBy, getDocs, onSnapshot, httpsCallable;
if (!isMock) {
  try {
    const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const functionsModule = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js");
    doc = firestoreModule.doc;
    getDoc = firestoreModule.getDoc;
    setDoc = firestoreModule.setDoc;
    collection = firestoreModule.collection;
    addDoc = firestoreModule.addDoc;
    query = firestoreModule.query;
    where = firestoreModule.where;
    orderBy = firestoreModule.orderBy;
    getDocs = firestoreModule.getDocs;
    onSnapshot = firestoreModule.onSnapshot;
    httpsCallable = functionsModule.httpsCallable;
  } catch (err) {
    console.error("Error cargando módulos de Firestore, forzando modo simulación:", err);
    isMock = true;
  }
}

async function callFunction(name, payload = {}) {
  if (!functionsService || !httpsCallable) {
    throw new Error("Cloud Functions no esta inicializado.");
  }
  const fn = httpsCallable(functionsService, name);
  const result = await fn(payload);
  return result.data;
}

// Inicialización de la UI y listeners
// Conteo REAL de "guardados en wishlist" por producto (functions/wishlistStats.js
// mantiene productStats/{productId}.wishlistCount via un trigger de Firestore cada vez
// que cambia users/{uid}.wishlist). Lectura publica por regla, asi que funciona incluso
// sin sesion iniciada. onSnapshot la mantiene en vivo: si otro visitante guarda o quita
// el mismo producto ahora mismo, el badge en pantalla se actualiza solo, sin recargar.
// window.wishlistSavesRealCounts es el piso de verdad; js/app.js decide ahi mismo si
// usar el numero real o el ficticio de respaldo (ver getWishlistSavesCount en app.js).
window.wishlistSavesRealCounts = {};

function listenToProductStats() {
  if (isMock || !collection || !onSnapshot) return;
  try {
    onSnapshot(collection(dbService, 'productStats'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          delete window.wishlistSavesRealCounts[change.doc.id];
        } else {
          window.wishlistSavesRealCounts[change.doc.id] = change.doc.data().wishlistCount;
        }
      });
      if (window.refreshWishlistSavesBadges) window.refreshWishlistSavesBadges();
    }, (err) => {
      console.error("Error escuchando productStats:", err);
    });
  } catch (err) {
    console.error("Error iniciando listener de productStats:", err);
  }
}

function init() {
  setupProfileButton();
  listenToAuthChanges();
  listenToProductStats();

  // Refresca el badge del corazon cada 20s para que la actividad simulada
  // se sienta en vivo mientras el visitante sigue en la pagina (ver
  // getWishlistActivityCount). No hace nada si el usuario ya tiene guardados
  // reales, porque syncWishlistVisuals() prioriza siempre el conteo real.
  setInterval(() => { if (window.syncWishlistVisuals) window.syncWishlistVisuals(); }, 20000);

  // Bind login button in wishlist modal
  const wishlistLoginBtn = document.getElementById("wishlist-google-login-btn");
  if (wishlistLoginBtn) {
    wishlistLoginBtn.addEventListener("click", async () => {
      await loginWithGoogle();
      window.closeWishlistRegisterModal();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Listener del estado de autenticación
function listenToAuthChanges() {
  authService.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      // Cargar o crear perfil en la base de datos
      currentProfile = await getOrCreateUserProfile(user);
      updateProfileUI(true);

      // Login iniciado desde la bandeja de favoritos: ir directo al
      // Programa de Recompensas (pane-recompensas es el default de cuenta.html).
      if (redirectToRewardsAfterLogin) {
        redirectToRewardsAfterLogin = false;
        window.location.href = 'cuenta.html';
        return;
      }

      // Lógica de "Deseo Pendiente" (CRO)
      if (pendingWishProductId) {
        const productId = pendingWishProductId;
        pendingWishProductId = null;
        if (currentProfile) {
          if (!currentProfile.wishlist) currentProfile.wishlist = [];
          if (!currentProfile.wishlist.includes(productId)) {
            currentProfile.wishlist.push(productId);
            // Guardar de inmediato
            try {
              const userRef = { collection: "users", id: currentUser.uid };
              if (isMock) {
                await dbService.setDoc(userRef, currentProfile);
              } else {
                const userDocRef = doc(dbService, "users", currentUser.uid);
                await setDoc(userDocRef, { wishlist: currentProfile.wishlist }, { merge: true });
              }
            } catch (err) {
              console.error("Error guardando deseo pendiente:", err);
            }
          }
        }
        // Abrir panel lateral tras iniciar sesión
        setTimeout(() => {
          window.toggleWishlistPanel();
        }, 300);
      }

      syncWishlistVisuals();
      // Sincronizar estado VIP con la UI de la cesta si aplica
      syncVipStatus(currentProfile.isVip || false);
      // Autorrellenar formulario de checkout
      autofillCheckoutForm(user);
    } else {
      currentProfile = null;
      updateProfileUI(false);
      syncWishlistVisuals();
      syncVipStatus(false);
    }
  });
}

// Autorrellenar el formulario de checkout si existe en la página actual
function autofillCheckoutForm(user) {
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  if (nameInput && !nameInput.value) {
    nameInput.value = user.displayName || "";
  }
  if (emailInput && !emailInput.value) {
    emailInput.value = user.email || "";
  }
}

// Exponer la función para ser llamada desde checkout.js
window.saveOrderToFirebase = saveOrderToHistory;


// Obtener o crear perfil en Firestore / Mock
async function getOrCreateUserProfile(user) {
  const userRef = { collection: "users", id: user.uid };
  
  if (isMock) {
    const docSnap = await dbService.getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      const newProfile = {
        uid: user.uid,
        name: user.displayName || "Cliente",
        email: user.email,
        photoURL: user.photoURL || "assets/logo-sm.webp",
        points: 10,
        isVip: false,
        createdAt: new Date().toISOString()
      };
      await dbService.setDoc(userRef, newProfile);
      
      // Log de transacción de bienvenida
      const welcomeOrder = {
        userId: user.uid,
        createdAt: Date.now(),
        total: 0,
        pointsEarned: 10,
        items: [{ name: "Regalo de Bienvenida", quantity: 1, price: 0 }],
        status: "completado",
        orderType: "quest_reward"
      };
      await dbService.addDoc({ name: "orders" }, welcomeOrder);

      return newProfile;
    }
  } else {
    const syncResult = await callFunction("syncUserProfile", {
      name: user.displayName || "Cliente"
    });
    return syncResult.profile;
  }
}

// Iniciar sesión con Google
export async function loginWithGoogle() {
  const loginBtn = document.getElementById("google-login-btn");
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = `<span>Iniciando sesión...</span>`;
  }
  
  try {
    if (isMock) {
      await authService.signInWithPopup();
    } else {
      await services.signInWithPopup(authService, googleProvider);
    }
  } catch (error) {
    console.error("Error al iniciar sesión con Google:", error);
    alert("Hubo un problema al iniciar sesión. Inténtalo de nuevo.");
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.68 14.97.6 12 .6 7.7.6 3.99 3.07 2.18 6.67l3.66 2.84C6.71 6.97 9.14 5.04 12 5.04z"/><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#34A853" d="M12 23.4c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.93 7.7 23.4 12 23.4z"/></svg>
        <span>Entrar con Google</span>
      `;
    }
  }
}

// Cerrar sesión
export async function logoutUser() {
  try {
    await authService.signOut();
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

// Registrar una nueva orden en el historial de compras y sumar puntos
export async function saveOrderToHistory(orderData) {
  if (!currentUser) return null;

  const estimatedPointsEarned = Math.floor(orderData.total || 0); // 1 punto por cada $1 gastado
  const orderRecord = {
    userId: currentUser.uid,
    items: orderData.items || [],
    total: orderData.total || 0,
    isVip: currentProfile?.isVip || false,
    estimatedPointsEarned,
    pointsEarned: 0,
    createdAt: new Date().toISOString(),
    status: "pending_confirmation",
    payment: orderData.payment || "",
    txHash: orderData.txHash || null,
    solanaCluster: orderData.solanaCluster || null
  };

  try {
    let orderId = "";
    if (isMock) {
      const newDoc = await dbService.addDoc({ name: "orders" }, orderRecord);
      orderId = newDoc.id;
      
      // Actualizar puntos del usuario en Mock DB
      const newPoints = (currentProfile?.points || 0) + estimatedPointsEarned;
      const isVip = newPoints >= 100; // Si pasa de 100 puntos, es VIP!
      
      const userRef = { collection: "users", id: currentUser.uid };
      const updatedProfile = { ...currentProfile, points: newPoints, isVip };
      await dbService.setDoc(userRef, updatedProfile);
      currentProfile = updatedProfile;
    } else {
      // Firebase Real
      const ordersCol = collection(dbService, "orders");
      const docRef = await addDoc(ordersCol, orderRecord);
      orderId = docRef.id;

      if (orderData.payment === "phantom" && orderData.txHash) {
        const confirmResult = await callFunction("confirmPurchaseAndAwardPoints", {
          orderId,
          solanaSignature: orderData.txHash,
          cluster: orderData.solanaCluster || "mainnet-beta"
        });
        callFunction("trackLoyaltyEvent", {
          event: "purchase_points_success",
          surface: "checkout",
          metadata: {
            orderId,
            pointsAwarded: confirmResult.pointsAwarded || confirmResult.pointsDelta || 0
          }
        }).catch((err) => console.warn("[Loyalty Analytics] No se pudo registrar la compra:", err.message || err));
        const refreshed = await getDoc(doc(dbService, "users", currentUser.uid));
        if (refreshed.exists()) currentProfile = refreshed.data();
      }
    }

    // Actualizar UI
    syncVipStatus(currentProfile.isVip);
    updateProfileUI(true);

    return orderId;
  } catch (error) {
    console.error("Error al guardar la orden en la base de datos:", error);
    return null;
  }
}

// Obtener pedidos del usuario actual
async function getUserOrders(userId) {
  try {
    if (isMock) {
      return await dbService.getOrdersByUser(userId);
    } else {
      // Firebase Real
      const ordersCol = collection(dbService, "orders");
      const q = query(
        ordersCol,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    }
  } catch (error) {
    console.error("Error al recuperar el historial de compras:", error);
    return [];
  }
}

// Manejar visualización del botón de perfil y wishlist en la cabecera
function setupProfileButton() {
  const actionsContainer = document.querySelector("header .actions");
  if (!actionsContainer) return;

  // Insertar botón de perfil antes del gatillo del carrito
  const cartTrigger = actionsContainer.querySelector(".cart-trigger");
  if (!cartTrigger) return;
  
  // Evitar doble inicialización si ya existe
  if (document.getElementById("profile-trigger-btn")) return;

  // 1. Crear botón de Wishlist
  const wishlistBtn = document.createElement("button");
  wishlistBtn.className = "icon-btn wishlist-trigger";
  wishlistBtn.id = "wishlist-trigger-btn";
  wishlistBtn.setAttribute("aria-label", "Ver lista de deseos");
  wishlistBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
    <span class="wishlist-count-badge" id="wishlist-count-badge" style="display:none;">0</span>
  `;
  wishlistBtn.addEventListener("click", () => {
    window.toggleWishlistPanel();
  });
  
  // 2. Crear botón de Perfil de Usuario
  const profileBtn = document.createElement("button");
  profileBtn.className = "icon-btn profile-trigger";
  profileBtn.id = "profile-trigger-btn";
  profileBtn.setAttribute("aria-label", "Ver perfil de usuario");
  profileBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
    <span class="profile-dot" id="profile-active-dot" style="display:none;"></span>
  `;
  profileBtn.addEventListener("click", toggleProfilePanel);

  // Inyectar en orden: Wishlist y luego Perfil, antes del Carrito
  actionsContainer.insertBefore(wishlistBtn, cartTrigger);
  actionsContainer.insertBefore(profileBtn, cartTrigger);
}

// Abrir/Cerrar panel de perfil (Redirige según el estado de sesión)
export function toggleProfilePanel() {
  if (currentUser) {
    window.location.href = "cuenta.html";
  } else {
    window.location.href = "signup.html";
  }
}

// Sincronizar el estado VIP con la UI nativa del carrito y del localstorage
function syncVipStatus(isVip) {
  const vipCheck = document.getElementById("vip-check");
  if (vipCheck) {
    vipCheck.checked = isVip;
    // Disparar evento de cambio para actualizar los totales de la UI de app.js
    vipCheck.dispatchEvent(new Event("change"));
  }
}

// Actualizar el estado visual del botón de perfil
async function updateProfileUI(loggedIn) {
  const dot = document.getElementById("profile-active-dot");
  if (dot) dot.style.display = loggedIn ? "block" : "none";
}

// --- GLOBAL WISHLIST FUNCTIONS EXPOSED TO WINDOW ---

window.toggleWishlistPanel = function() {
  const panel = document.getElementById('wishlist-panel');
  const overlay = document.getElementById('overlay');
  if (!panel) return;
  
  // Cerrar carrito si está abierto
  const cartPanel = document.getElementById('cart-panel');
  if (cartPanel) cartPanel.classList.remove('active');
  
  const isActive = panel.classList.toggle('active');
  if (isActive) {
    overlay.classList.add('active');
    if (window.updateWishlistUI) window.updateWishlistUI();
  } else {
    overlay.classList.remove('active');
  }
};

window.closeWishlistRegisterModal = function() {
  const modal = document.getElementById('wishlist-register-modal');
  if (modal) modal.classList.remove('open');
};

window.isUserLoggedIn = function() {
  return !!currentUser;
};

window.getWishlist = function() {
  return (currentProfile && currentProfile.wishlist) || [];
};

window.loginWithGoogle = loginWithGoogle;

// Boton "Iniciar sesion" dentro de la bandeja de favoritos: marca la intencion
// de redirigir al Programa de Recompensas y dispara el mismo popup de Google
// que usa el resto del sitio. El redirect real ocurre en listenToAuthChanges()
// una vez Firebase confirma el login (loginWithGoogle() no distingue exito de
// cancelacion en su valor de retorno).
window.loginFromWishlistPanel = function() {
  redirectToRewardsAfterLogin = true;
  loginWithGoogle();
};

window.toggleWishlistItem = async function(productId) {
  if (!currentUser) {
    // Guardar deseo pendiente
    pendingWishProductId = productId;
    const modal = document.getElementById('wishlist-register-modal');
    if (modal) modal.classList.add('open');
    return false;
  }
  
  if (!currentProfile) {
    currentProfile = {};
  }
  if (!currentProfile.wishlist) {
    currentProfile.wishlist = [];
  }
  
  const index = currentProfile.wishlist.indexOf(productId);
  if (index > -1) {
    currentProfile.wishlist.splice(index, 1);
  } else {
    currentProfile.wishlist.push(productId);
  }
  
  // Guardar en Base de Datos
  try {
    const userRef = { collection: "users", id: currentUser.uid };
    if (isMock) {
      await dbService.setDoc(userRef, currentProfile);
    } else {
      const userDocRef = doc(dbService, "users", currentUser.uid);
      await setDoc(userDocRef, { wishlist: currentProfile.wishlist }, { merge: true });
    }
    
    syncWishlistVisuals();
    if (window.updateWishlistUI) window.updateWishlistUI();
    return true;
  } catch (error) {
    console.error("Error toggling wishlist item:", error);
    return false;
  }
};

function syncWishlistVisuals() {
  const wishlist = (currentProfile && currentProfile.wishlist) || [];
  
  // Actualizar contador del header. Si el usuario tiene guardados reales se
  // muestra ese numero real; si no, se rellena con la actividad simulada para
  // que el badge nunca se vea en 0.
  const badge = document.getElementById("wishlist-count-badge");
  if (badge) {
    const count = wishlist.length > 0 ? wishlist.length : getWishlistActivityCount();
    badge.innerText = count;
    badge.style.display = "flex";
    badge.classList.toggle("is-real-count", wishlist.length > 0);
  }

  // Actualizar botones de corazón en las tarjetas de productos
  const buttons = document.querySelectorAll(".wishlist-btn");
  buttons.forEach(btn => {
    const pId = btn.getAttribute("data-product-id");
    if (wishlist.includes(pId)) {
      btn.classList.add("in-wishlist");
    } else {
      btn.classList.remove("in-wishlist");
    }
  });
}
window.syncWishlistVisuals = syncWishlistVisuals;

// Renderiza la bandeja de favoritos (misma mecanica de apertura que el carrito,
// ver window.toggleWishlistPanel). window.CATALOG y window.handleAddToCart los
// expone js/app.js como script clasico, por eso son accesibles desde este modulo.
window.updateWishlistUI = function() {
  const container = document.getElementById('wishlist-items');
  if (!container) return;

  if (!window.isUserLoggedIn()) {
    container.innerHTML = `
      <div class="wishlist-empty">
        <div class="emoji">🤍</div>
        <p>Inicia sesión para guardar y ver tus favoritos.</p>
        <p class="hint">También es tu acceso al Programa de Recompensas y tus $PADRE.</p>
        <button class="wishlist-login-btn" onclick="window.loginFromWishlistPanel()">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.68 14.97.6 12 .6 7.7.6 3.99 3.07 2.18 6.67l3.66 2.84C6.71 6.97 9.14 5.04 12 5.04z"/><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#34A853" d="M12 23.4c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.93 7.7 23.4 12 23.4z"/></svg>
          <span>Iniciar sesión con Google</span>
        </button>
      </div>
    `;
    return;
  }

  const wishlist = window.getWishlist();
  if (!wishlist.length) {
    container.innerHTML = `
      <div class="wishlist-empty">
        <div class="emoji">🤍</div>
        <p>Tu lista de favoritos está vacía.</p>
        <p class="hint">Toca el corazón en cualquier producto para guardarlo aquí.</p>
      </div>
    `;
    return;
  }

  const catalog = window.CATALOG;
  const removeIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

  container.innerHTML = wishlist.map(productId => {
    let found = null;
    for (const cat of (catalog?.categories || [])) {
      const item = cat.items.find(i => i.id === productId);
      if (item) { found = { item, catId: cat.id }; break; }
    }
    if (!found) return '';

    const { item, catId } = found;
    const priceText = item.price
      ? `$${item.price.toFixed(2)}`
      : (item.variants && item.variants.length ? `Desde $${item.variants[0].price.toFixed(2)}` : '—');

    return `
      <div class="cart-item">
        <img src="${item.image || 'assets/menu/flauta-cochinita.avif'}" alt="${item.name}">
        <div class="item-info">
          <h4>${item.name}</h4>
          <div class="item-price">${priceText}</div>
          <div class="wishlist-item-actions">
            <button class="wishlist-add-btn" onclick="window.toggleWishlistPanel(); window.handleAddToCart('${item.id}', '${catId}')">Agregar +</button>
            <button class="wishlist-remove-btn" aria-label="Quitar de favoritos" onclick="window.toggleWishlistItem('${item.id}')">${removeIconSvg}</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};
