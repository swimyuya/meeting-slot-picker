/**
 * OAuth token endpoint への form POST + エラー整形 (google.ts / microsoft.ts 共通)。
 *
 * 上流のエラーは `${label} ${op} failed: ${err} ${desc}` 形式に整形して throw する
 * (呼び出し元ハンドラが message だけログし、クライアントには汎用エラーを返す前提)。
 */

export async function postTokenRequest(args: {
  endpoint: string;
  label: "google" | "microsoft";
  op: "token exchange" | "refresh";
  body: URLSearchParams;
  fetchFn?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const fetchFn = args.fetchFn ?? fetch;
  const res = await fetchFn(args.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: args.body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const desc = typeof json.error_description === "string" ? json.error_description : "";
    const err = typeof json.error === "string" ? json.error : `http_${res.status}`;
    throw new Error(`${args.label} ${args.op} failed: ${err} ${desc}`.trim());
  }
  return json;
}
