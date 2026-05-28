// Windows: コンソールウィンドウを抑止する.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    meeting_slot_picker_pro_lib::run()
}
