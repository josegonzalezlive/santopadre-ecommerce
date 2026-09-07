import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Reusing the config object from firebase-config.js
import { getActiveServices } from "../firebase-config.js";

// We extract the config from the existing setup. 
// However, the original firebase-config.js already initializes app, db, auth!
// Let's just wrap and export them cleanly.

let db, auth;

export async function initFirebase() {
  const services = getActiveServices();
  if (services && services.db && services.auth) {
    db = services.db;
    auth = services.auth;
    return { db, auth };
  } else {
    console.error("Firebase not initialized in config yet. Awaiting initialization...");
    // Fallback if we need to initialize it manually here using the config logic:
    return null;
  }
}

export const getDB = () => db;
export const getAuth_ = () => auth;
