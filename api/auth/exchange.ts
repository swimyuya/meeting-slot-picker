/**
 * Vercel Function: POST /api/auth/exchange
 * 入力: { code, code_verifier, redirect_uri }
 * 出力: { access_token, refresh_token, expires_in }
 *
 * Web フロント (PWA) からのみ呼ばれる。client_secret はサーバ側のみで使用。
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { applyCors } from "../_lib/cors";
import { exchangeAuthCode, loadGoogleConfig } from "../_lib/google";

const BodySchema = z.object({
  code: z.string().min(1).max(2048),
  code_verifier: z.string().min(43).max(128),
  redirect_uri: z.string().url().max(512),
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
    const config = loadGoogleConfig();
    const tokens = await exchangeAuthCode({
      config,
      code: parsed.data.code,
      codeVerifier: parsed.data.code_verifier,
      redirectUri: parsed.data.redirect_uri,
    });
    res.status(200).json(tokens);
  } catch (e) {
    // 詳細はサーバログのみに残し、クライアントには汎用エラー
    console.error("[/api/auth/exchange]", e);
    const message = e instanceof Error ? e.message : "internal_error";
    res.status(500).json({ error: "exchange_failed", message });
  }
}
