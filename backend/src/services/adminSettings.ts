import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_MASTER_PROMPT } from "./openrouter.js";

const settingsPath = path.resolve(process.cwd(), "data/admin-settings.json");

export type GenerationFrequency = "manual" | "daily" | "weekly" | "monthly";

export interface AdminSettings {
  masterPrompt: string;
  autoGenerationEnabled: boolean;
  generationTopic: string;
  generationTime: string;
  generationFrequency: GenerationFrequency;
  lastGeneratedAt?: string;
  lastGenerationStatus?: string;
}

export const defaultAdminSettings: AdminSettings = {
  masterPrompt: DEFAULT_MASTER_PROMPT,
  autoGenerationEnabled: false,
  generationTopic: "Evidence-based healthy food research brief",
  generationTime: "09:00",
  generationFrequency: "manual"
};

export async function getAdminSettings(): Promise<AdminSettings> {
  try {
    const data = JSON.parse(await fs.readFile(settingsPath, "utf-8")) as Partial<AdminSettings>;
    return normalizeSettings(data);
  } catch {
    return defaultAdminSettings;
  }
}

export async function updateAdminSettings(nextSettings: AdminSettings): Promise<AdminSettings> {
  const settings = normalizeSettings(nextSettings);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  return settings;
}

export async function patchGenerationStatus(lastGenerationStatus: string, lastGeneratedAt?: string) {
  const settings = await getAdminSettings();
  await updateAdminSettings({
    ...settings,
    lastGenerationStatus,
    lastGeneratedAt: lastGeneratedAt ?? settings.lastGeneratedAt
  });
}

function normalizeSettings(settings: Partial<AdminSettings>): AdminSettings {
  const generationFrequency = ["manual", "daily", "weekly", "monthly"].includes(settings.generationFrequency ?? "")
    ? settings.generationFrequency
    : defaultAdminSettings.generationFrequency;

  return {
    masterPrompt: settings.masterPrompt?.trim() || defaultAdminSettings.masterPrompt,
    autoGenerationEnabled: Boolean(settings.autoGenerationEnabled),
    generationTopic: settings.generationTopic?.trim() || defaultAdminSettings.generationTopic,
    generationTime: /^\d{2}:\d{2}$/.test(settings.generationTime ?? "")
      ? settings.generationTime!
      : defaultAdminSettings.generationTime,
    generationFrequency: generationFrequency as GenerationFrequency,
    lastGeneratedAt: settings.lastGeneratedAt,
    lastGenerationStatus: settings.lastGenerationStatus
  };
}
