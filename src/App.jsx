import React, { useState, useEffect, useCallback } from "react";
import { Lock, Check, Ticket, ShieldCheck, TrendingUp, Target, Layers, X, LogOut, Settings, Plus, Trash2, Clock, ChevronRight, Copy, CheckCircle2 } from "lucide-react";

/* ---------------------------------------------------------
   CONFIG
--------------------------------------------------------- */
const TIERS = {
  free: { key: "free", label: "Gratuit", tagline: "5 matchs / jour", limit: 5, price: 0, period: null, accent: "#8FBFA8" },
  vip: { key: "vip", label: "VIP HT-FT", tagline: "3 matchs / jour", limit: 3, price: 11200, period: "semaine", accent: "#C9A227" },
  exact: { key: "exact", label: "Score Exact", tagline: "2 matchs / jour", limit: 2, price: 19300, period: "semaine", accent: "#B23A2E" },
  combo: { key: "combo", label: "Combiné x8", tagline: "8 matchs combinés", limit: 8, price: 16100, period: "semaine", accent: "#35B08F" },
};
const ADMIN_PASSWORD = "SP-2026-Stade!74"; // à changer avant mise en ligne, garde-le secret
const MOBILE_MONEY = [
  { operateur: "Orange Money", numero: "07 05 19 83 09" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function fmtFCFA(n) {
  return n.toLocaleString("fr-FR") + " FCFA";
}
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return String(h);
}

/* ---------------------------------------------------------
   STORAGE HELPERS (shared = visible à tous, personal = privé au device)
--------------------------------------------------------- */
async function getShared(key, fallback) {
  try {
    const r = await window.storage.get(key, true);
    return r ? JSON.parse(r.value) : fallback;
  } catch { return fallback; }
}
async function setShared(key, value) {
  await window.storage.set(key, JSON.stringify(value), true);
}

/* ---------------------------------------------------------
   TICKET CARD — élément signature : coupon perforé façon bulletin
--------------------------------------------------------- */
function TicketNotches({ bg }) {
  return (
    <>
      <div style={{ position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", width: 20, height: 20, borderRadius: "50%", background: bg }} />
      <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", width: 20, height: 20, borderRadius: "50%", background: bg }} />
    </>
  );
}

function MatchTicket({ m, tierKey, accent, locked }) {
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: "#F3ECD8", color: "#1A1A1A" }}>
      <div className="px-4 pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase" style={{ color: accent }}>
          <Clock size={12} strokeWidth={3} />
          {m.heure || "--:--"}
        </div>
        <div className="text-[10px] font-bold tracking-widest uppercase opacity-50">Coupon</div>
      </div>
      <div className="px-4 pb-3">
        <div className={`font-black uppercase tracking-tight text-[17px] leading-tight ${locked ? "blur-sm select-none" : ""}`}>
          {locked ? "Équipe A vs Équipe B" : m.match}
        </div>
      </div>
      <div className="relative border-t border-dashed" style={{ borderColor: "#c9c0a3" }}>
        <TicketNotches bg="#0D2B22" />
      </div>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className={locked ? "blur-sm select-none" : ""}>
          {tierKey === "exact" ? (
            <div className="text-sm font-bold">Score exact : <span style={{ color: accent }}>{m.score || "?-?"}</span></div>
          ) : tierKey === "vip" ? (
            <div className="text-sm font-bold">HT : <span style={{ color: accent }}>{m.ht || "?"}</span> · FT : <span style={{ color: accent }}>{m.ft || "?"}</span></div>
          ) : (
            <div className="text-sm font-bold">Prono : <span style={{ color: accent }}>{m.pronostic || "?"}</span></div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold tracking-widest uppercase opacity-50">Cote</div>
          <div className={`font-mono font-black text-lg leading-none ${locked ? "blur-sm select-none" : ""}`}>{m.cote || "-.--"}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   APP
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState("auth"); // home | auth | dashboard | admin | adminlogin
  const [authMode, setAuthMode] = useState("signup");
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState({});
  const [subs, setSubs] = useState({});
  const [payments, setPayments] = useState({});
  const [coupons, setCoupons] = useState({});

  const [session, setSession] = useState(null); // username
  const [isAdmin, setIsAdmin] = useState(false);

  const [authForm, setAuthForm] = useState({ username: "", password: "", phone: "" });
  const [authError, setAuthError] = useState("");
  const [payModal, setPayModal] = useState(null); // tierKey
  const [payRef, setPayRef] = useState("");
  const [payOp, setPayOp] = useState(MOBILE_MONEY[0].operateur);
  const [copiedNum, setCopiedNum] = useState("");
  const [activeTab, setActiveTab] = useState("free");
  const [adminPwd, setAdminPwd] = useState("");
  const [adminTab, setAdminTab] = useState("coupons");
  const [couponForm, setCouponForm] = useState({ heure: "", match: "", pronostic: "", cote: "", ht: "", ft: "", score: "" });
  const [couponTierAdmin, setCouponTierAdmin] = useState("free");
  const [toast, setToast] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [u, s, p, c] = await Promise.all([
      getShared("users", {}),
      getShared("subscriptions", {}),
      getShared("payments", {}),
      getShared(`coupons:${todayKey()}`, {}),
    ]);
    setUsers(u); setSubs(s); setPayments(p); setCoupons(c);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ---------- AUTH ---------- */
  const handleAuthSubmit = async () => {
    setAuthError("");
    const uname = authForm.username.trim().toLowerCase();
    if (!uname || !authForm.password) { setAuthError("Remplis tous les champs."); return; }
    const freshUsers = await getShared("users", {});
    if (authMode === "signup") {
      if (freshUsers[uname]) { setAuthError("Ce nom d'utilisateur existe déjà."); return; }
      const newUser = { username: uname, phone: authForm.phone, passHash: hash(authForm.password), createdAt: Date.now() };
      const updated = { ...freshUsers, [uname]: newUser };
      await setShared("users", updated);
      setUsers(updated);
      setSession(uname);
      setView("dashboard");
      showToast("Compte créé, bienvenue !");
    } else {
      const u = freshUsers[uname];
      if (!u || u.passHash !== hash(authForm.password)) { setAuthError("Identifiants incorrects."); return; }
      setUsers(freshUsers);
      setSession(uname);
      setView("dashboard");
      showToast(`Bon retour, ${uname} !`);
    }
    setAuthForm({ username: "", password: "", phone: "" });
  };

  const logout = () => { setSession(null); setView("auth"); setAuthMode("login"); };

  /* ---------- PAIEMENT (déclaratif, à valider par l'admin) ---------- */
  const submitPayment = async () => {
    if (!payRef.trim()) { showToast("Entre la référence de la transaction."); return; }
    const id = `${session}-${payModal}-${Date.now()}`;
    const fresh = await getShared("payments", {});
    const entry = {
      id, username: session, tier: payModal, amount: TIERS[payModal].price,
      operateur: payOp, ref: payRef.trim(), status: "en_attente", createdAt: Date.now(),
    };
    const updated = { ...fresh, [id]: entry };
    await setShared("payments", updated);
    setPayments(updated);
    setPayModal(null); setPayRef("");
    showToast("Paiement envoyé, en attente de validation.");
  };

  const copyNumero = (num) => {
    navigator.clipboard?.writeText(num).catch(() => {});
    setCopiedNum(num);
    setTimeout(() => setCopiedNum(""), 1500);
  };

  /* ---------- ADMIN ---------- */
  const adminLogin = () => {
    if (adminPwd === ADMIN_PASSWORD) { setIsAdmin(true); setView("admin"); showToast("Connecté en admin."); }
    else showToast("Mot de passe admin incorrect.");
  };

  const validatePayment = async (id) => {
    const fresh = await getShared("payments", {});
    const freshSubs = await getShared("subscriptions", {});
    const p = fresh[id];
    if (!p) return;
    const updatedP = { ...fresh, [id]: { ...p, status: "valide" } };
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const updatedS = { ...freshSubs, [p.username]: { ...(freshSubs[p.username] || {}), [p.tier]: { expiresAt } } };
    await setShared("payments", updatedP);
    await setShared("subscriptions", updatedS);
    setPayments(updatedP); setSubs(updatedS);
    showToast("Abonnement activé pour " + p.username);
  };

  const rejectPayment = async (id) => {
    const fresh = await getShared("payments", {});
    const p = fresh[id];
    if (!p) return;
    const updated = { ...fresh, [id]: { ...p, status: "rejete" } };
    await setShared("payments", updated);
    setPayments(updated);
  };

  const addCoupon = async () => {
    const tierKey = couponTierAdmin;
    const list = coupons[tierKey] || [];
    if (list.length >= TIERS[tierKey].limit) { showToast(`Limite de ${TIERS[tierKey].limit} atteinte pour ${TIERS[tierKey].label}.`); return; }
    if (!couponForm.heure || !couponForm.match) { showToast("Renseigne au moins l'heure et le match."); return; }
    const newMatch = { id: Date.now(), ...couponForm };
    const updated = { ...coupons, [tierKey]: [...list, newMatch] };
    await setShared(`coupons:${todayKey()}`, updated);
    setCoupons(updated);
    setCouponForm({ heure: "", match: "", pronostic: "", cote: "", ht: "", ft: "", score: "" });
    showToast("Coupon ajouté.");
  };

  const deleteCoupon = async (tierKey, id) => {
    const updated = { ...coupons, [tierKey]: (coupons[tierKey] || []).filter((m) => m.id !== id) };
    await setShared(`coupons:${todayKey()}`, updated);
    setCoupons(updated);
  };const hasAccess = (tierKey) => {
    if (tierKey === "free") return true;
    if (!session) return false;
    const s = subs[session]?.[tierKey];
    return s && s.expiresAt > Date.now();
  };

  const pendingPayments = Object.values(payments).filter((p) => p.status === "en_attente").sort((a, b) => b.createdAt - a.createdAt);

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div className="min-h-screen w-full" style={{ background: "#0D2B22", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-md text-sm font-semibold shadow-lg" style={{ background: "#F3ECD8", color: "#0D2B22" }}>
          {toast}
        </div>
      )}

      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 backdrop-blur-sm border-b" style={{ background: "rgba(13,43,34,0.92)", borderColor: "#1B4D3A" }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => setView(session ? "home" : "auth")} className="flex items-center gap-2 text-[#F3ECD8] font-black text-lg tracking-tight uppercase">
            <Ticket size={20} style={{ color: "#C9A227" }} />
            Senior<span style={{ color: "#C9A227" }}>Prono</span>
          </button>
          <div className="flex items-center gap-2">
            {session ? (
              <>
                <button onClick={() => setView("dashboard")} className="hidden sm:block text-sm font-semibold text-[#F3ECD8]/80 hover:text-[#F3ECD8] px-3 py-2">
                  {session}
                </button>
                <button onClick={logout} className="flex items-center gap-1.5 text-sm font-semibold text-[#F3ECD8] bg-[#1B4D3A] hover:bg-[#245942] px-3 py-2 rounded-md transition-colors">
                  <LogOut size={14} /> Déconnexion
                </button>
              </>
            ) : (
              <button onClick={() => { setView("auth"); setAuthMode("login"); }} className="text-sm font-bold px-4 py-2 rounded-md transition-colors" style={{ background: "#C9A227", color: "#0D2B22" }}>
                Connexion
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setView("admin")} className="flex items-center gap-1.5 text-sm font-semibold text-[#F3ECD8]/80 hover:text-[#F3ECD8] px-3 py-2">
                <Settings size={14} /> Admin
              </button>
            )}
          </div>
        </div>
      </nav>

      {loading ? (
        <div className="max-w-5xl mx-auto px-4 py-24 text-center text-[#F3ECD8]/50 font-semibold">Chargement...</div>
      ) : (
        <>
          {view === "home" && (
            <Home setView={setView} setAuthMode={setAuthMode} coupons={coupons} setActiveTab={setActiveTab} />
          )}

          {view === "auth" && (
            <AuthView
              authMode={authMode} setAuthMode={setAuthMode}
              authForm={authForm} setAuthForm={setAuthForm}
              authError={authError} handleAuthSubmit={handleAuthSubmit}
            />
          )}

          {view === "dashboard" && session && (
            <Dashboard
              session={session} activeTab={activeTab} setActiveTab={setActiveTab}
              coupons={coupons} hasAccess={hasAccess} subs={subs}
              setPayModal={setPayModal}
            />
          )}

          {view === "admin" && !isAdmin && (
            <AdminLogin adminPwd={adminPwd} setAdminPwd={setAdminPwd} adminLogin={adminLogin} />
          )}

          {view === "admin" && isAdmin && (
            <AdminPanel
              adminTab={adminTab} setAdminTab={setAdminTab}
              pendingPayments={pendingPayments} validatePayment={validatePayment} rejectPayment={rejectPayment}
              coupons={coupons} couponTierAdmin={couponTierAdmin} setCouponTierAdmin={setCouponTierAdmin}
              couponForm={couponForm} setCouponForm={setCouponForm} addCoupon={addCoupon} deleteCoupon={deleteCoupon}
              users={users}
            />
          )}
        </>
      )}

      {/* MODAL PAIEMENT */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-0 sm:px-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6" style={{ background: "#F3ECD8", color: "#1A1A1A" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-black text-xl uppercase tracking-tight">{TIERS[payModal].label}</h3>
              <button onClick={() => setPayModal(null)}><X size={20} /></button>
            </div>
            <p className="text-sm opacity-70 mb-4">{fmtFCFA(TIERS[payModal].price)} / {TIERS[payModal].period}</p>

            <div className="space-y-2 mb-4">
              {MOBILE_MONEY.map((m) => (
                <div key={m.operateur} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "#E6DEC6" }}>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide opacity-60">{m.operateur}</div>
                    <div className="font-mono font-bold">{m.numero}</div>
                  </div>
                  <button onClick={() => copyNumero(m.numero)} className="p-2 rounded-md" style={{ background: "#0D2B22" }}>
                    {copiedNum === m.numero ? <CheckCircle2 size={16} color="#35B08F" /> : <Copy size={16} color="#F3ECD8" />}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs opacity-70 mb-3">Envoie {fmtFCFA(TIERS[payModal].price)} à l'un de ces numéros, puis indique la référence reçue par SMS ci-dessous. Ton accès s'active dès validation par l'équipe.</p>

            <select value={payOp} onChange={(e) => setPayOp(e.target.value)} className="w-full mb-2 px-3 py-2.5 rounded-md text-sm font-semibold border" style={{ borderColor: "#c9c0a3" }}>
              {MOBILE_MONEY.map((m) => <option key={m.operateur} value={m.operateur}>{m.operateur}</option>)}
            </select>
            <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Référence de la transaction" className="w-full mb-4 px-3 py-2.5 rounded-md text-sm border" style={{ borderColor: "#c9c0a3" }} />

            <button onClick={submitPayment} className="w-full py-3 rounded-md font-bold uppercase tracking-wide text-sm" style={{ background: "#0D2B22", color: "#F3ECD8" }}>
              J'ai payé, envoyer la référence
            </button>
          </div>
        </div>
      )}

       <footer className="max-w-5xl mx-auto px-4 py-10 text-center text-[#F3ECD8]/40 text-xs">
        Senior Prono · Les pronostics sont fournis à titre informatif. Joue de manière responsable.
        <br />
        <button onClick={() => setView("admin")} className="mt-2 text-[#F3ECD8]/25 hover:text-[#F3ECD8]/60 underline">
          Espace admin
        </button>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------
   HOME
--------------------------------------------------------- */
function Home({ setView, setAuthMode, coupons, setActiveTab }) {
  const freeCoupons = coupons.free || [];
  return (
    <div>
      <section className="max-w-5xl mx-auto px-4 pt-14 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full" style={{ color: "#C9A227", border: "1px solid #C9A227" }}>
          <Clock size={12} /> Coupons mis à jour chaque jour
        </div>
        <h1 className="text-[#F3ECD8] font-black uppercase text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-4">
          L'expérience compte,<br />le prono suit.
        </h1>
        <p className="text-[#F3ECD8]/60 max-w-lg mx-auto mb-8 text-[15px]">
          Senior Prono, c'est l'analyse posée de gens qui suivent le foot depuis des années. 5 matchs gratuits chaque jour. Pour aller plus loin — HT-FT, score exact, combinés — passe en formule payante.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => { setView("auth"); setAuthMode("signup"); }} className="px-6 py-3 rounded-md font-bold uppercase text-sm tracking-wide" style={{ background: "#C9A227", color: "#0D2B22" }}>
            Créer un compte
          </button>
          <a href="#formules" className="px-6 py-3 rounded-md font-bold uppercase text-sm tracking-wide text-[#F3ECD8] border border-[#F3ECD8]/30">
            Voir les formules
          </a>
        </div>
      </section>

      {/* COUPONS GRATUITS DU JOUR */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="flex items-center gap-2 mb-5">
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "#8FBFA8" }}>Gratuit — aujourd'hui</div>
          <div className="flex-1 h-px" style={{ background: "#1B4D3A" }} />
        </div>
        {freeCoupons.length === 0 ? (
          <p className="text-[#F3ECD8]/40 text-sm">Aucun coupon publié pour l'instant. Reviens un peu plus tard.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeCoupons.map((m) => <MatchTicket key={m.id} m={m} tierKey="free" accent="#8FBFA8" locked={false} />)}
          </div>
        )}
      </section>

      {/* FORMULES */}
      <section id="formules" className="max-w-5xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-2 mb-5">
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "#8FBFA8" }}>Les formules</div>
          <div className="flex-1 h-px" style={{ background: "#1B4D3A" }} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { t: TIERS.vip, Icon: ShieldCheck, desc: "Pronostic mi-temps / fin de match sur 3 rencontres sélectionnées." },
            { t: TIERS.exact, Icon: Target, desc: "Score exact prédit sur 2 rencontres à forte cote." },
            { t: TIERS.combo, Icon: Layers, desc: "8 matchs combinés en un seul coupon à cote cumulée." },
          ].map(({ t, Icon, desc }) => (
            <div key={t.key} className="rounded-xl p-5 border" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={18} style={{ color: t.accent }} />
                  <span className="font-black uppercase tracking-tight text-[#F3ECD8]">{t.label}</span>
                </div>
                <TrendingUp size={16} style={{ color: t.accent }} />
              </div>
              <p className="text-[#F3ECD8]/60 text-sm mb-4">{desc}</p>
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-mono font-black text-2xl text-[#F3ECD8]">{fmtFCFA(t.price)}</div>
                  <div className="text-[11px] text-[#F3ECD8]/40 uppercase tracking-wide">par {t.period}</div>
                </div>
                <button onClick={() => { setView("auth"); setAuthMode("signup"); }} className="flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-md" style={{ background: t.accent, color: "#0D2B22" }}>
                  S'abonner <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="rounded-xl p-5 border flex flex-col justify-between" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Check size={18} style={{ color: TIERS.free.accent }} />
                <span className="font-black uppercase tracking-tight text-[#F3ECD8]">{TIERS.free.label}</span>
              </div><p className="text-[#F3ECD8]/60 text-sm mb-4">5 pronostics simples chaque jour, sans engagement.</p>
            </div>
            <div className="font-mono font-black text-2xl text-[#F3ECD8]">0 FCFA</div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------
   AUTH
--------------------------------------------------------- */
function AuthView({ authMode, setAuthMode, authForm, setAuthForm, authError, handleAuthSubmit }) {
  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="rounded-xl p-6 border" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
        <h2 className="text-[#F3ECD8] font-black uppercase text-xl tracking-tight mb-1">
          {authMode === "login" ? "Connexion" : "Créer un compte"}
        </h2>
        <p className="text-[#F3ECD8]/50 text-sm mb-5">
          {authMode === "login" ? "Accède à ton espace membre." : "Rejoins Senior Prono en quelques secondes."}
        </p>
        <div className="space-y-3">
          <input placeholder="Nom d'utilisateur" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A] outline-none focus:border-[#C9A227]" />
          {authMode === "signup" && (
            <input placeholder="Numéro de téléphone" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
              className="w-full px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A] outline-none focus:border-[#C9A227]" />
          )}
          <input placeholder="Mot de passe" type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            className="w-full px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A] outline-none focus:border-[#C9A227]" />
          {authError && <p className="text-sm font-semibold" style={{ color: "#E08B7D" }}>{authError}</p>}
          <button onClick={handleAuthSubmit} className="w-full py-3 rounded-md font-bold uppercase text-sm tracking-wide" style={{ background: "#C9A227", color: "#0D2B22" }}>
            {authMode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </div>
        <button onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} className="w-full text-center text-sm text-[#F3ECD8]/50 mt-4">
          {authMode === "login" ? "Pas de compte ? Inscris-toi" : "Déjà inscrit ? Connecte-toi"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */
function Dashboard({ session, activeTab, setActiveTab, coupons, hasAccess, subs, setPayModal }) {
  const tab = TIERS[activeTab];
  const list = coupons[activeTab] || [];
  const unlocked = hasAccess(activeTab);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h2 className="text-[#F3ECD8] font-black uppercase text-2xl tracking-tight mb-5">Mon espace</h2>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {Object.values(TIERS).map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-colors"
            style={activeTab === t.key ? { background: t.accent, color: "#0D2B22", borderColor: t.accent } : { color: "#F3ECD8", borderColor: "#1B4D3A" }}>
            {t.key !== "free" && !hasAccess(t.key) && <Lock size={12} />}
            {t.label}
          </button>
        ))}
      </div>

      {!unlocked ? (
        <div className="rounded-xl p-8 text-center border" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
          <Lock size={28} className="mx-auto mb-3" style={{ color: tab.accent }} />
          <h3 className="text-[#F3ECD8] font-black uppercase text-lg mb-1">{tab.label} verrouillé</h3>
          <p className="text-[#F3ECD8]/50 text-sm mb-5">{fmtFCFA(tab.price)} / {tab.period} — {tab.tagline}</p>
          <button onClick={() => setPayModal(activeTab)} className="px-6 py-3 rounded-md font-bold uppercase text-sm tracking-wide" style={{ background: tab.accent, color: "#0D2B22" }}>
            Débloquer maintenant
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="text-[#F3ECD8]/40 text-sm">Aucun coupon publié pour l'instant dans cette formule aujourd'hui.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => <MatchTicket key={m.id} m={m} tierKey={activeTab} accent={tab.accent} locked={false} />)}
        </div>
      )}

      {activeTab !== "free" && unlocked && (
        <p className="text-[#F3ECD8]/40 text-xs mt-4">
          Abonnement actif jusqu'au {new Date(subs[session][activeTab].expiresAt).toLocaleDateString("fr-FR")}.
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   ADMIN LOGIN
--------------------------------------------------------- */
function AdminLogin({ adminPwd, setAdminPwd, adminLogin }) {
  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="rounded-xl p-6 border" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
        <h2 className="text-[#F3ECD8] font-black uppercase text-xl tracking-tight mb-4">Accès admin</h2>
        <input type="password" placeholder="Mot de passe admin" value={adminPwd} onChange={(e) => setAdminPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adminLogin()}
          className="w-full px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A] outline-none focus:border-[#C9A227] mb-3" />
        <button onClick={adminLogin} className="w-full py-3 rounded-md font-bold uppercase text-sm tracking-wide" style={{ background: "#C9A227", color: "#0D2B22" }}>
          Entrer
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ADMIN PANEL
--------------------------------------------------------- */
function AdminPanel({ adminTab, setAdminTab, pendingPayments, validatePayment, rejectPayment, coupons, couponTierAdmin, setCouponTierAdmin, couponForm, setCouponForm, addCoupon, deleteCoupon, users }) {
  const tier = TIERS[couponTierAdmin];
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h2 className="text-[#F3ECD8] font-black uppercase text-2xl tracking-tight mb-5">Panneau admin</h2>
      <div className="flex gap-2 mb-6">
        {[["coupons", "Coupons du jour"], ["paiements", `Paiements (${pendingPayments.length})`], ["membres", "Membres"]].map(([k, l]) => (
          <button key={k} onClick={() => setAdminTab(k)} className="px-4 py-2 rounded-md text-sm font-bold"
            style={adminTab === k ? { background: "#C9A227", color: "#0D2B22" } : { color: "#F3ECD8", border: "1px solid #1B4D3A" }}>
            {l}
          </button>
        ))}
      </div>

      {adminTab === "coupons" && (
        <div>
          <div className="flex gap-2 mb-5 flex-wrap">
            {Object.values(TIERS).map((t) => (
              <button key={t.key} onClick={() => setCouponTierAdmin(t.key)} className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={couponTierAdmin === t.key ? { background: t.accent, color: "#0D2B22" } : { color: "#F3ECD8", border: "1px solid #1B4D3A" }}>
                {t.label} ({(coupons[t.key] || []).length}/{t.limit})
              </button>
            ))}
          </div>

          <div className="rounded-xl p-5 border mb-6" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <input placeholder="Heure (ex: 18:00)" value={couponForm.heure} onChange={(e) => setCouponForm({ ...couponForm, heure: e.target.value })}
                className="px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A]" />
              <input placeholder="Match (ex: PSG vs OM)" value={couponForm.match} onChange={(e) => setCouponForm({ ...couponForm, match: e.target.value })}
                className="px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A]" />
              {couponTierAdmin === "exact" ? (
                <input placeholder="Score exact (ex: 2-1)" value={couponForm.score} onChange={(e) => setCouponForm({ ...couponForm, score: e.target.value })}
                  className="px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A]" />
              ) : couponTierAdmin === "vip" ? (
                <>
                  <input placeholder="Mi-temps (ex: 1-0)" value={couponForm.ht} onChange={(e) => setCouponForm({ ...couponForm, ht: e.target.value })}
                    className="px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A]" />
                  <input placeholder="Fin de match (ex: 2-1)" value={couponForm.ft} onChange={(e) => setCouponForm({ ...couponForm, ft: e.target.value })}
                    className="px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A]" />
                </>
              ) : (
                <input placeholder="Pronostic (ex: Victoire équipe 1)" value={couponForm.pronostic} onChange={(e) => setCouponForm({ ...couponForm, pronostic: e.target.value })}
                  className="px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A]" />
              )}
              <input placeholder="Cote (ex: 1.85)" value={couponForm.cote} onChange={(e) => setCouponForm({ ...couponForm, cote: e.target.value })}
                className="px-3 py-2.5 rounded-md text-sm bg-[#0D2B22] text-[#F3ECD8] border border-[#1B4D3A]" />
            </div>
            <button onClick={addCoupon} className="flex items-center gap-1.5 px-4 py-2.5 rounded-md font-bold text-sm" style={{ background: tier.accent, color: "#0D2B22" }}>
              <Plus size={16} /> Ajouter au coupon {tier.label}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(coupons[couponTierAdmin] || []).map((m) => (
              <div key={m.id} className="relative">
                <MatchTicket m={m} tierKey={couponTierAdmin} accent={tier.accent} locked={false} />
                <button onClick={() => deleteCoupon(couponTierAdmin, m.id)} className="absolute top-2 right-2 p-1.5 rounded-md" style={{ background: "#0D2B22" }}>
                  <Trash2 size={14} color="#E08B7D" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminTab === "paiements" && (
        <div className="space-y-3">
          {pendingPayments.length === 0 ? (
            <p className="text-[#F3ECD8]/40 text-sm">Aucun paiement en attente.</p>
          ) : pendingPayments.map((p) => (
            <div key={p.id} className="rounded-xl p-4 border flex items-center justify-between flex-wrap gap-3" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
              <div>
                <div className="text-[#F3ECD8] font-bold">{p.username} — {TIERS[p.tier].label}</div>
                <div className="text-[#F3ECD8]/50 text-sm">{fmtFCFA(p.amount)} via {p.operateur} · réf: {p.ref}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => rejectPayment(p.id)} className="px-3 py-2 rounded-md text-sm font-bold" style={{ color: "#E08B7D", border: "1px solid #E08B7D" }}>Rejeter</button>
                <button onClick={() => validatePayment(p.id)} className="px-3 py-2 rounded-md text-sm font-bold" style={{ background: "#35B08F", color: "#0D2B22" }}>Valider</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adminTab === "membres" && (
        <div className="space-y-2">
          {Object.values(users).length === 0 ? (
            <p className="text-[#F3ECD8]/40 text-sm">Aucun membre inscrit.</p>
          ) : Object.values(users).map((u) => (
            <div key={u.username} className="rounded-lg px-4 py-3 border flex items-center justify-between" style={{ borderColor: "#1B4D3A", background: "#123B2E" }}>
              <span className="text-[#F3ECD8] font-semibold">{u.username}</span>
              <span className="text-[#F3ECD8]/40 text-sm">{u.phone || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
                }
