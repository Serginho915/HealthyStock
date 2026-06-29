import { Router } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { consumeRateLimit } from "../services/rateLimit.js";
import { addSubscriber } from "../services/subscriberStore.js";

const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.string().min(1).max(100).optional()
});

const router = Router();

async function sendWelcomeEmail(email: string): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "HealthyStock: подписка подтверждена",
    html: `
      <h1>Добро пожаловать в HealthyStock</h1>
      <p>Теперь вы в рассылке Maria Iordanova.</p>
      <p>Будем отправлять разборы продуктов, нутриентов и практичные апгрейды здоровья.</p>
    `
  });
}

router.post("/", asyncHandler(async (req, res) => {
  const limit = await consumeRateLimit(req.ip ?? "unknown", {
    keyPrefix: "subscribe_ip",
    points: 10,
    durationSeconds: 60 * 60
  });
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(limit.msBeforeNext / 1000)));
    return res.status(429).json({ message: "Too many subscription attempts. Try again later." });
  }

  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const { email, source = "homepage" } = parsed.data;
  const added = await addSubscriber(email, source);

  if (!added) {
    return res.status(200).json({ message: "Already subscribed" });
  }

  await sendWelcomeEmail(email).catch((error) => {
    console.error("Failed to send welcome email", error);
  });
  return res.status(201).json({ message: "Subscribed" });
}));

export default router;
