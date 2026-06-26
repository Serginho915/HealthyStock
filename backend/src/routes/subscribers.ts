import { Router } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
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

router.post("/", async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const { email, source = "homepage" } = parsed.data;
  const added = await addSubscriber(email, source);

  if (!added) {
    return res.status(200).json({ message: "Already subscribed" });
  }

  await sendWelcomeEmail(email);
  return res.status(201).json({ message: "Subscribed" });
});

export default router;
