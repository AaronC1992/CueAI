// server/config/chroma.js
import dotenv from "dotenv";
import { CloudClient } from "chromadb";

dotenv.config();

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE,
});

// for CueAI we want a stable name:
const COLLECTION_NAME = process.env.CHROMA_COLLECTION || "cueai-sounds";

const chromaCollectionPromise = client.getOrCreateCollection({
  name: COLLECTION_NAME,
  metadata: { app: "CueAI", type: "sounds" },
});

export default chromaCollectionPromise;
