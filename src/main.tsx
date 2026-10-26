import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registrarServiceWorker } from "./lib/zip";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void registrarServiceWorker();
