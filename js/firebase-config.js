// firebase-config.js — SantoPadre® Firebase Initializer (REAL MODE)

const firebaseConfig = {
  apiKey: "AIzaSyCqk5WKecJxhqoT-74kkuZE_dwH0oQWOFU",
  authDomain: "auth.santopadre.store",
  projectId: "sound-bee-495502-i0",
  storageBucket: "sound-bee-495502-i0.firebasestorage.app",
  messagingSenderId: "170027889930",
  appId: "1:170027889930:web:1d7a38939ba50e8788f6f3",
  measurementId: "G-70XH5V5160"
};

// Site key de reCAPTCHA v3 para Firebase App Check. Se registra en Firebase Console →
// App Check → Apps → Web app → reCAPTCHA v3. Hasta que se reemplace este placeholder,
// App Check queda deshabilitado en el cliente (y el backend sigue sin bloquear nada,
// ya que ENFORCE_APP_CHECK no está activo — ver functions/README.md).
let RECAPTCHA_V3_SITE_KEY = "YOUR_RECAPTCHA_V3_SITE_KEY";

// Intentar leer credenciales guardadas en LocalStorage (para configuración dinámica desde el Admin sin tocar código)
const savedConfigStr = localStorage.getItem("santopadre_firebase_config");
if (savedConfigStr) {
  try {
    const savedConfig = JSON.parse(savedConfigStr);
    if (savedConfig && savedConfig.apiKey && !savedConfig.apiKey.includes("YOUR_")) {
      Object.assign(firebaseConfig, savedConfig);
      console.log("ℹ️ Firebase: Cargando configuración dinámica desde LocalStorage.");
    }
    if (savedConfig && savedConfig.recaptchaSiteKey && !savedConfig.recaptchaSiteKey.includes("YOUR_")) {
      RECAPTCHA_V3_SITE_KEY = savedConfig.recaptchaSiteKey;
    }
  } catch (e) {
    console.error("Error cargando configuración dinámica de Firebase:", e);
  }
}

let app = null;
let auth = null;
let db = null;
let functionsService = null;
let googleProvider = null;
let signInWithPopupFunc = null;
let isMock = false;

// Validar si las credenciales son las por defecto
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_")) {
  console.error("🚨 ATENCIÓN: Firebase no está configurado. Por favor, ingresa tus credenciales reales en js/firebase-config.js o a través del Panel de Administrador.");
  // Mostramos una alerta al usuario/admin de que falta configuración, pero NO usamos Mock.
}

try {
  // Importamos los SDKs desde CDN oficial
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
  const { getFunctions } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js");

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functionsService = getFunctions(app);
  googleProvider = new GoogleAuthProvider();
  signInWithPopupFunc = signInWithPopup;

  // App Check: adjunta un token de atestación a cada llamada a Functions/Firestore
  // hecha desde esta instancia de `app`, sin tocar el resto del código (los SDKs lo
  // hacen automáticamente). Sigue siendo opt-in en el cliente porque el backend no
  // bloquea nada hasta que ENFORCE_APP_CHECK=true se active en Cloud Functions.
  if (RECAPTCHA_V3_SITE_KEY && !RECAPTCHA_V3_SITE_KEY.includes("YOUR_")) {
    const isLocalHost = ["localhost", "127.0.0.1"].includes(location.hostname);
    if (isLocalHost) {
      // Token de depuración: evita que App Check bloquee desarrollo local. Se genera
      // una vez por navegador y hay que autorizarlo manualmente en Firebase Console →
      // App Check → Apps → ⋮ → "Manage debug tokens".
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const { initializeAppCheck, ReCaptchaV3Provider } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js");
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    console.log("✅ Firebase App Check inicializado (reCAPTCHA v3).");
  } else {
    console.warn("⚠️ Firebase App Check: falta configurar RECAPTCHA_V3_SITE_KEY en js/firebase-config.js. El cliente sigue funcionando sin atestación.");
  }
} catch (error) {
  console.error("🚨 Error inicializando Firebase real:", error);
}

// Exportar servicios unificados
export const getActiveServices = () => {
  return {
    auth,
    db,
    functions: functionsService,
    googleProvider,
    signInWithPopup: signInWithPopupFunc,
    isMock: false
  };
};
