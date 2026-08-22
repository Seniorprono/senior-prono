// api/generate-coupons.js
// Robot quotidien : récupère les matchs du jour et publie les coupons automatiquement.
// Règle : classement des équipes (favori = mieux classé) + petit bonus pour l'équipe à domicile.

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchTodayMatches() {
  const date = todayISO();
  const res = await fetch(
    `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`,
    { headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN } }
  );
  if (!res.ok) throw new Error(`football-data.org error: ${res.status}`);
  const data = await res.json();
  return (data.matches || []).filter((m) => m.status !== "POSTPONED" && m.status !== "CANCELLED");
}

// Cache des classements pour ne pas refaire plusieurs fois le même appel.
const standingsCache = new Map();

async function fetchStandings(competitionId) {
  if (standingsCache.has(competitionId)) return standingsCache.get(competitionId);
  try {
    const res = await fetch(`https://api.football-data.org/v4/competitions/${competitionId}/standings`, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN },
    });
    if (!res.ok) throw new Error("standings not available");
    const data = await res.json();
    const table = data.standings?.find((s) => s.type === "TOTAL")?.table || [];
    const map = {};
    table.forEach((row) => { map[row.team.id] = row.position; });
    standingsCache.set(competitionId, map);
    return map;
  } catch {
    standingsCache.set(competitionId, null);
    return null;
  }
}

// Détermine l'équipe favorite et une cote estimée à partir du classement + avantage du terrain.
async function analyzeMatch(match) {
  const HOME_BONUS = 1.5; // léger avantage pour l'équipe à domicile, en "positions" équivalentes
  const table = await fetchStandings(match.competition.id);

  if (table && table[match.homeTeam.id] && table[match.awayTeam.id]) {
    const posHome = table[match.homeTeam.id] - HOME_BONUS;
    const posAway = table[match.awayTeam.id];
    const diff = Math.abs(posAway - posHome);
    const favoriteIsHome = posHome <= posAway;
    const cote = Math.min(3.2, Math.max(1.25, 1.3 + Math.max(0, 12 - diff) * 0.07));
    return { favorite: favoriteIsHome ? match.homeTeam.name : match.awayTeam.name, cote: cote.toFixed(2), source: "classement" };
  }

  // Repli : pas de classement disponible (coupe, etc.) → léger avantage au terrain, cote pseudo-aléatoire stable.
  const seed = (match.id * 9301 + 49297) % 233280;
  const rand = seed / 233280;
  const cote = (1.55 + rand * 0.9).toFixed(2);
  return { favorite: match.homeTeam.name, cote, source: "terrain" };
}

async function saveCoupons(coupons) {
  const key = `coupons:${todayISO()}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?on_conflict=key`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key, value: JSON.stringify(coupons), updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

function heure(match) {
  const d = new Date(match.utcDate);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
}

export default async function handler(req, res) {
  if (req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  try {
    const matches = await fetchTodayMatches();
    if (matches.length === 0) {
      return res.status(200).json({ message: "Aucun match trouvé aujourd'hui." });
    }

    const sorted = [...matches].sort((a, b) => a.id - b.id);
    const analyzed = [];
    for (const m of sorted) {
      const a = await analyzeMatch(m);
      analyzed.push({ match: m, ...a });
    }

    const toEntry = (item, extra = {}) => ({
      id: item.match.id,
      heure: heure(item.match),
      match: `${item.match.homeTeam.name} vs ${item.match.awayTeam.name}`,
      cote: item.cote,
      ...extra,
    });

    const free = analyzed.slice(0, 5).map((item) =>
      toEntry(item, { pronostic: `Victoire ${item.favorite} (estimation)` })
    );

    const vip = analyzed.slice(5, 8).map((item) =>
      toEntry(item, { ht: "0-0", ft: "1-0" })
    );

    const exact = analyzed.slice(8, 10).map((item) =>
      toEntry(item, { score: "1-0", cote: (parseFloat(item.cote) * 2).toFixed(2) })
    );

    const combo = analyzed.slice(10, 18).map((item) =>
      toEntry(item, { pronostic: `Victoire ${item.favorite} (estimation)` })
    );

    const coupons = { free, vip, exact, combo };
    await saveCoupons(coupons);

    return res.status(200).json({
      message: "Coupons publiés avec succès.",
      counts: { free: free.length, vip: vip.length, exact: exact.length, combo: combo.length },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
      }
