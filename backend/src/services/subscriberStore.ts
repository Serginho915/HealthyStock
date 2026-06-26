import { promises as fs } from "node:fs";
import path from "node:path";
import { Subscriber } from "../types.js";

const filePath = path.resolve(process.cwd(), "data/subscribers.json");

async function readAll(): Promise<Subscriber[]> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as Subscriber[];
  } catch {
    return [];
  }
}

export async function addSubscriber(email: string, source: string): Promise<boolean> {
  const subscribers = await readAll();
  const exists = subscribers.some((s) => s.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return false;
  }

  subscribers.push({
    email,
    source,
    createdAt: new Date().toISOString()
  });

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(subscribers, null, 2), "utf-8");
  return true;
}
