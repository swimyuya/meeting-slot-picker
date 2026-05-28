/**
 * Provider 仕様の集約。`getProviderSpec("google")` でアクセス。
 */

import { APPLE_SPEC } from "./apple";
import { GOOGLE_SPEC } from "./google";
import { MICROSOFT_SPEC } from "./microsoft";
import type {
  AppleCredentialSpec,
  ProviderId,
  ProviderOAuthSpec,
  ProviderSpec,
} from "./types";

const SPECS: Readonly<Record<ProviderId, ProviderSpec>> = {
  google: GOOGLE_SPEC,
  microsoft: MICROSOFT_SPEC,
  apple: APPLE_SPEC,
};

export function getProviderSpec(provider: ProviderId): ProviderSpec {
  return SPECS[provider];
}

/** OAuth provider に narrow する getProviderSpec (oauth.ts 等で使う)。 */
export function getOAuthProviderSpec(provider: "google" | "microsoft"): ProviderOAuthSpec {
  return SPECS[provider] as ProviderOAuthSpec;
}

/** Apple spec を取得 (型を狭めて返す)。 */
export function getAppleSpec(): AppleCredentialSpec {
  return APPLE_SPEC;
}

export { APPLE_SPEC, GOOGLE_SPEC, MICROSOFT_SPEC };
export type {
  AppleCredentialSpec,
  ProviderConfig,
  ProviderId,
  ProviderOAuthSpec,
  ProviderSpec,
  OAuthProviderId,
} from "./types";
export { OAUTH_PROVIDER_IDS, PROVIDER_IDS, isOAuthProvider } from "./types";
