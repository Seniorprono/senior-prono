import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/*
  Remplace le stockage propre à Claude par un stockage réel dans le navigateur
  (localStorage), pour que le site fonctionne une fois publié en dehors de Claude.
  NOTE IMPORTANTE : localStorage stocke les données dans le navigateur de CHAQUE
  visiteur séparément — les membres et paiements ne seront donc pas vraiment
  partagés entre tous tes visiteurs (un client ne verra pas les comptes créés par
  un autre). Pour un vrai site public multi-utilisateurs, il faudra brancher une
  vraie base de données en ligne (ex : Supabase) à la place de ce polyfill.
*/
window.storage = {
  async get(key) {
    const raw = localStorage.getItem("sp:" + key);
    if (raw === null) throw new Error("not found");
    return { key, value: raw, shared: true };
  },
  async set(key, value) {
    localStorage.setItem("sp:" + key, value);
    return { key, value, shared: true };
  },
  async delete(key) {
    localStorage.removeItem("sp:" + key);
    return { key, deleted: true, shared: true };
  },
  async list(prefix = "") {
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith("sp:" + prefix))
      .map((k) => k.slice(3));
    return { keys, prefix, shared: true };
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
