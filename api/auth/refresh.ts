/**
 * Vercel Function: POST /api/auth/refresh
 * 入力: { provider?: "google"|"microsoft", refresh_token }
 * 出力: { access_token, expires_in, refresh_token?, id_token? }
 *
 * Microsoft は rotating refresh_token を返すことがある → クライアントへ返却して
 * クライアント側で再保存させる (token.ts 側で実装済み)。
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { applyCors } from "../_lib/cors.js";
import { loadGoogleConfig, refreshAccessToken } from "../_lib/google.js";
import {
  loadMicrosoftConfig,
  refreshMicrosoftAccessToken,
} from "../_lib/microsoft.js";

const BodySchema = z.object({
  provider: z.enum(["google", "microsoft"]).optional().default("google"),
  refresh_token: z.string().min(1).max(2048),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }
  try {
    const { provider, refresh_token } = parsed.data;
    if (provider === "microsoft") {
      const config = loadMicrosoftConfig();
      const tokens = await refreshMicrosoftAccessToken({ config, refreshToken: refresh_token });
      res.status(200).json(tokens);
      return;
    }
    const config = loadGoogleConfig();
    const tokens = await refreshAccessToken({ config, refreshToken: refresh_token });
    res.status(200).json(tokens);
  } catch (e) {
    // 例外オブジェクト全体ではなく message のみログに残す (機密情報の漏洩を防ぐ)。
    console.error("[/api/auth/refresh]", e instanceof Error ? e.message : "unknown");
    // クライアントには汎用エラーのみ返す。
    res.status(500).json({ error: "refresh_failed" });
  }
}
