/**
 * Vercel Function: POST /api/auth/exchange
 * 入力: { provider?: "google"|"microsoft", code, code_verifier, redirect_uri }
 * 出力: { access_token, refresh_token, expires_in, id_token? }
 *
 * provider 未指定なら "google" 既定 (Pro 版以前のクライアント後方互換)。
 * client_secret はサーバ側のみで使用。
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { applyCors } from "../_lib/cors.js";
import { exchangeAuthCode, loadGoogleConfig } from "../_lib/google.js";
import {
  exchangeMicrosoftAuthCode,
  loadMicrosoftConfig,
} from "../_lib/microsoft.js";

const BodySchema = z.object({
  provider: z.enum(["google", "microsoft"]).optional().default("google"),
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
    const { provider, code, code_verifier, redirect_uri } = parsed.data;
    if (provider === "microsoft") {
      const config = loadMicrosoftConfig();
      const tokens = await exchangeMicrosoftAuthCode({
        config,
        code,
        codeVerifier: code_verifier,
        redirectUri: redirect_uri,
      });
      res.status(200).json(tokens);
      return;
    }
    const config = loadGoogleConfig();
    const tokens = await exchangeAuthCode({
      config,
      code,
      codeVerifier: code_verifier,
      redirectUri: redirect_uri,
    });
    res.status(200).json(tokens);
  } catch (e) {
    console.error("[/api/auth/exchange]", e);
    const message = e instanceof Error ? e.message : "internal_error";
    res.status(500).json({ error: "exchange_failed", message });
  }
}
