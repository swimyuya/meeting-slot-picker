/**
 * Vercel Function: POST /api/auth/refresh
 * 入力: { refresh_token }
 * 出力: { access_token, expires_in }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { applyCors } from "../_lib/cors.js";
import { loadGoogleConfig, refreshAccessToken } from "../_lib/google.js";

const BodySchema = z.object({
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
    const config = loadGoogleConfig();
    const tokens = await refreshAccessToken({
      config,
      refreshToken: parsed.data.refresh_token,
    });
    res.status(200).json(tokens);
  } catch (e) {
    console.error("[/api/auth/refresh]", e);
    const message = e instanceof Error ? e.message : "internal_error";
    res.status(500).json({ error: "refresh_failed", message });
  }
}
