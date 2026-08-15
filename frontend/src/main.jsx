import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AdminAuthProvider } from "./context/AdminAuthContext.jsx";
import { PhotographerAuthProvider } from "./context/PhotographerAuthContext.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        {/* Three independent auth realms, each with its own storage and axios
            client (see api/realm.js), all mounted together so their routes
            can live side by side without sharing a session. */}
        <AuthProvider>
          <AdminAuthProvider>
            <PhotographerAuthProvider>
              <App />
            </PhotographerAuthProvider>
          </AdminAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
