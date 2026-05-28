/**
 * アプリ設定 (AppConfig)。Zod で検証し、Tauri では plugin-store、
 * それ以外 (テスト・ブラウザ) では localStorage に永続化する。
 *
 * 秘密情報 (refresh_token 等) はここには保存しない (lib/secrets.ts / Keychain を使う)。
 */

import { z } from "zod";
import { isTauri } from "./tauri";

export const AppConfigSchema = z
  .object({
    startHour: z.number().int().min(0).max(23).default(9),
    endHour: z.number().int().min(1).max(24).default(18),
    weekdaysOnly: z.boolean().default(true),
    daysAhead: z.number().int().positive().max(60).default(14),
    calendarId: z.string().min(1).default("primary"),
    timeZone: z.string().default("Asia/Tokyo"),
    template: z.string().default("{date}（{wday}）{ranges}"),
    rangeSeparator: z.string().default(" / "),
    shortcut: z.string().default("CmdOrControl+Shift+U"),
  })
  .refine((c) => c.endHour > c.startHour, {
    message: "endHour は startHour より大きくしてください",
    path: ["endHour"],
  });

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const DEFAULT_CONFIG: AppConfig = AppConfigSchema.parse({});

const STORE_FILE = "settings.json";
const CONFIG_KEY = "config";
const LS_KEY = "meeting-slot-picker:config";

/** 設定を読み込む。未保存・不正値は既定にフォールバック。 */
export async function loadConfig(): Promise<AppConfig> {
  const raw = isTauri() ? await readFromStore() : readFromLocalStorage();
  return parseConfig(raw);
}

/** 設定を検証して保存する。 */
export async function saveConfig(config: AppConfig): Promise<void> {
  const valid = AppConfigSchema.parse(config); // 不正値は例外で弾く
  if (isTauri()) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE);
    await store.set(CONFIG_KEY, valid);
    await store.save();
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LS_KEY, JSON.stringify(valid));
  }
}

function parseConfig(raw: unknown): AppConfig {
  const result = AppConfigSchema.safeParse(raw ?? {});
  if (result.success) return result.data;
  // 握りつぶさず警告し、既定値で継続する。
  console.warn("[config] 不正な保存値を検出、既定値を使用します:", result.error.message);
  return DEFAULT_CONFIG;
}

async function readFromStore(): Promise<unknown> {
  const { load } = await import("@tauri-apps/plugin-store");
  const store = await load(STORE_FILE);
  return (await store.get<unknown>(CONFIG_KEY)) ?? {};
}

function readFromLocalStorage(): unknown {
  if (typeof localStorage === "undefined") return {};
  const s = localStorage.getItem(LS_KEY);
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
