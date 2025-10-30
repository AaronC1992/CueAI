// server/routes/admin.js
import { Router } from "express";
import { syncSoundsToChroma } from "../controllers/chromaController.js";

const router = Router();

router.post("/sync-chroma", syncSoundsToChroma);

export default router;
