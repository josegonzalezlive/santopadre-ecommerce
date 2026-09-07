const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const cors = require("cors")({ origin: true });
const fs = require("fs");
const path = require("path");

// Inicializar Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ==========================================
// 🤖 GOOGLE WALLET PASS GENERATOR
// ==========================================

exports.generateGooglePassUrl = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      // 1. Validar autorización del Token de ID de Firebase
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("No autorizado: Falta token");
      }
      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      // 2. Obtener datos de Firestore en tiempo real
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).send("Usuario no encontrado");
      }
      const profile = userDoc.data();
      const stamps = profile.stamps || 0;
      const name = profile.name || "Cliente SantoPadre";
      const serialNumber = `SP-${userId.substring(0, 8).toUpperCase()}`;

      // 3. Cargar llave de cuenta de servicio de Google
      const keyPath = path.join(__dirname, "google-wallet-key.json");
      if (!fs.existsSync(keyPath)) {
        return res.status(500).send("Falta google-wallet-key.json en el directorio de functions/.");
      }
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

      const issuerId = "3388000000023148970";
      const classId = `${issuerId}.santopadre_loyalty_class`;

      // 4. Crear estructura del objeto LoyaltyObject de Google Wallet
      const loyaltyObject = {
        id: `${issuerId}.${userId}-v2`,
        classId: classId,
        state: "ACTIVE",
        barcode: {
          type: "CODE_128",
          value: serialNumber,
          alternateText: serialNumber
        },
        accountId: serialNumber,
        accountName: name,
        loyaltyPoints: {
          balance: {
            string: `${stamps} de 6`
          },
          label: "Sellos Acumulados"
        },
        secondaryLoyaltyPoints: {
          balance: {
            string: stamps >= 6 ? `¡Recompensa Lista! - ${stamps >= 5 ? 'Nivel 1' : 'Miembro'}` : `Faltan ${6 - stamps} - ${stamps >= 5 ? 'Nivel 1' : 'Miembro'}`
          },
          label: "Estado"
        },
        textModulesData: [
          {
            header: "NIVEL DE RECOMPENSAS",
            body: stamps >= 5 ? "El Iniciado (Nivel 1)" : "Miembro",
            id: "tier_module"
          }
        ]
      };

      // 5. Generar Claims del JWT de guardado
      const claims = {
        iss: serviceAccount.client_email,
        aud: "google",
        origins: ["https://www.santopadre.store", "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:8081", "http://127.0.0.1:8081", "https://localhost:8081"],
        typ: "savetowallet",
        payload: {
          loyaltyObjects: [loyaltyObject]
        }
      };

      // 6. Firmar el JWT usando la llave privada de la cuenta de servicio
      const token = jwt.sign(claims, serviceAccount.private_key, {
        algorithm: "RS256",
        keyid: serviceAccount.private_key_id
      });

      const saveUrl = `https://pay.google.com/gp/v/save/${token}`;
      res.status(200).json({ url: saveUrl });

    } catch (error) {
      console.error("Error generando Google Pass URL:", error);
      res.status(500).send("Error de servidor: " + error.message);
    }
  });
});


// ==========================================
// 🍎 APPLE WALLET PASS GENERATOR (PKPASS)
// ==========================================

exports.generateApplePass = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { PKPass } = require("passkit-generator");

      // 1. Validar autorización del Token de ID de Firebase
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("No autorizado: Falta token");
      }
      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      // 2. Obtener datos
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).send("Usuario no encontrado");
      }
      const profile = userDoc.data();
      const stamps = profile.stamps || 0;
      const name = profile.name || "Cliente SantoPadre";
      const serialNumber = `SP-${userId.substring(0, 8).toUpperCase()}`;

      // 3. Cargar Certificados de Apple
      const certsDir = path.join(__dirname, "certs");
      const wwdrPath = path.join(certsDir, "wwdr.pem");
      const signerCertPath = path.join(certsDir, "signerCert.pem");
      const signerKeyPath = path.join(certsDir, "signerKey.pem");

      if (!fs.existsSync(wwdrPath) || !fs.existsSync(signerCertPath) || !fs.existsSync(signerKeyPath)) {
        return res.status(500).send("Certificados de Apple Wallet no cargados en el servidor en el directorio certs/");
      }

      const wwdr = fs.readFileSync(wwdrPath);
      const signerCert = fs.readFileSync(signerCertPath);
      const signerKey = fs.readFileSync(signerKeyPath);

      // Cargar assets visuales opcionales
      const loadAsset = (fileName) => {
        const p = path.join(__dirname, "assets", fileName);
        return fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);
      };

      const pass = new PKPass({
        "icon.png": loadAsset("icon.png"),
        "logo.png": loadAsset("logo.png"),
        "strip.png": loadAsset("strip.png")
      }, {
        wwdr,
        signerCert,
        signerKey,
        signerKeyPassword: process.env.APPLE_SIGNER_KEY_PASSWORD || ""
      });

      pass.setOrganizationName("SantoPadre®");
      pass.setPassTypeIdentifier("pass.store.santopadre.loyalty");
      pass.setTeamIdentifier("YOUR_TEAM_ID_HERE"); // Reemplazar con el Team ID de Apple
      pass.setSerialNumber(serialNumber);
      
      // Colores corporativos SantoPadre®
      pass.setBackgroundColor("rgb(8, 35, 26)");
      pass.setForegroundColor("rgb(255, 255, 255)");
      pass.setLabelColor("rgb(107, 114, 100)");

      pass.setBarcodes({
        format: "PKBarcodeFormatCode128",
        message: serialNumber,
        messageEncoding: "iso-8859-1",
        altText: serialNumber
      });

      pass.storeCard.addHeader({
        key: "stampsCount",
        label: "TARJETA DE SELLOS",
        value: `${stamps % 5} / 5`
      });

      pass.storeCard.addPrimary({
        key: "logoText",
        label: "",
        value: "SantoPadre®"
      });

      pass.storeCard.addSecondary({
        key: "holder",
        label: "TITULAR",
        value: name
      });

      pass.storeCard.addAuxiliary({
        key: "tier",
        label: "NIVEL",
        value: stamps >= 5 ? "El Iniciado" : "Miembro"
      });

      const buffer = await pass.asBuffer();
      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-Disposition", `attachment; filename="santopadre_${serialNumber}.pkpass"`);
      res.status(200).send(buffer);

    } catch (error) {
      console.error("Error generando Apple Pass:", error);
      res.status(500).send("Error de servidor: " + error.message);
    }
  });
});

// ==========================================
// 🎯 SANTO PADRE CUSTOM FIREBASE FUNCTIONS
// ==========================================

exports.generateReferralLink = require('./referrals').generateReferralLink;
exports.redeemReward = require('./rewards').redeemReward;
exports.claimTierReward = require('./rewards').claimTierReward;
exports.sendComprobanteNotification = require('./notifications').sendComprobanteNotification;
