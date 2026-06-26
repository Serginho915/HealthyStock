import { Router } from "express";
import { getHealthIndex } from "../services/healthIndex.js";

const router = Router();

router.get("/", async (_req, res) => {
  const index = await getHealthIndex();
  return res.json(index);
});

export default router;
