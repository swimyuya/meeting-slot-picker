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

/**
 * 許可する redirect_uri の allowlist (実行時 env 評価)。
 * - ALLOWED_REDIRECT_URIS (env, カンマ区切り) で複数指定可能
 *   例: "https://meeting-slot-picker-pro.vercel.app/auth/callback,https://app.example.com/auth/callback"
 * - chrome-extension の OAuth 用 `https://<id>.chromiumapp.org/` も EXTENSION_ID 由来で許可
 * - Tauri ループバック http://127.0.0.1:PORT は固定パターンで許可
 */
const LOOPBACK_RE = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/?$/;

function getAllowedRedirectUris(): Set<string> {
  const set = new Set(
    (process.env.ALLOWED_REDIRECT_URIS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const extId = (process.env.EXTENSION_ID ?? "").trim();
  if (extId && /^[a-p]{32}$/i.test(extId)) {
    set.add(`https://${extId}.chromiumapp.org/`);
  }
  return set;
}

function isAllowedRedirectUri(uri: string): boolean {
  if (getAllowedRedirectUris().has(uri)) return true;
  if (LOOPBACK_RE.test(uri)) return true;
  return false;
}

const BodySchema = z.object({
  provider: z.enum(["google", "microsoft"]).optional().default("google"),
  code: z.string().min(1).max(2048),
  code_verifier: z.string().min(43).max(128),
  redirect_uri: z
    .string()
    .url()
    .max(512)
    .refine(isAllowedRedirectUri, {
      message: "redirect_uri is not in the allowlist",
    }),
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
    // 例外オブジェクト全体ではなく message のみログに残す (Google/MS の
    // error_description にはアカウント情報が含まれることがあるため)。
    console.error("[/api/auth/exchange]", e instanceof Error ? e.message : "unknown");
    // クライアントには汎用エラーのみ返す (内部詳細を露出しない)。
    res.status(500).json({ error: "exchange_failed" });
  }
}
