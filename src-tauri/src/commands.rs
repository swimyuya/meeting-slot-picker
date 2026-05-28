//! Tauri コマンド: フロントエンドから呼ばれるエンドポイント群.
//!
//! 秘密情報 (Google refresh_token など) は macOS Keychain に保存する.
//! plugin-store は暗号化されないため、秘密情報には使わない.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

/// Keychain のサービス名 (アプリ identifier と一致させる).
const SERVICE: &str = "com.unveil.meeting-slot-picker";

/// 秘密情報を Keychain に保存する.
#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

/// 秘密情報を取得する. 未保存なら Ok(None) を返す (NoEntry はエラーにしない).
#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// 秘密情報を削除する (連携解除用). 未保存でもエラーにしない.
#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// OAuth ループバック: 127.0.0.1:port で待ち受け、ブラウザを開き、
/// リダイレクトの認可コードを返す。ブロッキング I/O はワーカースレッドで実行する。
#[tauri::command]
pub async fn oauth_capture_code(
    port: u16,
    auth_url: String,
    expected_state: String,
    timeout_secs: u64,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        capture_code_blocking(port, auth_url, expected_state, timeout_secs)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn capture_code_blocking(
    port: u16,
    auth_url: String,
    expected_state: String,
    timeout_secs: u64,
) -> Result<String, String> {
    // ブラウザを開く前にバインドして取りこぼしを防ぐ。
    let listener = TcpListener::bind(("127.0.0.1", port))
        .map_err(|e| format!("ポート {port} のバインドに失敗: {e}"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    open_in_browser(&auth_url);

    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        match listener.accept() {
            Ok((stream, _)) => return handle_redirect(stream, &expected_state),
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline {
                    return Err("OAuth がタイムアウトしました".into());
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

/// 1リクエストを読み取り、認可コードを取り出し、完了ページを返す。
/// state を検証して CSRF を防ぐ。
fn handle_redirect(mut stream: TcpStream, expected_state: &str) -> Result<String, String> {
    // accept したストリームはブロッキングに固定し、タイムアウト付きで読み切る。
    stream.set_nonblocking(false).map_err(|e| e.to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;

    // HTTP リクエストはヘッダ終端 (\r\n\r\n) まで複数 read に分かれることがある。
    let mut buf = [0u8; 8192];
    let mut total = 0;
    while total < buf.len() {
        match stream.read(&mut buf[total..]) {
            Ok(0) => break,
            Ok(n) => {
                total += n;
                if buf[..total].windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            Err(e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                break
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    let request = String::from_utf8_lossy(&buf[..total]);
    let code = parse_query_param(&request, "code");
    let state = parse_query_param(&request, "state");

    let html = "<!doctype html><meta charset=utf-8><body style=\"font-family:sans-serif;text-align:center;padding:3rem\"><h2>認可が完了しました。アプリに戻ってください。</h2></body>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.as_bytes().len(),
        html
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    match (code, state) {
        (Some(c), Some(s)) if s == expected_state => Ok(c),
        (Some(_), Some(_)) => Err("state が一致しません (CSRF の可能性があります)".to_string()),
        (Some(_), None) => Err("リダイレクトに state がありません".to_string()),
        _ => Err("リダイレクトに認可コードが含まれていません".to_string()),
    }
}

/// OS のデフォルトブラウザで URL を開く。
fn open_in_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

/// リクエスト先頭行 "GET /?code=XYZ&state=... HTTP/1.1" から指定パラメータを取り出す (純粋関数)。
fn parse_query_param(request: &str, name: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        if kv.next() == Some(name) {
            return kv.next().map(percent_decode);
        }
    }
    None
}

/// 認可コードに現れる %XX と + を処理する最小限の percent-decode。
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                match (hi, lo) {
                    (Some(hi), Some(lo)) => {
                        out.push((hi * 16 + lo) as u8);
                        i += 3;
                    }
                    _ => {
                        out.push(bytes[i]);
                        i += 1;
                    }
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::parse_query_param;

    #[test]
    fn parses_code_from_request_line() {
        let req = "GET /?code=4/0AY0e-abc123&scope=calendar HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
        assert_eq!(parse_query_param(req, "code").as_deref(), Some("4/0AY0e-abc123"));
    }

    #[test]
    fn parses_state_param() {
        let req = "GET /?code=abc&state=xyz-123 HTTP/1.1\r\n\r\n";
        assert_eq!(parse_query_param(req, "state").as_deref(), Some("xyz-123"));
    }

    #[test]
    fn returns_none_when_no_code() {
        let req = "GET /?error=access_denied HTTP/1.1\r\n\r\n";
        assert_eq!(parse_query_param(req, "code"), None);
    }

    #[test]
    fn percent_decodes_code() {
        let req = "GET /?code=a%2Fb%2Bc HTTP/1.1\r\n\r\n";
        assert_eq!(parse_query_param(req, "code").as_deref(), Some("a/b+c"));
    }
}
