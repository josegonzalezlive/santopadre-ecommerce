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

// Intentar leer credenciales guardadas en LocalStorage (para configuración dinámica desde el Admin sin tocar código)
const savedConfigStr = localStorage.getItem("santopadre_firebase_config");
if (savedConfigStr) {
  try {
    const savedConfig = JSON.parse(savedConfigStr);
    if (savedConfig && savedConfig.apiKey && !savedConfig.apiKey.includes("YOUR_")) {
      Object.assign(firebaseConfig, savedConfig);
      console.log("ℹ️ Firebase: Cargando configuración dinámica desde LocalStorage.");
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
