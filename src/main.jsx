import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/*
  Connexion à la vraie base de données Supabase, partagée par tous les visiteurs.
  Remplace le stockage local du navigateur.
*/
const SUPABASE_URL = "https://evtitqgtujquxpgrhrjt.supabase.co";
const SUPABASE_KEY = "sb_publishable_jmxE0ug7aPLXjnTqgbkOsA_1HxvNd0A";
const REST = `${SUPABASE_URL}/rest/v1/kv_store`;
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

window.storage = {
  async get(key) {
    const res = await fetch(`${REST}?key=eq.${encodeURIComponent(key)}&select=value`, { headers: HEADERS });
    const rows = await res.json();
    if (!rows.length) throw new Error("not found");
    return { key, value: rows[0].value, shared: true };
  },
  async set(key, value) {
    await fetch(`${REST}?on_conflict=key`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
    return { key, value, shared: true };
  },
  async delete(key) {
    await fetch(`${REST}?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: HEADERS });
    return { key, deleted: true, shared: true };
  },
  async list(prefix = "") {
    const res = await fetch(`${REST}?key=like.${encodeURIComponent(prefix)}*&select=key`, { headers: HEADERS });
    const rows = await res.json();
    return { keys: rows.map((r) => r.key), prefix, shared: true };
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
