import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Corrected module import path, although the original error was due to App.tsx's content.
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);