// 外観 (dark クラス) をマウント前に適用してちらつきを防ぐ — 最初に import すること
import "./lib/appearance-boot";

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
