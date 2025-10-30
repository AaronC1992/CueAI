// server/controllers/chromaController.js
import chromaCollectionPromise from "../config/chroma.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const syncSoundsToChroma = async (req, res) => {
  try {
    const collection = await chromaCollectionPromise;

    // read the local sound catalog
    const catalogPath = path.join(__dirname, "..", "soundCatalog.json");
    const raw = fs.readFileSync(catalogPath, "utf-8");
    const sounds = JSON.parse(raw);

    // make arrays for Chroma
    const ids = [];
    const documents = [];
    const metadatas = [];

    for (const s of sounds) {
      ids.push(s.id);
      // document is what we want to match against later
      documents.push(
        `${s.id} ${s.type || ""} ${Array.isArray(s.tags) ? s.tags.join(" ") : ""}`
      );
      metadatas.push({
        type: s.type || "sfx",
        tags: Array.isArray(s.tags) ? s.tags.join(",") : "", // Convert array to comma-separated string
        src: s.src || "",
      });
    }

    await collection.add({
      ids,
      documents,
      metadatas,
    });

    res.json({
      message: "Synced sounds to Chroma",
      count: sounds.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sync to Chroma", details: err.message });
  }
};
