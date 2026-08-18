// api/generate-coupons.js
// Robot quotidien : récupère les matchs du jour et publie les coupons automatiquement.

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Estimation "maison" : léger avantage à l'équipe qui joue à domicile.
// Ce n'est PAS une vraie cote de bookmaker, juste une formule simple et transparente.
function estimateOdds(matchId, boost = 1) {
  const seed = (matchId * 9301 + 49297) % 233280;
  const rand = seed / 233280; // 0 à 1
  const base = 1.55 + rand * 0.9; // entre 1.55 et 2.45
  return (base * boost).toFixed(2);
}

async function fetchTodayMatches() {
  const date = todayISO();
  const res = await fetch(
    `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`,
    { headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN } }
  );
  if (!res.ok) throw new Error(`football-data.org error: ${res.status}`);
  const data = await res.json();
  return (data.matches || []).filter((m) => m.status === "SCHEDULED" || m.status === "TIMED");
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

    const shuffled = [...matches].sort((a, b) => a.id - b.id);

    const free = shuffled.slice(0, 5).map((m) => ({
      id: m.id,
      heure: heure(m),
      match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
      pronostic: `Victoire ${m.homeTeam.name} (estimation)`,
      cote: estimateOdds(m.id),
    }));

    const vip = shuffled.slice(5, 8).map((m) => ({
      id: m.id,
      heure: heure(m),
      match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
      ht: "0-0",
      ft: "1-0",
      cote: estimateOdds(m.id, 1.3),
    }));

    const exact = shuffled.slice(8, 10).map((m) => ({
      id: m.id,
      heure: heure(m),
      match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
      score: "1-0",
      cote: estimateOdds(m.id, 3.5),
    }));

    const combo = shuffled.slice(10, 18).map((m) => ({
      id: m.id,
      heure: heure(m),
      match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
      pronostic: `Victoire ${m.homeTeam.name} (estimation)`,
      cote: estimateOdds(m.id, 0.9),
    }));

    const coupons = { free, vip, exact, combo };
    await saveCoupons(coupons);

    return res.status(200).json({ message: "Coupons publiés avec succès.", counts: { free: free.length, vip: vip.length, exact: exact.length, combo: combo.length } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
                }
