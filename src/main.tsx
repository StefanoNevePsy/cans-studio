import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerAndroidBackGesture } from "./capacitorBackButton";
import "./styles.css";

registerAndroidBackGesture();

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
