import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import './i18n';

// Suppress ResizeObserver loop error (benign error that doesn't affect functionality)
const resizeObserverErrorHandler = (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay');
    const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay-div');
    if (resizeObserverErr) {
      resizeObserverErr.setAttribute('style', 'display: none');
    }
    if (resizeObserverErrDiv) {
      resizeObserverErrDiv.setAttribute('style', 'display: none');
    }
  }
};

window.addEventListener('error', resizeObserverErrorHandler);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
