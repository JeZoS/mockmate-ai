import React from "react";
import ReactDOM from "react-dom/client";
import LogRocket from "logrocket";
import App from "./App";

// if (import.meta.env.PROD) {
LogRocket.init("sb7wqy/mockmate-ai");
// }

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
