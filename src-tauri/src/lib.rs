//! 日程ピッカー — Tauri エントリポイント.
//!
//! メニューバー常駐 (Dock アイコンなし)。グローバルショートカット Ctrl+Shift+U と
//! トレイアイコンのクリックでポップアップウィンドウをトグルする.

mod commands;

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::ShortcutState;

/// メインウィンドウのラベル (tauri.conf.json と一致させる).
const MAIN_WINDOW: &str = "main";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            // 登録自体は JS 側 useShortcut が config.shortcut に従って行う。
            // どのショートカットが押されてもこの単一ハンドラがトグルを実行する。
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_popup(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::secret_set,
            commands::secret_get,
            commands::secret_delete,
            commands::oauth_capture_code
        ])
        .setup(|app| {
            // Dock アイコンを隠してメニューバー常駐にする (macOS のみ).
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // トレイアイコン: 左クリックでポップアップをトグル.
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("default window icon missing")?;
            TrayIconBuilder::with_id("tray")
                .icon(icon)
                .tooltip("日程ピッカー (Ctrl+Shift+U)")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popup(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// メインウィンドウの表示/非表示をトグルする.
fn toggle_popup<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    if matches!(window.is_visible(), Ok(true)) {
        let _ = window.hide();
    } else {
        // 先に show() してから配置する。非表示ウィンドウの current_monitor() は
        // None を返し位置計算がスキップされてしまうため (左端が画面外に残る原因)。
        let _ = window.show();
        position_near_menu_bar(&window);
        let _ = window.set_focus();
    }
}

/// ウィンドウを画面右上 (メニューバー直下) に配置する.
/// マルチモニタ・ノッチ環境を考慮し、論理座標で算出してクランプする.
fn position_near_menu_bar<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let monitor = match window.current_monitor() {
        Ok(Some(m)) => m,
        _ => match window.primary_monitor() {
            Ok(Some(m)) => m,
            _ => return,
        },
    };
    let scale = monitor.scale_factor();
    let screen_w = monitor.size().width as f64 / scale;
    let Ok(win) = window.outer_size() else {
        return;
    };
    let win_w = win.width as f64 / scale;
    let margin = 12.0_f64;
    let top = 8.0_f64;
    let x = popup_x(screen_w, win_w, margin);
    let _ = window.set_position(tauri::LogicalPosition::new(x, top));
}

/// ポップアップの x 座標 (論理) を算出する。
/// 画面右端から margin の余白を取り、ウィンドウが画面外 (負) に出ないようクランプする。
fn popup_x(screen_w: f64, win_w: f64, margin: f64) -> f64 {
    (screen_w - win_w - margin).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::popup_x;

    #[test]
    fn popup_x_places_window_near_right_edge() {
        // 画面幅1440・窓880・余白12 → 548。
        assert_eq!(popup_x(1440.0, 880.0, 12.0), 548.0);
    }

    #[test]
    fn popup_x_clamps_to_zero_when_wider_than_screen() {
        assert_eq!(popup_x(800.0, 900.0, 12.0), 0.0);
    }
}
