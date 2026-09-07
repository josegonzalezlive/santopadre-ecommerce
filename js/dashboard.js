    import { getActiveServices } from "./firebase-config.js";
import { doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { subscribeToBalance, subscribeToTransactions, processRecarga, processCanje } from "./modules/wallet.js";
import { showLoadingState } from "./modules/ui.js";
import { initFirebase } from "./modules/firebase.js";

// js/modules/wallet.js depende de getDB()/getAuth_() de modules/firebase.js, que solo
// se llenan tras llamar initFirebase() explícitamente (nadie lo hacía: toda recarga,
// canje e historial de saldo vía wallet.js fallaba con "Expected first argument to
// collection() ..." porque getDB() devolvía undefined).
await initFirebase();

// Expose wallet functions for bindings and utils
window.processRecarga = processRecarga;
window.processCanje = processCanje;
window.showLoadingState = showLoadingState;



    let authService, dbService, functionsService, isMock, googleProvider, signInWithPopupFunc;
    const services = getActiveServices();
    authService = services.auth;
    dbService = services.db;
    functionsService = services.functions;
    isMock = services.isMock;
    googleProvider = services.googleProvider;
    signInWithPopupFunc = services.signInWithPopup;

    let currentUser = null;
    let currentProfile = null;
    let unsubscribeProfile = null;

    // Configuración de Integración con n8n/Google Sheets (Fase de Marketing)
    // Se puede configurar de forma dinámica desde el LocalStorage o panel
    const MARKETING_WEBHOOK_URL = localStorage.getItem("santopadre_marketing_webhook") || "https://script.google.com/macros/s/AKfycbxdF_s4N0zvwaLzw9b07ejWQgpKnuzl9oJ6L0fJUh7oiB6ZfdHFE3PvgWx2A5a_vIfS9w/exec";

    async function triggerMarketingWebhook(profile, eventType) {
      if (!MARKETING_WEBHOOK_URL) {
        console.log(`[Webhook] Webhook de marketing no configurado. Omisión de envío.`);
        return;
      }
      try {
        await fetch(MARKETING_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            user: {
              uid: profile.uid,
              name: profile.name,
              firstName: profile.firstName || "",
              lastName: profile.lastName || "",
              email: profile.email,
              phone: profile.phone || "",
              gender: profile.gender || "",
              birthday: profile.birthday || "",
              points: profile.points || 0,
              stamps: profile.stamps || 0,
              isVip: profile.isVip || false,
              referredBy: profile.referredBy || "Directo",
              referralStatus: profile.referralStatus || "",
              gastronomy: profile.gastronomy || null
            }
          })
        });
        console.log(`[Webhook] Evento ${eventType} enviado exitosamente.`);
      } catch (err) {
        console.error("[Webhook] Error enviando evento de marketing:", err);
      }
    }

    // Controladores globales de navegación
    window.toggleMobileMenu = function() {
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (!sidebar) return;
      sidebar.classList.toggle('open');
      if (sidebar.classList.contains('open')) {
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);
      } else {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
      }
    };

    window.switchTopTab = function(tabId) {
      // Close mobile menu if open
      if (window.innerWidth <= 900) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          window.toggleMobileMenu();
        }
      }

      // Remover clases activas de pestañas
      document.querySelectorAll(".tab-item").forEach(el => el.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("active"));

      // Activar la seleccionada
      document.getElementById(`tab-${tabId}`).classList.add("active");
      document.getElementById(`pane-tab-${tabId}`).classList.add("active");
      
      // Asegurarse de estar en el pane del programa de recompensas principal
      switchSidebarTab('recompensas');
    };

    window.switchSidebarTab = function(paneId) {
      // Close mobile menu if open
      if (window.innerWidth <= 900) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          window.toggleMobileMenu();
        }
      }

      // Ocultar sub-paneles laterales derechos
      document.querySelectorAll(".sidebar-pane-content").forEach(el => el.style.display = "none");
      // Desactivar items activos en sidebar
      document.querySelectorAll(".sidebar-nav-item").forEach(el => el.classList.remove("active"));

      // Mostrar el panel adecuado
      document.getElementById(`pane-${paneId}`).style.display = "flex";
      
      // Marcar item en el sidebar
      const navItem = document.getElementById(`nav-${paneId}`);
      if (navItem) {
        navItem.classList.add("active");
      }
    };

    window.toggleDetails = function(questId) {
      const panel = document.getElementById(`quest-${questId}`);
      if (panel) {
        panel.classList.toggle("active");
      }
    };

    // Helper function to update day options based on month and year
    window.updateDayOptions = function(daySelectId, monthSelectId, yearSelectId) {
      const daySelect = document.getElementById(daySelectId);
      const monthSelect = document.getElementById(monthSelectId);
      const yearSelect = document.getElementById(yearSelectId);
      if (!daySelect || !monthSelect || !yearSelect) return;

      const selectedDay = daySelect.value;
      const monthVal = parseInt(monthSelect.value, 10);
      const yearVal = parseInt(yearSelect.value, 10);

      let numDays = 31;
      if (monthVal === 2) {
        const isLeap = yearVal ? ((yearVal % 4 === 0 && yearVal % 100 !== 0) || yearVal % 400 === 0) : true;
        numDays = isLeap ? 29 : 28;
      } else if ([4, 6, 9, 11].includes(monthVal)) {
        numDays = 30;
      }

      // Populate day select options
      daySelect.innerHTML = '<option value="">Día</option>';
      for (let d = 1; d <= numDays; d++) {
        const dStr = d < 10 ? '0' + d : '' + d;
        const option = document.createElement('option');
        option.value = dStr;
        option.innerText = d;
        daySelect.appendChild(option);
      }
      
      // Restore selected day if it is still valid
      if (selectedDay && parseInt(selectedDay, 10) <= numDays) {
        daySelect.value = selectedDay;
      } else {
        daySelect.value = "";
      }
    };

    // Populate months and years for birthday selects
    window.populateBirthdaySelects = function() {
      const questDay = document.getElementById("birthday-day-select");
      const questMonth = document.getElementById("birthday-month-select");
      const questYear = document.getElementById("birthday-year-select");
      
      const profileDay = document.getElementById("profile-birthday-day");
      const profileMonth = document.getElementById("profile-birthday-month");
      const profileYear = document.getElementById("profile-birthday-year");
      
      if (!questDay || !questMonth || !questYear || !profileDay || !profileMonth || !profileYear) return;
      
      const months = [
        { val: "01", name: "Enero" },
        { val: "02", name: "Febrero" },
        { val: "03", name: "Marzo" },
        { val: "04", name: "Abril" },
        { val: "05", name: "Mayo" },
        { val: "06", name: "Junio" },
        { val: "07", name: "Julio" },
        { val: "08", name: "Agosto" },
        { val: "09", name: "Septiembre" },
        { val: "10", name: "Octubre" },
        { val: "11", name: "Noviembre" },
        { val: "12", name: "Diciembre" }
      ];
      
      [questMonth, profileMonth].forEach(select => {
        select.innerHTML = '<option value="">Mes</option>';
        months.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.val;
          opt.innerText = m.name;
          select.appendChild(opt);
        });
      });
      
      const currentYear = new Date().getFullYear();
      [questYear, profileYear].forEach(select => {
        select.innerHTML = '<option value="">Año</option>';
        for (let y = currentYear; y >= 1940; y--) {
          const opt = document.createElement('option');
          opt.value = y;
          opt.innerText = y;
          select.appendChild(opt);
        }
      });
      
      // Populate Days initially
      window.updateDayOptions("birthday-day-select", "birthday-month-select", "birthday-year-select");
      window.updateDayOptions("profile-birthday-day", "profile-birthday-month", "profile-birthday-year");
    };

    // Setup real-time bidirectional synchronization
    window.setupBirthdaySync = function() {
      const syncPairs = [
        { questId: 'birthday-day-select', profileId: 'profile-birthday-day' },
        { questId: 'birthday-month-select', profileId: 'profile-birthday-month' },
        { questId: 'birthday-year-select', profileId: 'profile-birthday-year' }
      ];

      syncPairs.forEach(({ questId, profileId }) => {
        const questEl = document.getElementById(questId);
        const profileEl = document.getElementById(profileId);

        if (questEl && profileEl) {
          questEl.addEventListener('change', () => {
            profileEl.value = questEl.value;
            if (questId.includes('month') || questId.includes('year')) {
              const currentDayVal = document.getElementById('birthday-day-select').value;
              window.updateDayOptions('profile-birthday-day', 'profile-birthday-month', 'profile-birthday-year');
              window.updateDayOptions('birthday-day-select', 'birthday-month-select', 'birthday-year-select');
              // Restore the day selects
              document.getElementById('birthday-day-select').value = currentDayVal;
              document.getElementById('profile-birthday-day').value = currentDayVal;
            }
          });

          profileEl.addEventListener('change', () => {
            questEl.value = profileEl.value;
            if (profileId.includes('month') || profileId.includes('year')) {
              const currentDayVal = document.getElementById('profile-birthday-day').value;
              window.updateDayOptions('profile-birthday-day', 'profile-birthday-month', 'profile-birthday-year');
              window.updateDayOptions('birthday-day-select', 'birthday-month-select', 'birthday-year-select');
              // Restore the day selects
              document.getElementById('birthday-day-select').value = currentDayVal;
              document.getElementById('profile-birthday-day').value = currentDayVal;
            }
          });
        }
      });
    };

    // Guardar cumpleaños
    window.saveBirthday = async function() {
      const dayVal = document.getElementById("birthday-day-select").value;
      const monthVal = document.getElementById("birthday-month-select").value;
      const yearVal = document.getElementById("birthday-year-select").value;
      if (!dayVal || !monthVal || !yearVal) {
        alert("Selecciona una fecha completa de cumpleaños (Día, Mes y Año).");
        return;
      }
      
      if (!currentUser) return;
      
      const dateVal = `${dayVal}-${monthVal}-${yearVal}`;
      const pointsBonus = 100;
      try {
        const newPoints = (currentProfile.points || 0) + pointsBonus;
        const isVip = newPoints >= 100;
        const updatedProfile = { ...currentProfile, points: newPoints, isVip, birthday: dateVal, birthdayClaimed: true };

        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, updatedProfile);
          currentProfile = updatedProfile;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { points: newPoints, isVip, birthday: dateVal, birthdayClaimed: true }, { merge: true });
          currentProfile = updatedProfile;
        }
        
        await logPointsTransaction("Regalo de Cumpleaños", 100);
        alert("¡Feliz Cumpleaños! Recibiste 100 $PADRE de regalo.");
        updateDashboardUI();
      } catch (err) {
        console.error(err);
      }
    };

    // --- MÓDULO DE VERIFICACIÓN DE RESEÑAS (Google Business) ---
    let reviewClicked = false;
    
    window.trackReviewClick = function() {
      reviewClicked = true;
      const claimBtn = document.getElementById("claim-review-btn");
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.style.opacity = "1";
        claimBtn.style.cursor = "pointer";
      }
    };

    window.showReviewVerificationForm = function() {
      const form = document.getElementById("review-verification-form");
      if (form) {
        form.style.display = form.style.display === "none" ? "flex" : "none";
      }
    };

    window.submitReviewVerification = async function() {
      if (!currentUser) return;
      
      const usernameInput = document.getElementById("review-google-username");
      const username = usernameInput ? usernameInput.value.trim() : "";
      
      if (!username) {
        alert("Por favor ingresa tu nombre de Google con el que dejaste la reseña.");
        return;
      }
      
      try {
        const updatedProfile = { 
          ...currentProfile, 
          reviewStatus: "pending", 
          reviewGoogleUsername: username 
        };

        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, updatedProfile);
          currentProfile = updatedProfile;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { 
            reviewStatus: "pending", 
            reviewGoogleUsername: username 
          }, { merge: true });
          currentProfile = updatedProfile;
        }
        
        alert("¡Enviado con éxito! Tu reseña está en verificación por el administrador. Los 150 $PADRE se sumarán al ser aprobada.");
        updateDashboardUI();
      } catch (err) {
        console.error(err);
        alert("Error al enviar la verificación.");
      }
    };

    // La aprobación de reseñas la realiza un administrador autenticado desde admin.html
    // (isAdmin() en firestore.rules). El cliente solo puede dejar la reseña en estado
    // "pending" vía submitReviewVerification(); nunca puede auto-aprobarse puntos.

    // --- MÓDULO DE SEGUIMIENTO EN INSTAGRAM ---
    let instagramClicked = false;

    window.trackInstagramClick = function() {
      instagramClicked = true;
      const claimBtn = document.getElementById("claim-instagram-btn");
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.style.opacity = "1";
        claimBtn.style.cursor = "pointer";
      }
    };

    let _isClaimingInstagram = false;
    window.claimInstagramPoints = async function() {
      if (!currentUser) return;
      if (_isClaimingInstagram) return;
      
      if (!instagramClicked) {
        alert("Primero debes hacer clic en '1. Ir a @santopadre.ve' para seguirnos en Instagram.");
        return;
      }
      
      _isClaimingInstagram = true;
      const pointsBonus = 50;
      try {
        const newPoints = (currentProfile.points || 0) + pointsBonus;
        const isVip = newPoints >= 100;
        
        const updatedProfile = { 
          ...currentProfile, 
          points: newPoints, 
          isVip, 
          instagramClaimed: true 
        };

        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, updatedProfile);
          currentProfile = updatedProfile;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { 
            points: newPoints, 
            isVip, 
            instagramClaimed: true 
          }, { merge: true });
          currentProfile = updatedProfile;
        }
        
        await logPointsTransaction("Seguir en Instagram", 50);
        alert("¡Gracias por seguirnos en Instagram! Has recibido 50 $PADRE de regalo. 📸🎉");
        updateDashboardUI();
        _isClaimingInstagram = false;
      } catch (err) {
        console.error(err);
        alert("Error al reclamar los $PADRE.");
        _isClaimingInstagram = false;
      }
    };

    // --- NUEVAS MISIONES DE REDES SOCIALES ---
    window.showIgStoryForm = function() {
      const form = document.getElementById("igstory-verification-form");
      if (form) {
        form.style.display = form.style.display === "none" ? "flex" : "none";
      }
    };

    window.submitIgStoryVerification = async function() {
      if (!currentUser) return;
      
      const usernameInput = document.getElementById("igstory-username");
      const username = usernameInput ? usernameInput.value.trim() : "";
      
      if (!username) {
        alert("Por favor ingresa tu usuario de Instagram.");
        return;
      }
      
      try {
        const updatedProfile = { 
          ...currentProfile, 
          igStoryStatus: "pending", 
          igStoryUsername: username 
        };

        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, updatedProfile);
          currentProfile = updatedProfile;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { 
            igStoryStatus: "pending", 
            igStoryUsername: username 
          }, { merge: true });
          currentProfile = updatedProfile;
        }
        
        alert("¡Enviado con éxito! Tu historia está en verificación por el administrador. Los 100 $PADRE se sumarán al ser aprobada.");
        updateDashboardUI();
      } catch (err) {
        console.error(err);
        alert("Error al enviar la verificación.");
      }
    };

    window.showIgPostForm = function() {
      const form = document.getElementById("igpost-verification-form");
      if (form) {
        form.style.display = form.style.display === "none" ? "flex" : "none";
      }
    };

    window.submitIgPostVerification = async function() {
      if (!currentUser) return;
      
      const usernameInput = document.getElementById("igpost-username");
      const username = usernameInput ? usernameInput.value.trim() : "";
      const linkInput = document.getElementById("igpost-link");
      const link = linkInput ? linkInput.value.trim() : "";
      
      if (!username) {
        alert("Por favor ingresa tu usuario de Instagram.");
        return;
      }
      
      try {
        const updatedProfile = { 
          ...currentProfile, 
          igPostStatus: "pending", 
          igPostUsername: username,
          igPostLink: link
        };

        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, updatedProfile);
          currentProfile = updatedProfile;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { 
            igPostStatus: "pending", 
            igPostUsername: username,
            igPostLink: link
          }, { merge: true });
          currentProfile = updatedProfile;
        }
        
        alert("¡Enviado con éxito! Tu publicación está en verificación por el administrador. Los 200 $PADRE se sumarán al ser aprobada.");
        updateDashboardUI();
      } catch (err) {
        console.error(err);
        alert("Error al enviar la verificación.");
      }
    };

    window.showTikTokForm = function() {
      const form = document.getElementById("tiktok-verification-form");
      if (form) {
        form.style.display = form.style.display === "none" ? "flex" : "none";
      }
    };

    window.submitTikTokVerification = async function() {
      if (!currentUser) return;
      
      const usernameInput = document.getElementById("tiktok-username");
      const username = usernameInput ? usernameInput.value.trim() : "";
      const linkInput = document.getElementById("tiktok-link");
      const link = linkInput ? linkInput.value.trim() : "";
      
      if (!username) {
        alert("Por favor ingresa tu usuario de TikTok.");
        return;
      }
      if (!link) {
        alert("Por favor ingresa el enlace de tu video de TikTok.");
        return;
      }
      
      try {
        const updatedProfile = { 
          ...currentProfile, 
          tiktokStatus: "pending", 
          tiktokUsername: username,
          tiktokLink: link
        };

        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, updatedProfile);
          currentProfile = updatedProfile;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { 
            tiktokStatus: "pending", 
            tiktokUsername: username,
            tiktokLink: link
          }, { merge: true });
          currentProfile = updatedProfile;
        }
        
        alert("¡Enviado con éxito! Tu video de TikTok está en verificación por el administrador. Los 300 $PADRE se sumarán al ser aprobada.");
        updateDashboardUI();
      } catch (err) {
        console.error(err);
        alert("Error al enviar la verificación.");
      }
    };

    // --- HELPER: Mostrar Modal de Premio con Confeti ---
    window.showRewardModal = function({ title, message, emoji, rewardName, couponCode, color }) {
      const modal = document.getElementById('reward-popup-modal');
      const modalContent = document.getElementById('reward-popup-content');
      if (!modal) return;

      document.getElementById('reward-popup-title').innerText = title || '¡Felicidades!';
      document.getElementById('reward-popup-message').innerHTML = message || '';
      document.getElementById('reward-popup-code').innerText = couponCode || '';
      document.getElementById('reward-popup-code-row').style.display = couponCode ? 'block' : 'none';

      const borderColor = color || 'var(--lime)';
      modalContent.style.borderColor = borderColor;
      modalContent.style.boxShadow = `0 10px 40px ${borderColor}44`;

      modal.style.display = 'flex';
      void modal.offsetWidth;
      modal.style.opacity = '1';
      modalContent.style.transform = 'scale(1)';

      // Confeti
      if (window.triggerConfetti) {
        window.triggerConfetti(color);
      }
    };

    window.triggerConfetti = function(color) {
      if (window.confetti) {
        const confettiColors = ['#dcfe54', '#ffffff', color || '#dcfe54'];
        const end = Date.now() + 2000; // 2 segundos de animación
        (function frame() {
          confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors: confettiColors, zIndex: 10001 });
          confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors: confettiColors, zIndex: 10001 });
          if (Date.now() < end) requestAnimationFrame(frame);
        }());
      }
    };


    // Configuración de Premios por Nivel (5 Niveles VIP) — Optimizado < 3.9% COGS
    // Ticket mínimo por sello: $12.00 (validar en producción)
    window.TIER_REWARDS = [
      { level: 1, name: "El Iniciado", reward: "Bebida Premium Gratis", emoji: "🥤", color: "var(--lime)", textColor: "var(--ink)", cogs: 0.75 },
      { level: 2, name: "El Fiel", reward: "Postre Sorpresa del Chef", emoji: "🍰", color: "#ff9900", textColor: "var(--bone)", cogs: 1.20 },
      { level: 3, name: "El Discípulo", reward: "Nachos PEQ + Bebida Gratis", emoji: "🏔️", color: "#00ccff", textColor: "var(--bone)", cogs: 2.93 },
      { level: 4, name: "El Profeta", reward: "Tacos (3U) + Bebida Gratis", emoji: "🌮", color: "#cc33ff", textColor: "var(--bone)", cogs: 4.20 },
      { level: 5, name: "El Santo", reward: "Cena Secreta para 2 + 2 Bebidas", emoji: "👑", color: "#ffcc00", textColor: "var(--ink)", cogs: 3.00 }
    ];

    // Los sellos se acreditan exclusivamente por compras reales verificadas por el
    // administrador (ver checklist T06). No existe ninguna vía en el cliente para que
    // un usuario se autoacredite sellos ni para reiniciar su propia tarjeta.

    // Reclamar premio de ascenso: 'stamps' solo lo escribe un administrador (compra real
    // verificada), así que aquí solo se hace la petición previa de saldo pendiente en UI;
    // la validación real (¿hay un nivel completado y no reclamado?) y la escritura las
    // hace functions/rewards.js -> claimTierReward, con Admin SDK.
    let _isClaimingReward = false;
    window.claimPendingReward = async function() {
      if (!currentUser) return;
      if (_isClaimingReward) return;

      const totalStamps = currentProfile.stamps || 0;
      const claimedCount = (currentProfile.claimedRewards || []).length;
      const completedTiers = Math.floor(totalStamps / 5);

      if (claimedCount >= completedTiers) {
        alert("No tienes premios de ascenso pendientes. Sigue sumando sellos para subir de Nivel.");
        return;
      }

      if (!functionsService) {
        alert("No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.");
        return;
      }

      _isClaimingReward = true;

      try {
        const claim = httpsCallable(functionsService, 'claimTierReward');
        const result = await claim();
        const { level, reward: rewardName, couponCode } = result.data;
        const tier = window.TIER_REWARDS[Math.max(0, level - 1)] || {};

        window.showRewardModal({
          title: `¡Nivel Superado! ${tier.emoji || ''}`,
          message: `Has reclamado tu botín por ascender a <strong style="color:${tier.color || 'var(--lime)'}">${tier.name || ''}</strong>.<br><br>🎁 <strong>${rewardName} ${tier.emoji || ''}</strong><br><br>Tu premio ha sido guardado en la pestaña <strong>Canjear</strong>. Puedes usarlo ahora o más tarde.`,
          emoji: tier.emoji,
          rewardName: rewardName,
          couponCode: couponCode,
          color: tier.color
        });

        if (window.renderOrderHistory) window.renderOrderHistory();
      } catch (err) {
        console.error(err);
        if (err.code === 'functions/failed-precondition') {
          alert("No tienes premios de ascenso pendientes. Sigue sumando sellos para subir de Nivel.");
        } else {
          alert("Error al reclamar el premio.");
        }
      } finally {
        _isClaimingReward = false;
      }
    };

    window.downloadPasskitMock = async function(type) {
      if (!currentUser) {
        alert("⚠️ Inicia sesión primero para descargar tu pase.");
        return;
      }
      
      const passId = currentUser.uid.substring(0, 8).toUpperCase();
      const holderName = currentProfile?.name || currentUser.displayName || "Cliente SantoPadre";
      const stampsCount = currentProfile?.stamps || 0;

      // Si estamos en modo Simulación, ir directo al Mock visual
      if (isMock) {
        runMockAlert(type, passId, holderName, stampsCount);
        return;
      }

      // Si estamos en modo Firebase Real, intentar la descarga real
      try {
        console.log("ℹ️ Intentando obtener pase real de Firebase Cloud Functions...");
        const token = await currentUser.getIdToken();
        const headers = {
          'Authorization': `Bearer ${token}`
        };

        // El ID del proyecto se puede resolver dinámicamente
        const projectId = dbService && dbService.app ? dbService.app.options.projectId : "YOUR_PROJECT_ID";
        const region = "us-central1"; // Región por defecto para Firebase Functions
        
        if (type === 'apple') {
          const appleFunctionUrl = `https://${region}-${projectId}.cloudfunctions.net/generateApplePass`;
          const response = await fetch(appleFunctionUrl, {
            method: "GET",
            headers: headers
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `santopadre_${passId}.pkpass`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            console.log("✓ Apple Pass descargado correctamente.");
          } else {
            console.warn("La Cloud Function de Apple devolvió un estado no exitoso. Usando simulación visual. Código:", response.status);
            runMockAlert('apple', passId, holderName, stampsCount, true);
          }
        } else {
          const googleFunctionUrl = `https://${region}-${projectId}.cloudfunctions.net/generateGooglePassUrl`;
          const response = await fetch(googleFunctionUrl, {
            method: "GET",
            headers: headers
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.url) {
              window.open(data.url, "_blank");
              console.log("✓ Redirigiendo a Google Wallet...");
            } else {
              throw new Error("Respuesta inválida de la función");
            }
          } else {
            console.warn("La Cloud Function de Google devolvió un estado no exitoso. Usando simulación visual. Código:", response.status);
            runMockAlert('google', passId, holderName, stampsCount, true);
          }
        }
      } catch (err) {
        console.warn("⚠️ Conexión con Cloud Functions fallida (posiblemente no desplegadas aún). Iniciando simulación local. Detalle:", err.message);
        runMockAlert(type, passId, holderName, stampsCount, true);
      }

      function runMockAlert(walletType, id, name, stamps, showsNote = false) {
        let msg = "";
        function getTierName(s) {
          if (s >= 20) return "El Padrino (Nivel 5)";
          if (s >= 15) return "El Jefe (Nivel 4)";
          if (s >= 10) return "El Compadre (Nivel 3)";
          if (s >= 5) return "El Creyente (Nivel 2)";
          return "El Iniciado (Nivel 1)";
        }
        const tierName = getTierName(stamps);
        if (walletType === 'apple') {
          msg = `🍎 [SIMULACIÓN] Añadiendo a Apple Wallet...\n\n` +
                `Pase PassKit generado localmente:\n` +
                `- ID: SP-${id}\n` +
                `- Titular: ${name}\n` +
                `- Sellos: ${stamps}/5 (Nivel: ${tierName})\n\n` +
                `¡Listo! Se ha guardado el pase en tu Apple Wallet simulada.`;
        } else {
          msg = `🤖 [SIMULACIÓN] Añadiendo a Google Wallet...\n\n` +
                `Pase Google Wallet generado localmente:\n` +
                `- ID: SP-${id}\n` +
                `- Titular: ${name}\n` +
                `- Sellos: ${stamps}/5 (Nivel: ${tierName})\n\n` +
                `¡Listo! Se ha guardado el pase en tu Google Wallet simulada.`;
        }
        
        if (showsNote) {
          msg += `\n\n(Nota de desarrollador: Se utilizó la simulación ya que la Cloud Function correspondiente de Firebase no está activa en tu cuenta o respondió con error. Revisa la consola para más detalles).`;
        }
        alert(msg);
      }
    };

    // Guardar cambios en perfil (Datos personales y Perfil Gastronómico)
    async function saveProfileChanges(e) {
      e.preventDefault();
      if (!currentUser) return;

      const saveBtn = document.getElementById("save-profile-btn");
      const statusMsg = document.getElementById("save-status-msg");
      
      saveBtn.disabled = true;
      saveBtn.innerText = "Guardando...";
      statusMsg.style.display = "inline";
      statusMsg.style.color = "var(--mute)";
      statusMsg.innerText = "Guardando perfil...";

      try {
        const firstNameVal = document.getElementById("profile-name").value.trim();
        const lastNameVal = document.getElementById("profile-lastname").value.trim();
        const phoneVal = document.getElementById("profile-phone").value.trim();
        const genderVal = document.getElementById("profile-gender").value;
        const dayVal = document.getElementById("profile-birthday-day").value;
        const monthVal = document.getElementById("profile-birthday-month").value;
        const yearVal = document.getElementById("profile-birthday-year").value;
        const dateVal = (dayVal && monthVal && yearVal) ? `${dayVal}-${monthVal}-${yearVal}` : "";
        
        const selectedSpicy = document.querySelector('input[name="spicy-tolerance"]:checked')?.value || "";
        const selectedAvocado = document.querySelector('input[name="avocado-preference"]:checked')?.value || "";
        const selectedCilantro = document.querySelector('input[name="cilantro-team"]:checked')?.value || "";
        
        const selectedAdditions = [];
        document.querySelectorAll('input[name^="addition-"]:checked').forEach(cb => {
          selectedAdditions.push(cb.value);
        });
        
        const selectedTortilla = document.querySelector('input[name="tortilla-type"]:checked')?.value || "";
        const selectedMeat = document.getElementById("profile-meat").value;
        const cravingsVal = document.getElementById("profile-cravings").value.trim();

        // Calcular si se debe otorgar bono de cumpleaños
        let birthdayClaimed = currentProfile.birthdayClaimed || false;
        let newPoints = currentProfile.points || 0;
        let birthdayAwarded = false;

        if (dateVal && !birthdayClaimed) {
          newPoints += 100;
          birthdayClaimed = true;
          birthdayAwarded = true;
        }

        const updatedProfile = {
          ...currentProfile,
          name: `${firstNameVal} ${lastNameVal}`.trim() || currentProfile.name || currentUser.displayName,
          firstName: firstNameVal,
          lastName: lastNameVal,
          phone: phoneVal,
          gender: genderVal,
          birthday: dateVal,
          birthdayClaimed: birthdayClaimed,
          points: newPoints,
          isVip: newPoints >= 100,
          gastronomy: {
            spicyTolerance: selectedSpicy,
            avocado: selectedAvocado,
            cilantro: selectedCilantro,
            additions: selectedAdditions,
            tortilla: selectedTortilla,
            meat: selectedMeat,
            cravings: cravingsVal
          }
        };

        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, updatedProfile);
          currentProfile = updatedProfile;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, updatedProfile, { merge: true });
          currentProfile = updatedProfile;
        }

        // Enviar actualización de perfil al webhook de n8n/Google Sheets
        triggerMarketingWebhook(updatedProfile, "profile_updated");

        statusMsg.style.color = "var(--lime)";
        statusMsg.innerText = birthdayAwarded 
          ? "¡Perfil Guardado! +100 $PADRE por tu Cumpleaños 🎉"
          : "✓ ¡Perfil Guardado con éxito!";
        
        updateDashboardUI();

        setTimeout(() => {
          statusMsg.style.display = "none";
        }, 4000);

      } catch (err) {
        console.error(err);
        statusMsg.style.color = "#ea4335";
        statusMsg.innerText = "❌ Error al guardar perfil.";
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Guardar Cambios";
      }
    }

    // Canjear recompensa
    // El costo y el nombre de cada recompensa los decide exclusivamente el servidor
    // (functions/rewards.js -> REWARD_CATALOG). El "cost" que llega aquí es solo para
    // el aviso rápido de saldo insuficiente en la UI; nunca se envía al servidor.
    let _isRedeeming = false;
    window.redeemReward = async function(rewardId, cost) {
      if (!currentUser) return;
      if (_isRedeeming) return;

      if (cost && (currentProfile.points || 0) < cost) {
        alert("No tienes suficientes $PADRE para canjear esta recompensa.");
        return;
      }

      if (!functionsService) {
        alert("No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.");
        return;
      }

      _isRedeeming = true;

      try {
        const redeem = httpsCallable(functionsService, 'redeemReward');
        const result = await redeem({ rewardId });
        const { rewardName, couponCode } = result.data;

        window.showRewardModal({
          title: `¡$PADRE Canjeados!`,
          message: `Has canjeado tus $PADRE por <strong>${rewardName}</strong>.<br><br>Tu premio ha sido guardado en la pestaña <strong>Canjear</strong>. Puedes usarlo ahora o más tarde.`,
          emoji: '🎉',
          rewardName: rewardName,
          couponCode: couponCode,
          color: 'var(--lime)'
        });
        // currentProfile se actualiza solo vía el listener onSnapshot de users/{uid}
      } catch (err) {
        console.error(err);
        if (err.code === 'functions/failed-precondition') {
          alert("No tienes suficientes $PADRE para canjear esta recompensa.");
        } else {
          alert("No se pudo procesar el canje. Intenta de nuevo.");
        }
      } finally {
        _isRedeeming = false;
      }
    };

    window.markRewardAsUsed = async function(rewardId) {
      if (!currentUser || !currentProfile.activeRewards) return;
      
      const newActive = currentProfile.activeRewards.filter(r => r.id !== rewardId);
      
      try {
        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, { activeRewards: newActive });
          currentProfile.activeRewards = newActive;
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { activeRewards: newActive }, { merge: true });
          currentProfile.activeRewards = newActive;
        }
        
        updateDashboardUI();
      } catch (err) {
        console.error("Error al remover premio:", err);
      }
    };

    window.renderActiveRewards = function() {
      const activeRewards = currentProfile.activeRewards || [];
      const section = document.getElementById('active-rewards-section');
      const grid = document.getElementById('active-rewards-grid');
      
      if (!section || !grid) return;
      
      if (activeRewards.length === 0) {
        section.style.display = 'none';
        return;
      }
      
      section.style.display = 'block';
      grid.innerHTML = '';
      
      activeRewards.forEach(reward => {
        grid.innerHTML += `
          <div class="reward-card" style="border-color: var(--lime); background: rgba(220, 254, 84, 0.05);">
            <div class="reward-card-info">
              <h4 style="color: var(--lime);">${reward.name}</h4>
              <p>Código: <strong style="color: var(--bone);">${reward.code}</strong></p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="quest-btn" style="flex: 1; padding: 10px;" onclick="showRewardModal({
                title: 'Tu Premio',
                message: 'Presenta este código en caja para reclamar tu <strong>${reward.name}</strong>.',
                rewardName: '${reward.name}',
                couponCode: '${reward.code}',
                color: 'var(--lime)'
              })">Usar Ahora</button>
              <button class="quest-btn" style="flex: 1; padding: 10px; background: transparent; border: 1px solid var(--mute); color: var(--mute);" onclick="if(confirm('¿Seguro que ya usaste este premio? Desaparecerá de tu lista.')) markRewardAsUsed('${reward.id}')">Marcar Usado</button>
            </div>
          </div>
        `;
      });
    };

    // Cargar historial de órdenes y actividad
    async function loadActivityHistory(userId) {
      const ordersListContainer = document.getElementById("account-orders-list");
      if (!ordersListContainer) return;
      
      try {
        let orders = [];
        if (isMock) {
          orders = await dbService.getOrdersByUser(userId);
        } else {
          const ordersCol = collection(dbService, "orders");
          const q = query(ordersCol, where("userId", "==", userId), orderBy("createdAt", "desc"));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
          });
        }

        // Actualizar badges
        const numOrders = orders.filter(o => o.status !== "canjeado").length;
        document.getElementById("sidebar-orders-badge").innerText = numOrders;

        let sumPointsFromOrders = orders.reduce((sum, o) => sum + (o.pointsEarned || 0), 0);
        let missingPoints = (currentProfile.points || 0) - sumPointsFromOrders;
        
        let extraRowHTML = "";
        
        // Desglosar missing points
        if (missingPoints >= 100 && !orders.find(o => o.items && o.items.some(i => i.name === "Regalo de Bienvenida" || i.name === "Bono por registrar una cuenta"))) {
            extraRowHTML += `
            <div class="order-card" style="margin-bottom: 12px; background: rgba(180, 255, 30, 0.05); border: 1px dashed rgba(180, 255, 30, 0.3);">
              <div class="order-meta">
                <span class="order-date">Completado</span>
                <span class="order-total" style="color: var(--lime);">Regalo de Bienvenida</span>
              </div>
              <div class="order-details" style="color: var(--mute);">Bono por crear cuenta en SantoPadre®</div>
              <div class="order-reward" style="color: var(--lime); font-weight: bold;">
                +100 $PADRE
              </div>
            </div>
            `;
            missingPoints -= 100;
        }
        
        if (missingPoints >= 100 && currentProfile.birthday && !orders.find(o => o.items && o.items.some(i => i.name === "Regalo de Cumpleaños"))) {
            extraRowHTML += `
            <div class="order-card" style="margin-bottom: 12px; background: rgba(180, 255, 30, 0.05); border: 1px dashed rgba(180, 255, 30, 0.3);">
              <div class="order-meta">
                <span class="order-date">Completado</span>
                <span class="order-total" style="color: var(--lime);">Regalo de Cumpleaños</span>
              </div>
              <div class="order-details" style="color: var(--mute);">Bono por añadir fecha de cumpleaños</div>
              <div class="order-reward" style="color: var(--lime); font-weight: bold;">
                +100 $PADRE
              </div>
            </div>
            `;
            missingPoints -= 100;
        }

        if (missingPoints > 0) {
           extraRowHTML += `
            <div class="order-card" style="margin-bottom: 12px; background: rgba(180, 255, 30, 0.05); border: 1px dashed rgba(180, 255, 30, 0.3);">
              <div class="order-meta">
                <span class="order-date">Completado</span>
                <span class="order-total" style="color: var(--lime);">Recompensas Anteriores</span>
              </div>
              <div class="order-details" style="color: var(--mute);">Misiones, referidos y regalos pasados</div>
              <div class="order-reward" style="color: var(--lime); font-weight: bold;">
                +${missingPoints} $PADRE
              </div>
            </div>
           `;
        }

        if (orders.length === 0 && extraRowHTML === "") {
          const emptyHTML = `<div class="empty-orders">Tus pedidos e historial de $PADRE aparecerán aquí.</div>`;
          ordersListContainer.innerHTML = emptyHTML;
          const feedEl = document.getElementById('solana-transactions-feed');
          if (feedEl) feedEl.innerHTML = emptyHTML;
          return;
        }

        let ordersHTML = orders.map(order => {
          const dateStr = new Date(order.createdAt).toLocaleDateString("es-ES", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
          });
          const itemsStr = order.items.map(item => `${item.quantity}x ${item.name}`).join(", ");
          const isNegative = order.pointsEarned < 0;
          return `
            <div class="order-card" style="margin-bottom: 12px;">
              <div class="order-meta">
                <span class="order-date">${dateStr}</span>
                <span class="order-total">${order.total > 0 ? '$' + order.total.toFixed(2) : 'Premio Canjeado'}</span>
              </div>
              <div class="order-details">${itemsStr}</div>
              <div class="order-reward" style="color: ${isNegative ? '#ea4335' : 'var(--accent)'};">
                ${isNegative ? '' : '+'}${order.pointsEarned} $PADRE
              </div>
            </div>
          `;
        }).join("");

        const finalHTML = extraRowHTML + ordersHTML;
        ordersListContainer.innerHTML = finalHTML;
        
        // También actualizar el feed de Cartera
        const feedEl = document.getElementById('solana-transactions-feed');
        if (feedEl) feedEl.innerHTML = finalHTML;
        
        // Sincronizar dirección de envío en la pestaña correspondiente
        const lastDeliveryOrder = orders.find(o => o.orderType === "delivery" && o.address1);
        if (lastDeliveryOrder) {
          document.getElementById("profile-saved-address").innerText = `${lastDeliveryOrder.address1}, ${lastDeliveryOrder.address2 || ""} (Pto Ref: ${lastDeliveryOrder.reference || "Ninguno"})`;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Inicializar listeners de UI
    const googleBtn = document.getElementById("login-google-btn");
    if (googleBtn) {
      googleBtn.addEventListener("click", async () => {
        try {
          if (isMock) {
            await authService.signInWithPopup();
          } else {
            await signInWithPopupFunc(authService, googleProvider);
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Lógica para Autenticación con Email y Contraseña (Real y Mock)
    let authMode = window.location.pathname.includes("signup.html") ? "signup" : "login";
    const toggleLink = document.getElementById("toggle-auth-mode-link");
    const submitBtn = document.getElementById("email-submit-btn");

    if (toggleLink) {
      toggleLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (authMode === "login") {
          authMode = "signup";
          submitBtn.textContent = "Registrarse";
          toggleLink.textContent = "¿Ya tienes cuenta? Inicia Sesión";
        } else {
          authMode = "login";
          submitBtn.textContent = "Iniciar Sesión";
          toggleLink.textContent = "¿No tienes cuenta? Regístrate";
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        const email = document.getElementById("auth-email").value.trim();
        const password = document.getElementById("auth-password").value.trim();

        if (!email || !password) {
          alert("Por favor ingresa tu correo y contraseña.");
          return;
        }
        if (password.length < 6) {
          alert("La contraseña debe tener al menos 6 caracteres.");
          return;
        }

        try {
        if (isMock) {
          const usersAuthData = JSON.parse(localStorage.getItem("santopadre_mock_auth_credentials") || "{}");

          if (authMode === "login") {
            const credential = usersAuthData[email];
            if (!credential || credential.password !== password) {
              alert("Correo o contraseña incorrectos.");
              return;
            }
            const mockUser = {
              uid: credential.uid,
              displayName: email.split("@")[0],
              email: email,
              photoURL: "assets/logo-sm.webp"
            };
            authService.currentUser = mockUser;
            localStorage.setItem("santopadre_mock_user", JSON.stringify(mockUser));
            authService.onAuthStateChangedListeners.forEach(l => l(mockUser));
          } else {
            if (usersAuthData[email]) {
              alert("El correo ya está registrado.");
              return;
            }
            const uid = "mock_uid_" + Math.random().toString(36).substr(2, 9);
            usersAuthData[email] = { uid, password };
            localStorage.setItem("santopadre_mock_auth_credentials", JSON.stringify(usersAuthData));

            const newUser = {
              uid: uid,
              email: email,
              name: email.split("@")[0],
              createdAt: new Date().toISOString(),
              points: 0,
              stamps: 0,
              claimedRewards: [],
              activeRewards: []
            };

            const usersDb = JSON.parse(localStorage.getItem("santopadre_mock_db_users") || "{}");
            usersDb[uid] = newUser;
            localStorage.setItem("santopadre_mock_db_users", JSON.stringify(usersDb));

            const mockUser = {
              uid: uid,
              displayName: newUser.name,
              email: email,
              photoURL: "assets/logo-sm.webp"
            };
            authService.currentUser = mockUser;
            localStorage.setItem("santopadre_mock_user", JSON.stringify(mockUser));
            authService.onAuthStateChangedListeners.forEach(l => l(mockUser));
          }
        } else {

          if (authMode === "login") {
            await signInWithEmailAndPassword(authService, email, password);
          } else {
            await createUserWithEmailAndPassword(authService, email, password);
          }
        }
      } catch (err) {
        console.error(err);
        alert("Error de autenticación: " + err.message);
      }
      });
    }

    document.getElementById("nav-logout-btn").addEventListener("click", async () => {
      try {
        await authService.signOut();
      } catch (err) {
        console.error(err);
      }
    });


    document.getElementById("save-birthday-btn").addEventListener("click", saveBirthday);
    document.getElementById("profile-details-form").addEventListener("submit", saveProfileChanges);

    // Inicializar selectores y sincronización de cumpleaños
    window.populateBirthdaySelects();
    window.setupBirthdaySync();

    // Escuchar el estado de Firebase Auth
    authService.onAuthStateChanged(async (user) => {
      document.getElementById("loading-container").style.display = "none";
      
      if (user) {
        currentUser = user;
        window.currentUser = user;
        // Obtener o crear perfil en BD
        currentProfile = await getOrCreateProfile(user);
        
        if (window.location.pathname.includes("signup.html")) {
          window.location.href = "cuenta.html";
          return;
        }

        const loginContainer = document.getElementById("login-container");
        if (loginContainer) loginContainer.style.display = "none";
        const dashboardContainer = document.getElementById("dashboard-container");
        if (dashboardContainer) dashboardContainer.style.display = "grid";
        
        // Activar el escuchador en tiempo real del perfil
        setupRealtimeProfileListener(user);

        // Real-time wallet balances and transactions
        if (typeof subscribeToBalance === 'function') {
          subscribeToBalance(user.uid, ({ padreBalance, usdcBalance }) => {
            window.padreBalance = padreBalance;
            window.usdcBalance = usdcBalance;
            if (typeof updateBalancesUI === 'function') updateBalancesUI();
          });
        }
        
        if (typeof subscribeToTransactions === 'function') {
          subscribeToTransactions(user.uid, (txs) => {
            const feed = document.getElementById('solana-transactions-feed');
            if (feed) {
              feed.innerHTML = '';
              txs.forEach(tx => {
                const date = tx.timestamp ? new Date(tx.timestamp.toDate()).toLocaleDateString() : new Date().toLocaleDateString();
                const sign = tx.amount > 0 ? '+' : '';
                feed.innerHTML += `
                  <div class="tx-item">
                    <div class="tx-icon"><i class="fa-solid fa-bolt"></i></div>
                    <div class="tx-details">
                      <p class="tx-title">${tx.type.toUpperCase()}</p>
                      <p class="tx-subtitle">${date} • ${tx.status}</p>
                    </div>
                    <div class="tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
                      ${sign}${tx.amount} ${tx.currency}
                    </div>
                  </div>
                `;
              });
            }
          });
        }

      } else {
        currentUser = null;
        currentProfile = null;
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        const dashboardContainer = document.getElementById("dashboard-container");
        if (dashboardContainer) dashboardContainer.style.display = "none";
        
        if (window.location.pathname.includes("cuenta.html")) {
          window.location.href = "signup.html";
          return;
        }

        const loginContainer = document.getElementById("login-container");
        if (loginContainer) {
          loginContainer.style.display = "flex";
          if (isMock) {
            const mockBanner = document.getElementById("login-mock-banner");
            if (mockBanner) mockBanner.style.display = "block";
          }
        }
      }
    });

    // Suscribir al perfil del usuario en tiempo real (onSnapshot / storage event)
    async function setupRealtimeProfileListener(user) {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (isMock) {
        const handleStorageChange = () => {
          const usersData = JSON.parse(localStorage.getItem("santopadre_mock_db_users") || "{}");
          if (usersData[user.uid]) {
            const oldStamps = currentProfile ? (currentProfile.stamps || 0) : 0;
            currentProfile = usersData[user.uid];
            updateDashboardUI();
            
            // Si el cajero sumó sellos, lanzar confeti neón de inmediato
            if (currentProfile.stamps > oldStamps && window.triggerConfetti) {
              const currentTier = Math.min(Math.floor((currentProfile.stamps || 0) / 5), 5);
              const colors = ["var(--lime)", "#ff9900", "#00ccff", "#cc33ff", "var(--lime)", "var(--lime)"];
              window.triggerConfetti(colors[currentTier]);
            }
          }
        };

        window.addEventListener("storage", handleStorageChange);
        unsubscribeProfile = () => {
          window.removeEventListener("storage", handleStorageChange);
        };
        
        updateDashboardUI();
      } else {
        try {
          const docRef = doc(dbService, "users", user.uid);

          unsubscribeProfile = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
              const oldStamps = currentProfile ? (currentProfile.stamps || 0) : 0;
              currentProfile = snapshot.data();
              updateDashboardUI();

              // Efecto WOW en vivo: lanzar confeti si sumó un sello desde el Admin
              if (currentProfile.stamps > oldStamps && window.triggerConfetti) {
                const currentTier = Math.min(Math.floor((currentProfile.stamps || 0) / 5), 5);
                const colors = ["var(--lime)", "#ff9900", "#00ccff", "#cc33ff", "var(--lime)", "var(--lime)"];
                window.triggerConfetti(colors[currentTier]);
              }
            }
          }, (err) => {
            console.error("Error en realtime listener de perfil:", err);
          });
        } catch (e) {
          console.error("Error al suscribirse a Firestore en tiempo real:", e);
          updateDashboardUI();
        }
      }
    }

    // === REFERRAL TRACKING (URL PARSER) ===
    (function() {
      const urlParams = new URLSearchParams(window.location.search);
      const refId = urlParams.get('id');
      if (refId) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
        document.cookie = `sp_referral=${encodeURIComponent(refId)};expires=${expires.toUTCString()};path=/`;
        
        // Set a flag to show the banner ONLY on this specific visit
        sessionStorage.setItem('show_referral_banner', 'true');
        
        // Limpiar la URL sin recargar la página
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    })();

    function getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
      return null;
    }

    // Mostrar el banner del referido si existe
    async function checkAndShowReferralBanner() {
      const refId = getCookie("sp_referral");
      const shouldShowBanner = sessionStorage.getItem('show_referral_banner') === 'true';
      
      if (!refId || !shouldShowBanner || isMock) return;
      
      // Clear the flag so it doesn't show on subsequent navigation unless they use the link again
      sessionStorage.removeItem('show_referral_banner');

      const checkDb = setInterval(async () => {
        if (dbService) {
          clearInterval(checkDb);
          try {
            const docRef = doc(dbService, "users", refId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              const data = snap.data();
              const name = data.name || "Alguien";
              const photoUrl = data.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=random";
              
              const banner = document.createElement("div");
              banner.className = "referral-banner";
              banner.innerHTML = `
                <img src="${photoUrl}" alt="${name}">
                <span>${name} te ha invitado</span>
              `;
              
              // Estilos embebidos para el banner (tipo Skool)
              const style = document.createElement("style");
              style.innerHTML = `
                .referral-banner {
                  position: fixed;
                  top: 20px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: white;
                  border-radius: 50px;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                  display: flex;
                  align-items: center;
                  padding: 8px 24px 8px 8px;
                  z-index: 99999;
                  font-family: var(--font-primary, sans-serif);
                  color: #111;
                  animation: slideDownRef 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
                .referral-banner img {
                  width: 32px;
                  height: 32px;
                  border-radius: 50%;
                  object-fit: cover;
                  margin-right: 12px;
                }
                .referral-banner span {
                  font-weight: 700;
                  font-size: 15px;
                }
                @keyframes slideDownRef {
                  0% { top: -100px; opacity: 0; }
                  100% { top: 20px; opacity: 1; }
                }
                @media (max-width: 600px) {
                  .referral-banner {
                    width: 90%;
                    padding: 8px 16px 8px 8px;
                  }
                  .referral-banner span {
                    font-size: 14px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                }
              `;
              document.head.appendChild(style);
              document.body.appendChild(banner);
            }
          } catch (e) {
            console.error("Error cargando banner de referido:", e);
          }
        }
      }, 200);
    }
    
    // Ejecutar el check del banner
    checkAndShowReferralBanner();

    // Obtener perfil en BD (centralizado)
    async function getOrCreateProfile(user) {
      const userRef = { collection: "users", id: user.uid };
      const refId = getCookie("sp_referral");
      
      const createNewProfileObj = () => {
        const obj = {
          uid: user.uid,
          name: user.displayName || "Cliente",
          email: user.email,
          points: 100,
          isVip: false,
          createdAt: new Date().toISOString()
        };
        if (refId && refId !== user.uid) {
          obj.referredBy = refId;
          obj.referralStatus = "pending_purchase"; // will change to 'completed' after first order
        }
        return obj;
      };

      if (isMock) {
        const snap = await dbService.getDoc(userRef);
        if (snap.exists()) {
          return snap.data();
        } else {
          const newProfile = createNewProfileObj();
          await dbService.setDoc(userRef, newProfile);
          
          // Log de transacción de bienvenida en mock
          const welcomeOrder = {
            userId: user.uid,
            createdAt: Date.now(),
            total: 0,
            pointsEarned: 100,
            items: [{ name: "Regalo de Bienvenida", quantity: 1, price: 0 }],
            status: "completado",
            orderType: "quest_reward"
          };
          await dbService.addDoc({ name: "orders" }, welcomeOrder);

          triggerMarketingWebhook(newProfile, "user_registered");
          return newProfile;
        }
      } else {
        const docRef = doc(dbService, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data();
        } else {
          const newProfile = createNewProfileObj();
          await setDoc(docRef, newProfile);

          // Log de transacción de bienvenida en firebase
          const welcomeOrder = {
            userId: user.uid,
            createdAt: Date.now(),
            total: 0,
            pointsEarned: 100,
            items: [{ name: "Regalo de Bienvenida", quantity: 1, price: 0 }],
            status: "completado",
            orderType: "quest_reward"
          };
          const ordersCol = collection(dbService, "orders");
          await addDoc(ordersCol, welcomeOrder);

          triggerMarketingWebhook(newProfile, "user_registered");
          return newProfile;
        }
      }
    }

    // Funciones de Referidos
    window.copyReferralLink = function() {
      const input = document.getElementById("referral-link-new");
      input.select();
      document.execCommand("copy");
      const btn = document.getElementById("copy-ref-btn-new");
      const originalText = btn.innerText;
      btn.innerText = "¡Copiado!";
      setTimeout(() => { btn.innerText = originalText; }, 2000);
    };

    window.loadReferrals = async function() {
      if (!currentUser) return;
      document.getElementById("referral-link-new").value = `https://www.santopadre.store/cuenta.html?id=${currentUser.uid}`;
      
      const pendingList = document.getElementById("referrals-pending-list");
      const completedList = document.getElementById("referrals-completed-list");
      
      pendingList.innerHTML = "Cargando...";
      completedList.innerHTML = "Cargando...";
      
      if (!isMock) {
        try {
          const q = query(collection(dbService, "users"), where("referredBy", "==", currentUser.uid));
          const snapshot = await getDocs(q);
          
          let pendingHTML = "";
          let completedHTML = "";
          
          snapshot.forEach(doc => {
            const data = doc.data();
            const name = data.name || data.email || "Amigo";
            const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "Reciente";
            
            if (data.referralStatus === "pending_purchase") {
              pendingHTML += `<div style="background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;"><span>👤 ${name}</span> <span style="font-size: 11px; opacity: 0.5;">${dateStr}</span></div>`;
            } else if (data.referralStatus === "completed") {
              completedHTML += `<div style="background: rgba(180,255,30,0.05); border: 1px solid rgba(180,255,30,0.2); padding: 10px 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;"><span>🎉 ${name}</span> <span style="font-size: 11px; color: var(--lime);">+200 $PADRE</span></div>`;
            }
          });
          
          pendingList.innerHTML = pendingHTML || "Aún no hay amigos invitados pendientes.";
          completedList.innerHTML = completedHTML || "Tus amigos registrados y que ya compraron aparecerán aquí.";
        } catch (e) {
          console.error("Error loading referrals:", e);
          pendingList.innerHTML = "Error al cargar referidos.";
          completedList.innerHTML = "Error al cargar referidos.";
        }
      } else {
        pendingList.innerHTML = "Simulación: No hay referidos pendientes.";
        completedList.innerHTML = "Simulación: No hay referidos exitosos.";
      }
    };

    // Función para registrar una transacción de puntos en el historial (orders)
    async function logPointsTransaction(title, points) {
      if (!currentUser) return;
      try {
        const mockOrder = {
          userId: currentUser.uid,
          createdAt: Date.now(),
          total: 0,
          pointsEarned: points,
          items: [{ name: title, quantity: 1, price: 0 }],
          status: "completado",
          orderType: "quest_reward"
        };

        if (isMock) {
          await dbService.addDoc({ name: "orders" }, mockOrder);
        } else {
          const ordersCol = collection(dbService, "orders");
          await addDoc(ordersCol, mockOrder);
        }
        
        await loadActivityHistory(currentUser.uid);
      } catch (err) {
        console.error("Error logging points transaction:", err);
      }
    }

    // Actualizar elementos dinámicos del Dashboard
    function updateDashboardUI() {
      if (!currentUser || !currentProfile) return;

      // Helper function to safely parse birthday in YYYY-MM-DD or DD-MM-YYYY format
      function parseBirthday(birthdayStr) {
        if (!birthdayStr) return { day: "", month: "", year: "" };
        const cleanStr = birthdayStr.replace(/\//g, "-");
        const parts = cleanStr.split("-");
        let d = "", m = "", y = "";
        
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            y = parts[0];
            m = parts[1];
            d = parts[2];
          } else {
            // DD-MM-YYYY
            d = parts[0];
            m = parts[1];
            y = parts[2];
          }
        }
        
        // Normalize day and month to be 2 digits (e.g. "5" -> "05")
        if (d && !isNaN(d)) {
          d = String(parseInt(d, 10)).padStart(2, "0");
        }
        if (m && !isNaN(m)) {
          m = String(parseInt(m, 10)).padStart(2, "0");
        }
        if (y && !isNaN(y)) {
          y = String(parseInt(y, 10));
        }
        
        return { day: d, month: m, year: y };
      }
      
      let points = currentProfile.points || 0;
      const isVip = currentProfile.isVip || false;

      // 1. Datos en Sidebar y Tarjeta de Perfil Izquierda (Actualizado de inmediato, movido arriba para evitar que errores detengan el proceso)
      const userFullName = currentProfile.name || currentUser.displayName || "Cliente";
      
      const elSidebarName = document.getElementById("user-display-name");
      if (elSidebarName) elSidebarName.innerText = userFullName;
      
      const elSidebarEmail = document.getElementById("user-display-email");
      if (elSidebarEmail) elSidebarEmail.innerText = currentProfile.email || currentUser.email;

      const elSummaryName = document.getElementById("summary-card-name");
      if (elSummaryName) elSummaryName.innerText = userFullName;

      const elSummaryEmail = document.getElementById("summary-card-email");
      if (elSummaryEmail) elSummaryEmail.innerText = currentProfile.email || currentUser.email;

      const elSummaryPoints = document.getElementById("summary-card-points");
      if (elSummaryPoints) elSummaryPoints.innerText = `${points} $PADRE`;
      
      const elAvatarBadge = document.getElementById("profile-avatar-badge");
      if (elAvatarBadge) elAvatarBadge.innerText = userFullName.charAt(0).toUpperCase();

      // Autocorrección de puntos de bienvenida heredados (de 10 a 100)
      if (points === 10 || points === 110) {
        const newPoints = points + 90;
        currentProfile.points = newPoints; // Actualización local inmediata
        points = newPoints;
        if (elSummaryPoints) elSummaryPoints.innerText = `${points} $PADRE`;
        
        // Ejecutar actualización en segundo plano
        (async () => {
          try {
            if (isMock) {
              const userRef = { collection: "users", id: currentUser.uid };
              const usersData = JSON.parse(localStorage.getItem("santopadre_mock_db_users") || "{}");
              if (usersData[currentUser.uid]) {
                usersData[currentUser.uid].points = newPoints;
                localStorage.setItem("santopadre_mock_db_users", JSON.stringify(usersData));
              }
            } else {
              const userDocRef = doc(dbService, "users", currentUser.uid);
              await setDoc(userDocRef, { points: newPoints }, { merge: true });
            }
            console.log(`Puntos de bienvenida corregidos a ${newPoints}`);
          } catch (e) {
            console.error("Error al corregir puntos de bienvenida:", e);
          }
        })();
      }

      const userPhotoURL = currentUser.photoURL || currentProfile.photoURL;
      const avatarImg = document.getElementById("user-display-avatar");
      const avatarPlaceholder = document.getElementById("user-avatar-placeholder");
      
      const isRealExternalPhoto = userPhotoURL && (userPhotoURL.startsWith("http://") || userPhotoURL.startsWith("https://"));
      
      if (isRealExternalPhoto) {
        if (avatarImg) {
          avatarImg.src = userPhotoURL;
          avatarImg.style.display = "block";
        }
        if (avatarPlaceholder) {
          avatarPlaceholder.style.display = "none";
        }
      } else {
        if (avatarImg) {
          avatarImg.style.display = "none";
        }
        if (avatarPlaceholder) {
          avatarPlaceholder.innerText = userFullName.charAt(0).toUpperCase();
          avatarPlaceholder.style.display = "flex";
        }
      }

      // 2. Banner de simulación
      if (isMock) {
        document.getElementById("dashboard-mock-banner").style.display = "block";
      }

      // 3. Pestaña de Cartera
      document.getElementById("wallet-points-value").innerText = `${points} $PADRE`;
      
      // Actualizar tarjeta de sellos digital (PassKit)
      const totalStamps = currentProfile.stamps || 0;
      let currentTierIndex = Math.floor(totalStamps / 5);
      let currentStamps = totalStamps % 5;
      
      const claimedRewards = currentProfile.claimedRewards || [];
      const claimedCount = claimedRewards.length;
      
      let displayTierIndex = Math.min(currentTierIndex, 4);
      const currentTierData = window.TIER_REWARDS[displayTierIndex];
      
      const passHolderName = currentProfile.firstName || currentProfile.name || currentUser.displayName || "Cliente Invitado";
      const passHolderTier = currentTierData.name;
      const passSerial = `SP-${currentUser.uid.substring(0, 8).toUpperCase()}`;

      document.getElementById("pass-stamp-count").innerText = `${currentStamps} / 5`;
      document.getElementById("pass-holder-name").innerText = passHolderName;
      document.getElementById("pass-holder-tier").innerText = passHolderTier;
      document.getElementById("pass-serial-id").innerText = passSerial;

      // Generar código de barra real y escaneable (Code 128)
      if (typeof JsBarcode !== "undefined") {
        try {
          JsBarcode("#barcode-svg", passSerial, {
            format: "CODE128B",
            lineColor: "#000000",
            width: 2,
            height: 55,
            displayValue: false,
            margin: 0
          });
        } catch (e) {
          console.error("Error generating barcode with JsBarcode:", e);
        }
      }
      
      const passCard = document.querySelector(".passkit-pass");
      if (passCard) {
        passCard.style.borderColor = currentTierData.color;
        passCard.style.boxShadow = `0 20px 40px rgba(0, 0, 0, 0.55), 0 0 15px ${currentTierData.color}22`;
      }

      for (let i = 1; i <= 5; i++) {
        const slot = document.getElementById(`stamp-${i}`);
        if (slot) {
          if (i <= currentStamps) {
            slot.classList.add("active");
            slot.innerHTML = `<span>${currentTierData.emoji}</span>`;
            slot.style.background = currentTierData.color;
            slot.style.color = currentTierData.textColor || "var(--ink)";
            slot.style.boxShadow = `0 0 10px ${currentTierData.color}`;
          } else {
            slot.classList.remove("active");
            slot.innerHTML = `<span></span>`;
            slot.style.background = "rgba(0,0,0,0.3)";
            slot.style.boxShadow = "none";
          }
        }
      }

      // Mostrar u ocultar el botón de reclamo
      const claimSection = document.getElementById("claim-reward-section");
      if (claimSection) {
        if (claimedCount < currentTierIndex) {
          claimSection.style.display = "block";
        } else {
          claimSection.style.display = "none";
        }
      }

      // Actualizar la barra horizontal de progreso por niveles (Nodos Tiers)
      const progressFill = document.getElementById("progress-bar-fill");
      if (progressFill) {
        let progressPct = Math.min(currentTierIndex * 25, 100);
        progressFill.style.width = `${progressPct}%`;
      }

      // Actualizar los textos de progreso
      const progressLevelText = document.getElementById("progress-level-text");
      if (progressLevelText) {
        progressLevelText.innerText = `Estatus: ${currentTierData.name} (Nivel ${displayTierIndex + 1})`;
      }

      const progressNextReward = document.getElementById("progress-next-reward");
      if (progressNextReward) {
        progressNextReward.innerHTML = `Siguiente Gran Premio: ${currentTierData.reward} ${currentTierData.emoji}`;
      }

      // Actualizar estilos visuales de los nodos de progreso (Tiers 0 al 5)
      for (let i = 0; i <= 5; i++) {
        const node = document.getElementById(`node-${i}`);
        if (node) {
          if (i <= currentTierIndex) {
            node.style.opacity = "1";
            node.style.filter = "none";
            node.style.borderColor = "var(--lime)";
            node.style.background = "var(--ink-3)";
            node.style.color = "var(--lime)";
            node.style.boxShadow = "0 0 10px rgba(180,255,30,0.3)";
          } else {
            node.style.opacity = "0.5";
            node.style.filter = "grayscale(90%)";
            node.style.borderColor = "rgba(255,255,255,0.1)";
            node.style.background = "#1d1d21";
            node.style.color = "var(--mute)";
            node.style.boxShadow = "none";
          }
        }
      }



      // 4. Pestaña de Niveles VIP (Eliminada)

      // 5. Misiones de Ganar
      // Cumpleaños
      if (currentProfile.birthdayClaimed) {
        document.getElementById("birthday-quest-status").innerText = "✓ Completado";
        document.getElementById("birthday-quest-status").style.color = "var(--lime)";
        
        const bdayParsed = parseBirthday(currentProfile.birthday);
        const day = bdayParsed.day;
        const month = bdayParsed.month;
        const year = bdayParsed.year;
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthName = month && parseInt(month, 10) ? monthNames[parseInt(month, 10) - 1] || "" : "";
        const dayStr = day && parseInt(day, 10) ? parseInt(day, 10) : "";
        const yearStr = year ? ` de ${year}` : "";
        
        let detailsHtml = "";
        if (dayStr && monthName) {
          detailsHtml = `<p style="color: var(--white); font-weight: bold; font-size: 13px; margin-bottom: 0;">🎂 ¡Felicidades! Tu fecha está guardada: ${dayStr} de ${monthName}${yearStr}. $PADRE reclamados con éxito. 🎉</p>`;
        } else {
          detailsHtml = `<p style="color: var(--white); font-weight: bold; font-size: 13px; margin-bottom: 0;">🎂 ¡Felicidades! Tu fecha está guardada. $PADRE reclamados con éxito. 🎉</p>`;
        }
        document.getElementById("quest-birthday-details").innerHTML = detailsHtml;
      }

      // Escribir reseña
      if (currentProfile.reviewStatus === "approved" || currentProfile.reviewClaimed) {
        document.getElementById("review-quest-status").innerText = "✓ Completado";
        document.getElementById("review-quest-status").style.color = "var(--lime)";
        document.getElementById("quest-review-details").innerHTML = `<p style="color: var(--white); font-weight: bold; font-size: 13px; margin-bottom: 0;">Reseña verificada y aprobada con éxito. ¡Recibiste 150 $PADRE! ⭐️</p>`;
      } else if (currentProfile.reviewStatus === "pending") {
        document.getElementById("review-quest-status").innerText = "En verificación";
        document.getElementById("review-quest-status").style.color = "orange";
        document.getElementById("quest-review-details").innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <p style="color: orange; font-weight: bold; font-size: 13px; margin-bottom: 4px;">⏳ Tu reseña con el nombre "${currentProfile.reviewGoogleUsername || ""}" está en verificación por el administrador.</p>
          </div>
        `;
      }

      // Instagram
      if (currentProfile.instagramClaimed) {
        document.getElementById("instagram-quest-status").innerText = "✓ Completado";
        document.getElementById("instagram-quest-status").style.color = "var(--lime)";
        document.getElementById("quest-instagram-details").innerHTML = `<p style="color: var(--white); font-weight: bold; font-size: 13px; margin-bottom: 0;">¡Ya nos sigues en Instagram! Recibiste 50 $PADRE. 📸</p>`;
      }

      // Historias de Instagram (igStoryStatus)
      const igstoryQuestStatus = document.getElementById("igstory-quest-status");
      const questIgstoryDetails = document.getElementById("quest-igstory-details");
      if (igstoryQuestStatus && questIgstoryDetails) {
        if (currentProfile.igStoryStatus === "approved" || currentProfile.igStoryClaimed) {
          igstoryQuestStatus.innerText = "✓ Completado";
          igstoryQuestStatus.style.color = "var(--lime)";
          questIgstoryDetails.innerHTML = `<p style="color: var(--white); font-weight: bold; font-size: 13px; margin-bottom: 0;">¡Historia verificada! Recibiste 100 $PADRE. 📸✨</p>`;
        } else if (currentProfile.igStoryStatus === "pending") {
          igstoryQuestStatus.innerText = "En verificación";
          igstoryQuestStatus.style.color = "orange";
          questIgstoryDetails.innerHTML = `<p style="color: orange; font-weight: bold; font-size: 13px; margin-bottom: 0;">⏳ Tu historia de Instagram con usuario "${currentProfile.igStoryUsername || ""}" está en verificación por el administrador.</p>`;
        } else if (currentProfile.igStoryStatus === "rejected") {
          igstoryQuestStatus.innerText = "Rechazada";
          igstoryQuestStatus.style.color = "#ea4335";
          document.getElementById("igstory-verification-form").style.display = "none";
        }
      }

      // Publicar Post en Instagram (igPostStatus)
      const igpostQuestStatus = document.getElementById("igpost-quest-status");
      const questIgpostDetails = document.getElementById("quest-igpost-details");
      if (igpostQuestStatus && questIgpostDetails) {
        if (currentProfile.igPostStatus === "approved" || currentProfile.igPostClaimed) {
          igpostQuestStatus.innerText = "✓ Completado";
          igpostQuestStatus.style.color = "var(--lime)";
          questIgpostDetails.innerHTML = `<p style="color: var(--white); font-weight: bold; font-size: 13px; margin-bottom: 0;">¡Publicación verificada! Recibiste 200 $PADRE. 📸🍽️</p>`;
        } else if (currentProfile.igPostStatus === "pending") {
          igpostQuestStatus.innerText = "En verificación";
          igpostQuestStatus.style.color = "orange";
          questIgpostDetails.innerHTML = `<p style="color: orange; font-weight: bold; font-size: 13px; margin-bottom: 0;">⏳ Tu publicación con usuario "${currentProfile.igPostUsername || ""}" está en verificación por el administrador.</p>`;
        } else if (currentProfile.igPostStatus === "rejected") {
          igpostQuestStatus.innerText = "Rechazada";
          igpostQuestStatus.style.color = "#ea4335";
          document.getElementById("igpost-verification-form").style.display = "none";
        }
      }

      // Video en TikTok (tiktokStatus)
      const tiktokQuestStatus = document.getElementById("tiktok-quest-status");
      const questTiktokDetails = document.getElementById("quest-tiktok-details");
      if (tiktokQuestStatus && questTiktokDetails) {
        if (currentProfile.tiktokStatus === "approved" || currentProfile.tiktokClaimed) {
          tiktokQuestStatus.innerText = "✓ Completado";
          tiktokQuestStatus.style.color = "var(--lime)";
          questTiktokDetails.innerHTML = `<p style="color: var(--white); font-weight: bold; font-size: 13px; margin-bottom: 0;">¡Video verificado! Recibiste 300 $PADRE. 🎥🎵</p>`;
        } else if (currentProfile.tiktokStatus === "pending") {
          tiktokQuestStatus.innerText = "En verificación";
          tiktokQuestStatus.style.color = "orange";
          questTiktokDetails.innerHTML = `<p style="color: orange; font-weight: bold; font-size: 13px; margin-bottom: 0;">⏳ Tu video de TikTok con usuario "${currentProfile.tiktokUsername || ""}" está en verificación por el administrador.</p>`;
        } else if (currentProfile.tiktokStatus === "rejected") {
          tiktokQuestStatus.innerText = "Rechazada";
          tiktokQuestStatus.style.color = "#ea4335";
          document.getElementById("tiktok-verification-form").style.display = "none";
        }
      }

      // 6. Programa de referidos
      const refLinkEl = document.getElementById("referral-link-new");
      if (refLinkEl) refLinkEl.value = `https://www.santopadre.store/ref?id=${currentUser.uid}`;

      // 7. Pestaña Mi Perfil
      if (!currentProfile.firstName && !currentProfile.lastName && (currentProfile.name || currentUser.displayName)) {
        const nameParts = (currentProfile.name || currentUser.displayName).split(" ");
        currentProfile.firstName = nameParts[0] || "";
        currentProfile.lastName = nameParts.slice(1).join(" ") || "";
      }

      document.getElementById("profile-name").value = currentProfile.firstName || "";
      document.getElementById("profile-lastname").value = currentProfile.lastName || "";
      document.getElementById("profile-email").value = currentProfile.email || currentUser.email || "";
      document.getElementById("profile-phone").value = currentProfile.phone || "";
      document.getElementById("profile-gender").value = currentProfile.gender || "";
      if (currentProfile.birthday) {
        const bdayParsed = parseBirthday(currentProfile.birthday);
        const day = bdayParsed.day;
        const month = bdayParsed.month;
        const year = bdayParsed.year;
        
        document.getElementById("birthday-year-select").value = year;
        document.getElementById("birthday-month-select").value = month;
        document.getElementById("profile-birthday-year").value = year;
        document.getElementById("profile-birthday-month").value = month;
        
        window.updateDayOptions("birthday-day-select", "birthday-month-select", "birthday-year-select");
        window.updateDayOptions("profile-birthday-day", "profile-birthday-month", "profile-birthday-year");
        
        document.getElementById("birthday-day-select").value = day;
        document.getElementById("profile-birthday-day").value = day;
      } else {
        document.getElementById("birthday-year-select").value = "";
        document.getElementById("birthday-month-select").value = "";
        document.getElementById("birthday-day-select").value = "";
        document.getElementById("profile-birthday-year").value = "";
        document.getElementById("profile-birthday-month").value = "";
        document.getElementById("profile-birthday-day").value = "";
        window.updateDayOptions("birthday-day-select", "birthday-month-select", "birthday-year-select");
        window.updateDayOptions("profile-birthday-day", "profile-birthday-month", "profile-birthday-year");
      }

      // Termómetro del picante
      const spicyTolerance = currentProfile.gastronomy?.spicyTolerance || "";
      document.querySelectorAll('input[name="spicy-tolerance"]').forEach(r => {
        r.checked = r.value === spicyTolerance;
      });

      // Factor Aguacate
      const avocado = currentProfile.gastronomy?.avocado || "";
      document.querySelectorAll('input[name="avocado-preference"]').forEach(r => {
        r.checked = r.value === avocado;
      });

      // Team Cilantro
      const cilantro = currentProfile.gastronomy?.cilantro || "";
      document.querySelectorAll('input[name="cilantro-team"]').forEach(r => {
        r.checked = r.value === cilantro;
      });

      // Adiciones Recurrentes
      const additions = currentProfile.gastronomy?.additions || [];
      document.querySelectorAll('input[name^="addition-"]').forEach(cb => {
        cb.checked = additions.includes(cb.value);
      });

      // Preferencia de Tortilla
      const tortilla = currentProfile.gastronomy?.tortilla || "";
      document.querySelectorAll('input[name="tortilla-type"]').forEach(r => {
        r.checked = r.value === tortilla;
      });

      // Estilo de carne
      const elMeat = document.getElementById("profile-meat");
      if (elMeat) elMeat.value = currentProfile.gastronomy?.meat || "";

      // Antojos favoritos
      const elCravings = document.getElementById("profile-cravings");
      if (elCravings) elCravings.value = currentProfile.gastronomy?.cravings || "";

      // 7.1. Tarjeta de Usuario Izquierda (Resumen)
      const summaryCardFullName = currentProfile.name || currentUser.displayName || "Cliente SantoPadre";
      const elSumName = document.getElementById("summary-card-name");
      if (elSumName) elSumName.innerText = summaryCardFullName;
      const elSumEmail = document.getElementById("summary-card-email");
      if (elSumEmail) elSumEmail.innerText = currentProfile.email || currentUser.email || "";
      const elSumPoints = document.getElementById("summary-card-points");
      if (elSumPoints) elSumPoints.innerText = `${points} $PADRE`;
      const elAvatarBadgeElement = document.getElementById("profile-avatar-badge");
      if (elAvatarBadgeElement) elAvatarBadgeElement.innerText = summaryCardFullName.charAt(0).toUpperCase();

      // 7.2. Ficha Gastronómica Izquierda (Resumen de preferencias)
      let spicyText = "Sin definir";
      if (spicyTolerance === "cero") spicyText = "❌ Cero Picante";
      else if (spicyTolerance === "turista") spicyText = "🌶️ Turista / Sutil";
      else if (spicyTolerance === "mexicano") spicyText = "🌶️🌶️ Medio (Taquero)";
      else if (spicyTolerance === "habanero") spicyText = "🌶️🌶️🌶️ Habanero";
      document.getElementById("summary-gasto-spicy").innerText = spicyText;

      let avocadoText = "Sin definir";
      if (avocado === "guacamole") avocadoText = "🥑 Guac Extra";
      else if (avocado === "rebanadas") avocadoText = "Rebanado";
      else if (avocado === "evitar") avocadoText = "❌ Evitar";
      document.getElementById("summary-gasto-avocado").innerText = avocadoText;

      let cilantroText = "Sin definir";
      if (cilantro === "con_todo") cilantroText = "🌿 Con Todo";
      else if (cilantro === "sin_cilantro") cilantroText = "🚫 Sin Cilantro";
      document.getElementById("summary-gasto-cilantro").innerText = cilantroText;

      let tortillaText = "Sin definir";
      if (tortilla === "maiz") tortillaText = "🌽 Maíz";
      else if (tortilla === "trigo") tortillaText = "🌾 Trigo";
      else if (tortilla === "bowl") tortillaText = "🥣 Bowl";
      document.getElementById("summary-gasto-tortilla").innerText = tortillaText;

      const meatObj = {
        pastor: "Al Pastor",
        bistec: "Bistec / Asada",
        cochinita: "Cochinita",
        suadero: "Suadero",
        barbacoa: "Barbacoa",
        pollo: "Tinga de Pollo",
        carnitas: "Carnitas",
        veggie: "Nopales/Veggie"
      };
      document.getElementById("summary-gasto-meat").innerText = meatObj[currentProfile.gastronomy?.meat] || "Sin definir";

      // 8. Cargar historial
      loadActivityHistory(currentUser.uid);
      
      // 9. Actualizar Premios Disponibles
      if (window.renderActiveRewards) window.renderActiveRewards();

      // 10. Cargar referidos
      if (window.loadReferrals) window.loadReferrals();

      // 11. Cargar favoritos
      updateFavoritesUI();
    }

    // --- FAVORITOS (WISHLIST) EN ACCOUNT PORTAL ---
    function updateFavoritesUI() {
      if (!currentUser || !currentProfile) return;
      
      const wishlist = currentProfile.wishlist || [];
      
      // Actualizar contador del menú lateral
      const badge = document.getElementById("favoritos-count-badge");
      if (badge) {
        if (wishlist.length > 0) {
          badge.innerText = wishlist.length;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }
      }
      
      const container = document.getElementById("account-favorites-list");
      if (!container) return;
      
      if (wishlist.length === 0) {
        container.innerHTML = `
          <div class="favorites-empty-state">
            <div class="icon">💛</div>
            <p>Tu lista de favoritos está vacía.</p>
            <p style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
              Presiona el ❤️ en las fotos de los platos en la tienda para guardarlos aquí.
            </p>
            <button class="btn-go-shop" onclick="window.location.href='index.html'">Ir al Menú</button>
          </div>
        `;
        return;
      }
      
      let html = "";
      const catalog = window.CATALOG;
      if (!catalog) {
        console.error("CATALOG not found");
        container.innerHTML = `<div class="favorites-empty-state"><p>Error al cargar el catálogo de productos.</p></div>`;
        return;
      }
      
      wishlist.forEach(productId => {
        let found = null;
        for (const cat of catalog.categories) {
          const item = cat.items.find(i => i.id === productId);
          if (item) {
            found = { item, catId: cat.id };
            break;
          }
        }
        
        if (found) {
          const { item, catId } = found;
          const priceText = item.price ? `$${item.price.toFixed(2)}` : (item.variants?.length > 0 ? `Desde $${item.variants[0].price.toFixed(2)}` : '—');
          
          html += `
            <div class="favorite-card" id="fav-card-${item.id}">
              <img src="${item.image || 'assets/menu/flauta-cochinita.avif'}" alt="${item.name}">
              <div class="favorite-card-body">
                <h4 class="favorite-card-title">${item.name}</h4>
                <p class="favorite-card-desc">${item.description || ''}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                  <span class="favorite-card-price">${priceText}</span>
                </div>
                <div class="favorite-card-actions">
                  <button class="btn-add-cart" onclick="window.addFavToCartAndRedirect('${item.id}', '${catId}')">
                    Ordenar 🌮
                  </button>
                  <button class="btn-remove-fav" onclick="window.removeFavoriteFromDashboard('${item.id}')" title="Eliminar de favoritos">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }
      });
      
      container.innerHTML = html;
    }

    window.removeFavoriteFromDashboard = async function(productId) {
      if (!currentUser || !currentProfile) return;
      
      const wishlist = currentProfile.wishlist || [];
      const index = wishlist.indexOf(productId);
      if (index > -1) {
        wishlist.splice(index, 1);
      }
      
      currentProfile.wishlist = wishlist;
      
      try {
        if (isMock) {
          const userRef = { collection: "users", id: currentUser.uid };
          await dbService.setDoc(userRef, currentProfile);
        } else {
          const userDocRef = doc(dbService, "users", currentUser.uid);
          await setDoc(userDocRef, { wishlist: wishlist }, { merge: true });
        }
        
        updateFavoritesUI();
      } catch (err) {
        console.error("Error removing favorite:", err);
      }
    };

    window.addFavToCartAndRedirect = function(productId, catId) {
      let cart = [];
      const stored = localStorage.getItem('santopadre_checkout');
      let isVip = false;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.items) cart = parsed.items;
          if (parsed && parsed.isVip) isVip = parsed.isVip;
        } catch (e) {
          console.error(e);
        }
      }
      
      const catalog = window.CATALOG;
      let foundItem = null;
      if (catalog) {
        for (const cat of catalog.categories) {
          const item = cat.items.find(i => i.id === productId);
          if (item) {
            foundItem = item;
            break;
          }
        }
      }
      
      if (!foundItem) return;
      
      const defaultVariant = foundItem.hasVariants && foundItem.variants?.length > 0 ? foundItem.variants[0] : null;
      const price = defaultVariant ? defaultVariant.price : (foundItem.price || 0);
      
      const newCartItem = {
        id: productId,
        name: foundItem.name,
        price: price,
        qty: 1,
        selectedVariant: defaultVariant,
        selectedExtras: [],
        instructions: "",
        uniqueId: Date.now() + Math.random().toString(36).substr(2, 9)
      };
      
      const existingIndex = cart.findIndex(i => 
        i.id === productId && 
        (!defaultVariant || (i.selectedVariant && i.selectedVariant.id === defaultVariant.id)) &&
        (!i.selectedExtras || i.selectedExtras.length === 0)
      );
      
      if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
      } else {
        cart.push(newCartItem);
      }
      
      localStorage.setItem('santopadre_checkout', JSON.stringify({
        items: cart,
        isVip: isVip || currentProfile.isVip || false
      }));
      
      window.location.href = "index.html?cart=open";
    };

    window.switchTab = window.switchTopTab;

