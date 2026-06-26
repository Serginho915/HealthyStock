import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getHealthIndex } from "../services/healthIndex.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const index = await getHealthIndex();
  return res.json(index);
}));

export default router;
