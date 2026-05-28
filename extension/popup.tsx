/**
 * Chrome 拡張機能ポップアップのエントリ。
 * src/main.tsx と同等だが、Tailwind CSS パスを相対で取り込み、ポップアップに最適化。
 * App コンポーネント側で /auth/callback ルートは Web のみ使われるため、拡張では
 * 通常の MainApp パスに流れる。
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "../src/App";
import "../src/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
