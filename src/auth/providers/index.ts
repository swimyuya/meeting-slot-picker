/**
 * Provider 仕様の集約。`getProviderSpec("google")` でアクセス。
 */

import { GOOGLE_SPEC } from "./google";
import { MICROSOFT_SPEC } from "./microsoft";
import type { ProviderId, ProviderOAuthSpec } from "./types";

const SPECS: Readonly<Record<ProviderId, ProviderOAuthSpec>> = {
  google: GOOGLE_SPEC,
  microsoft: MICROSOFT_SPEC,
};

export function getProviderSpec(provider: ProviderId): ProviderOAuthSpec {
  return SPECS[provider];
}

export { GOOGLE_SPEC, MICROSOFT_SPEC };
export type { ProviderId, ProviderOAuthSpec, ProviderConfig } from "./types";
export { PROVIDER_IDS } from "./types";
