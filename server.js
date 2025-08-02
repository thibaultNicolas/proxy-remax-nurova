require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const iconv = require("iconv-lite");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

// Récupérer la clé API depuis .env
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error(
    "Erreur : La clé API n'est pas définie dans le fichier .env (API_KEY)"
  );
  process.exit(1);
}

// Middleware de sécurité HTTP
app.use(helmet());

// Limiter à 100 requêtes par IP toutes les 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requêtes
  standardHeaders: true, // retourner les headers RateLimit
  legacyHeaders: false,
});
app.use(limiter);

// Activer CORS (ouvrir à tous, tu peux restreindre le origin si besoin)
app.use(cors());

// Middleware d'authentification simple via clé API dans la query string
app.use((req, res, next) => {
  const key = req.query.api_key;
  if (!key || key !== API_KEY) {
    return res
      .status(401)
      .json({ error: "Accès non autorisé : clé API manquante ou invalide." });
  }
  next();
});

app.get("/proxy-remax", async (req, res) => {
  const {
    type = "agent",
    id = "17248",
    lang = "fr",
    page = "1",
    qty = "10",
    order = "prix",
    direction = "desc",
    filter = "",
  } = req.query;

  const remaxUrl =
    `https://www.remax-quebec.com/RMXServices/strateo/getInscriptions/call.do?` +
    `type=${encodeURIComponent(type)}&id=${encodeURIComponent(
      id
    )}&lang=${encodeURIComponent(lang)}` +
    `&page=${encodeURIComponent(page)}&qty=${encodeURIComponent(qty)}` +
    `&order=${encodeURIComponent(order)}&direction=${encodeURIComponent(
      direction
    )}` +
    `&filter=${encodeURIComponent(filter)}`;

  try {
    // Requête HTTP avec réponse en arraybuffer pour gérer encodage
    const response = await axios.get(remaxUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    // Lecture du charset dans l'en-tête Content-Type
    const contentType = response.headers["content-type"] || "";
    const charsetMatch = contentType.match(/charset=([^;]+)/i);
    const charset = charsetMatch ? charsetMatch[1].toLowerCase() : "utf-8";

    // Conversion en UTF-8 si besoin
    let dataUtf8;
    if (charset !== "utf-8" && charset !== "utf8") {
      dataUtf8 = iconv.decode(Buffer.from(response.data), charset);
    } else {
      dataUtf8 = response.data.toString("utf-8");
    }

    // Réponse au client avec header XML et charset UTF-8
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.send(dataUtf8);
  } catch (error) {
    if (error.response) {
      return res
        .status(error.response.status)
        .send(`Erreur API RE/MAX : ${error.response.statusText}`);
    }
    if (error.code === "ECONNABORTED") {
      return res.status(504).send("Erreur : délai d’attente API dépassé");
    }
    return res.status(500).send("Erreur interne du proxy RE/MAX");
  }
});

app.listen(PORT, () => {
  console.log(`Proxy RE/MAX sécurisé démarré sur le port ${PORT}`);
});
