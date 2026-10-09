import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const USERS = {
  thomas: { name: "Thomas", role: "host", password: "hovden2026" },
  jovita: { name: "Jovita", role: "cleaner", password: "ekstrahand2026" },
};

const SUPPLY_STATES = ["ok", "low", "empty"];
const SUPPLY_LABEL = { ok: "OK", low: "Lite igjen", empty: "Tom" };
const nextSupplyStatus = (s) => SUPPLY_STATES[(SUPPLY_STATES.indexOf(s) + 1) % SUPPLY_STATES.length];

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
};

const toISODate = (d) => {
  if (!d) return "";
  return d;
};

const formatDuration = (minutes) => {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
};

// Pricing: 1-2 gjester = 2000, 3-4 = 2300, 5+ = 2625
const guestRate = (n) => {
  if (n <= 2) return 2000;
  if (n <= 4) return 2300;
  return 2625;
};

// Format number as Norwegian invoice amount, e.g. "2 300,00"
const formatKr = (n) =>
  n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Format ISO date string as DD.MM.YYYY
const isoToNO = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};

// Format ISO date as "2. sep. 2026"
const isoToLong = (d) => {
  if (!d) return "";
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  const date = new Date(d);
  return `${date.getDate()}. ${months[date.getMonth()]}. ${date.getFullYear()}`;
};

// Add days to ISO date string
const addDays = (isoDate, days) => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── FAKTURA HTML GENERATOR ─────────────────────────────────────────────────
const generateFakturaHTML = ({ fakturaNum, fakturaDate, dueDate, serviceItems, utleggItems }) => {
  const sumServices = serviceItems.reduce((s, r) => s + r.sum, 0);
  const validUtlegg = utleggItems.filter((u) => u.name && parseFloat(u.amount) > 0);
  const sumUtlegg = validUtlegg.reduce((s, u) => s + parseFloat(u.amount), 0);
  const mva = sumServices * 0.25;
  const total = sumServices + mva + sumUtlegg;

  const tableRows = serviceItems
    .map(
      (r) => `<tr>
      <td>${r.desc}</td>
      <td>${r.guests}</td>
      <td>${r.rate}</td>
      <td>${formatKr(r.sum)}</td>
    </tr>`
    )
    .join("\n");

  const utleggRows = validUtlegg
    .map(
      (u) => `<tr>
      <td>Utlegg – ${u.name}</td>
      <td>–</td>
      <td>–</td>
      <td>${formatKr(parseFloat(u.amount))}</td>
    </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Faktura ${fakturaNum} — Hovden Hytteservice</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
@page { size: A4; margin: 0; }
body {
  font-family: 'Inter', sans-serif;
  background: #525659;
  margin: 0;
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
}
.faktura {
  background: #ffffff;
  width: 100%;
  max-width: 800px;
  padding: 50px 55px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
@media print {
  body { background: #ffffff; padding: 0; display: block; }
  .faktura { box-shadow: none; max-width: none; padding: 40px 45px; }
  .print-btn { display: none !important; }
}
.print-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #1a2a3a;
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.print-btn:hover { background: #00d18b; color: #1a2a3a; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
.faktura-title { text-align: right; }
.faktura-title h1 { font-size: 24px; font-weight: 700; color: #1a2a3a; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 8px; }
.faktura-meta { font-size: 12px; color: #4a5568; line-height: 1.6; text-align: right; }
.faktura-meta strong { color: #1a2a3a; }
.divider { border: none; border-top: 2px solid #6b7a8d; margin: 15px 0 25px; }
.address-row { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 25px; }
.address-box { flex: 1; }
.address-box h3 { font-size: 11px; font-weight: 700; color: #1a2a3a; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
.address-box p { font-size: 13px; color: #2d3748; line-height: 1.5; }
.address-box .highlight { color: #1a2a3a; font-weight: 600; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
.items-table thead tr { background: #1a2a3a; color: #fff; }
.items-table thead th { padding: 10px 12px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; text-align: left; }
.items-table thead th:not(:first-child) { text-align: center; }
.items-table thead th:last-child { text-align: right; }
.items-table tbody tr { border-bottom: 1px solid #e2e8f0; }
.items-table tbody tr:nth-child(even) { background: #fafafa; }
.items-table tbody td { padding: 10px 12px; font-size: 13px; color: #2d3748; text-align: left; }
.items-table tbody td:not(:first-child) { text-align: center; font-variant-numeric: tabular-nums; }
.items-table tbody td:last-child { text-align: right; }
.totals-wrap { display: flex; justify-content: flex-end; margin-top: 10px; }
.totals { width: 320px; }
.total-row { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 13px; color: #4a5568; border-bottom: 1px solid #e2e8f0; }
.total-row:last-child { border-bottom: none; }
.total-row.final { background: #1a2a3a; color: #fff; font-weight: 700; font-size: 14px; margin-top: 6px; letter-spacing: 0.02em; }
.total-row span:last-child { font-variant-numeric: tabular-nums; }
.footer-note { margin-top: 40px; font-size: 11px; color: #6b7a8d; line-height: 1.6; text-align: center; }
.footer-note strong { color: #1a2a3a; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Skriv ut / Lagre som PDF</button>
<div class="faktura">
  <div class="header">
    <div class="logo-block">
      <svg width="240" height="110" viewBox="0 0 320 150" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin-bottom: 10px;">
        <rect width="320" height="150" rx="15" fill="#12253a"/>
        <g transform="translate(0, 0)">
          <rect x="25" y="45" width="18" height="50" rx="9" fill="#ffffff"/>
          <rect x="47" y="30" width="18" height="60" rx="9" fill="#ffffff"/>
          <rect x="69" y="20" width="18" height="70" rx="9" fill="#ffffff"/>
          <rect x="91" y="30" width="18" height="60" rx="9" fill="#ffffff"/>
          <path d="M 25 80 V 95 H 40 V 110 H 125 A 15 15 0 0 0 140 95 A 15 15 0 0 0 125 80 Z" fill="#ffffff"/>
        </g>
        <g transform="translate(130, 25)" stroke="#00d18b" stroke-width="4" stroke-linecap="round">
          <line x1="12" y1="0" x2="12" y2="24"/>
          <line x1="0" y1="12" x2="24" y2="12"/>
          <line x1="4" y1="4" x2="20" y2="20"/>
          <line x1="4" y1="20" x2="20" y2="4"/>
        </g>
        <text x="135" y="75" font-family="'Inter', sans-serif" font-size="40" font-weight="900" fill="#ffffff" letter-spacing="3">EKSTRA</text>
        <text x="150" y="108" font-family="'Inter', sans-serif" font-size="36" font-weight="900" fill="#12253a" stroke="#00d18b" stroke-width="2" letter-spacing="4">HÅND</text>
        <line x1="85" y1="125" x2="295" y2="125" stroke="#00d18b" stroke-width="4" stroke-linecap="round"/>
        <text x="190" y="142" font-family="'Inter', sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="1.5" text-anchor="middle">Hytteservice &amp; IT-løsninger</text>
      </svg>
      <div style="font-size:12px;color:#4a5568;line-height:1.5;">
        Guvågveien 1, 8475 Straumsjøen<br>
        Org.nr: 827 511 242 MVA | Tlf: 96 99 76 03
      </div>
    </div>
    <div class="faktura-title">
      <h1>Faktura</h1>
      <div class="faktura-meta">
        <strong>Fakturanr:</strong> ${fakturaNum}<br>
        <strong>Dato:</strong> ${isoToNO(fakturaDate)}<br>
        <strong>Forfall:</strong> ${isoToNO(dueDate)}
      </div>
    </div>
  </div>

  <hr class="divider">

  <div class="address-row">
    <div class="address-box">
      <h3>Kunde / Mottaker</h3>
      <p>
        <strong>Thomas Nygård</strong><br>
        Hovden Hytteservice<br>
        Nygårdsveien 63, 8475 Straumsjøen<br>
        Bø i Vesterålen, Norge
      </p>
    </div>
    <div class="address-box">
      <h3>Betalingsinformasjon</h3>
      <p>
        <span class="highlight">Bank:</span> Sparebanken Nord-Norge<br>
        <span class="highlight">Kontonummer:</span> 4612.61.52078<br>
        <span class="highlight">Merk betaling:</span> Fakturanr. ${fakturaNum}
      </p>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Beskrivelse</th>
        <th>Gjester</th>
        <th>Sats (kr)</th>
        <th>Sum (Eks. MVA)</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      ${utleggRows}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="total-row">
        <span>Sum tjenester eks. mva:</span>
        <span>${formatKr(sumServices)} kr</span>
      </div>
      <div class="total-row">
        <span>MVA (25%):</span>
        <span>${formatKr(mva)} kr</span>
      </div>
      ${
        sumUtlegg > 0
          ? `<div class="total-row">
        <span>Utlegg (ingen mva):</span>
        <span>${formatKr(sumUtlegg)} kr</span>
      </div>`
          : ""
      }
      <div class="total-row final">
        <span>TOTALT Å BETALE:</span>
        <span>${formatKr(total)} kr</span>
      </div>
    </div>
  </div>

  <div class="footer-note">
    Tusen takk for oppdraget!<br>
    <strong>Jovita Amurwon | Ekstrahånd</strong><br>
    Guvågveien 1, 8475 Straumsjøen | Tlf: 96 99 76 03 | Org.nr: 827 511 242 MVA
  </div>
</div>
</body>
</html>`;
};

const StatusBadge = ({ status }) => {
  if (!status) return <span style={styles.badgeNone}>Ikke rapportert</span>;
  if (status === "ok") return <span style={styles.badgeOk}>✓ Alt bra</span>;
  if (status === "obs") return <span style={styles.badgeObs}>⚠ Obs</span>;
  return null;
};

const SupplyBadge = ({ status }) => {
  if (status === "ok") return <span style={styles.badgeOk}>✓ OK</span>;
  if (status === "low") return <span style={styles.badgeObs}>⚠ Lite igjen</span>;
  if (status === "empty") return <span style={styles.badgeEmpty}>✕ Tom</span>;
  return <span style={styles.badgeNone}>–</span>;
};

const Logo = () => (
  <svg width="140" viewBox="0 0 190 90" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="190" height="90" rx="10" fill="#0f2540" />
    <g transform="translate(14, 10)">
      <rect x="0" y="14" width="10" height="30" rx="5" fill="#fff" />
      <rect x="13" y="6" width="10" height="38" rx="5" fill="#fff" />
      <rect x="26" y="2" width="10" height="42" rx="5" fill="#fff" />
      <rect x="39" y="6" width="10" height="38" rx="5" fill="#fff" />
      <rect x="4" y="36" width="50" height="16" rx="6" fill="#fff" />
      <rect x="0" y="44" width="12" height="10" rx="3" fill="#0f2540" />
      <line x1="58" y1="0" x2="58" y2="12" stroke="#00d68f" strokeWidth="3" strokeLinecap="round" />
      <line x1="52" y1="6" x2="64" y2="6" stroke="#00d68f" strokeWidth="3" strokeLinecap="round" />
      <line x1="54" y1="1" x2="62" y2="9" stroke="#00d68f" strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="1" x2="54" y2="9" stroke="#00d68f" strokeWidth="2" strokeLinecap="round" />
    </g>
    <text x="100" y="46" fontFamily="Helvetica,Arial,sans-serif" fontSize="20" fontWeight="800" fill="#fff" textAnchor="middle">EKSTRA</text>
    <text x="100" y="66" fontFamily="Helvetica,Arial,sans-serif" fontSize="20" fontWeight="300" fill="#00d68f" textAnchor="middle" letterSpacing="5">HÅND</text>
    <rect x="25" y="72" width="140" height="1.5" rx="1" fill="#00d68f" />
    <text x="100" y="84" fontFamily="Helvetica,Arial,sans-serif" fontSize="7" fontWeight="500" fill="#fff" textAnchor="middle" letterSpacing="1.5">Hytteservice &amp; IT-løsninger</text>
  </svg>
);

const emptyNewBooking = {
  guest: "",
  country: "",
  check_in: "",
  check_out: "",
  guests: 1,
  obs: "",
  _double: 0,
  _single: 0,
  _baby: false,
};

export default function App() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [newBooking, setNewBooking] = useState(emptyNewBooking);
  const [statusNote, setStatusNote] = useState("");
  const [statusType, setStatusType] = useState("ok");
  const [statusPhoto, setStatusPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [loginRole, setLoginRole] = useState(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [newBookingError, setNewBookingError] = useState("");

  // ── FAKTURA STATE ──────────────────────────────────────────────────────────
  const [fakturaNum, setFakturaNum] = useState("047");
  const [fakturaDate, setFakturaDate] = useState(todayISO());
  // { [bookingId]: { included: bool, ekstraTimer: number, ekstraNote: string } }
  const [fakturaBookings, setFakturaBookings] = useState({});
  const [utleggItems, setUtleggItems] = useState([{ name: "", amount: "" }]);

  const setFakturaBookingField = (id, field, value) => {
    setFakturaBookings((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const openFaktura = () => {
    const dueDate = addDays(fakturaDate, 14);

    // Build service items
    const serviceItems = [];
    bookings.forEach((b) => {
      if (!fakturaBookings[b.id]?.included) return;
      const rate = guestRate(b.guests);
      serviceItems.push({
        desc: `Vask og klargjøring – ${b.guest} (${isoToLong(b.check_out)}), ${b.guests} gjester`,
        guests: String(b.guests),
        rate: "–",
        sum: rate,
      });
      const timer = parseFloat(fakturaBookings[b.id]?.ekstraTimer) || 0;
      if (timer > 0) {
        const note = fakturaBookings[b.id]?.ekstraNote
          ? ` – ${fakturaBookings[b.id].ekstraNote}`
          : "";
        serviceItems.push({
          desc: `Ekstraarbeid${note} (${isoToLong(b.check_out)}, ${timer} t × 550 kr)`,
          guests: "–",
          rate: "550,00",
          sum: timer * 550,
        });
      }
    });

    const validUtlegg = utleggItems.filter((u) => u.name && parseFloat(u.amount) > 0);

    const html = generateFakturaHTML({
      fakturaNum,
      fakturaDate,
      dueDate,
      serviceItems,
      utleggItems: validUtlegg,
    });

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  const handleLogin = (role) => {
    const u = USERS[role];
    if (password.trim().toLowerCase() === u.password.toLowerCase()) {
      setUser(u);
      setPassword("");
      setLoginError("");
      setLoginRole(null);
    } else {
      setLoginError("Feil passord, prøv igjen.");
    }
  };

  const booking = bookings.find((b) => b.id === selected);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadBookings = async () => {
    setLoading(true);
    const { data: bData, error } = await supabase
      .from("bookings")
      .select("*, bed_plans(*), status_reports(*)")
      .order("check_in", { ascending: true });
    if (error) console.error("loadBookings error:", error);
    if (bData) setBookings(bData);
    setLoading(false);
  };

  const loadSupplies = async () => {
    const { data: sData } = await supabase
      .from("supplies")
      .select("*")
      .order("name", { ascending: true });
    if (sData) setSupplies(sData);
  };

  useEffect(() => {
    if (user) {
      loadBookings();
      loadSupplies();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        loadBookings();
        loadSupplies();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const sendNotification = async (type, b, message, photoUrl = null) => {
    await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        guest: b.guest,
        checkIn: formatDate(b.check_in),
        checkOut: formatDate(b.check_out),
        message,
        photoUrl,
      }),
    });
  };

  const uploadStatusPhoto = async () => {
    if (!statusPhoto) return null;
    const ext = statusPhoto.name.split(".").pop();
    const path = `${booking.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("status-photos").upload(path, statusPhoto);
    if (error) {
      console.error("photo upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("status-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const notifySupplyEmpty = async (item) => {
    await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "supply_empty",
        guest: "",
        checkIn: "",
        checkOut: "",
        message: `${item.name} er tom og trenger påfyll.`,
      }),
    });
  };

  const saveBedPlan = async () => {
    setLoading(true);
    const bp = editData.bed_plans?.[0];
    if (bp?.id) {
      await supabase.from("bed_plans").update({
        double_beds: editData._double,
        single_beds: editData._single,
        baby_bed: editData._baby,
      }).eq("id", bp.id);
    } else {
      await supabase.from("bed_plans").insert({
        booking_id: editData.id,
        double_beds: editData._double,
        single_beds: editData._single,
        baby_bed: editData._baby,
      });
    }
    await supabase.from("bookings").update({
      obs: editData.obs,
      guest: (editData.guest || "").trim(),
      country: (editData.country || "").trim() || null,
      check_in: toISODate(editData.check_in),
      check_out: toISODate(editData.check_out),
      guests: parseInt(editData.guests) || 1,
    }).eq("id", editData.id);
    await sendNotification(
      "booking_updated",
      editData,
      `Oppredning oppdatert: ${editData._double} dobbel, ${editData._single} enkel${editData._baby ? ", barneseng" : ""}. OBS: ${editData.obs || "ingen"}`
    );
    setEditing(false);
    showToast("✅ Lagret og Jovita varslet på e-post!");
    loadBookings();
    setLoading(false);
  };

  const startCleaning = async () => {
    setLoading(true);
    await supabase
      .from("bookings")
      .update({ cleaning_started_at: new Date().toISOString() })
      .eq("id", booking.id);
    showToast("▶️ Vask startet!");
    loadBookings();
    setLoading(false);
  };

  const computeDurationMinutes = () => {
    if (!booking?.cleaning_started_at) return null;
    const started = new Date(booking.cleaning_started_at).getTime();
    return Math.max(1, Math.round((Date.now() - started) / 60000));
  };

  const submitStatus = async () => {
    setLoading(true);
    const duration = computeDurationMinutes();
    const photoUrl = await uploadStatusPhoto();
    await supabase.from("status_reports").insert({
      booking_id: selected,
      status: statusType,
      note: statusNote,
      sent_at: new Date().toISOString(),
      duration_minutes: duration,
      photo_url: photoUrl,
    });
    const durationText = duration ? ` (Tidsbruk: ${formatDuration(duration)})` : "";
    await sendNotification(
      "status_report",
      booking,
      `${statusType === "ok" ? "✓ Alt bra" : "⚠ Obs"}: ${statusNote || "Ingen kommentar"}${durationText}`,
      photoUrl
    );
    setStatusNote("");
    setStatusPhoto(null);
    showToast("📤 Status sendt til Thomas!");
    loadBookings();
    setLoading(false);
  };

  const quickCleanDone = async () => {
    setLoading(true);
    const duration = computeDurationMinutes();
    const photoUrl = await uploadStatusPhoto();
    await supabase.from("status_reports").insert({
      booking_id: selected,
      status: "ok",
      note: "Vasket ferdig ✓",
      sent_at: new Date().toISOString(),
      duration_minutes: duration,
      photo_url: photoUrl,
    });
    const durationText = duration ? ` (Tidsbruk: ${formatDuration(duration)})` : "";
    await sendNotification(
      "status_report",
      booking,
      `✓ Hytta er vasket ferdig!${durationText}`,
      photoUrl
    );
    setStatusPhoto(null);
    showToast(`🧹 Vask ferdig sendt til Thomas!${duration ? ` (${formatDuration(duration)})` : ""}`);
    loadBookings();
    setLoading(false);
  };

  const cycleSupply = async (item) => {
    const newStatus = nextSupplyStatus(item.status);
    setSupplies((prev) => prev.map((s) => (s.id === item.id ? { ...s, status: newStatus } : s)));
    await supabase
      .from("supplies")
      .update({ status: newStatus, updated_at: new Date().toISOString(), updated_by: user.name })
      .eq("id", item.id);
    if (newStatus === "empty") {
      await notifySupplyEmpty(item);
      showToast(`✕ ${item.name} markert som tom — Thomas varslet!`);
    } else {
      showToast(`Oppdatert: ${item.name} → ${SUPPLY_LABEL[newStatus]}`);
    }
  };

  const startEdit = (b) => {
    const bp = b.bed_plans?.[0] || {};
    setEditData({
      ...b,
      _double: bp.double_beds ?? 0,
      _single: bp.single_beds ?? 0,
      _baby: bp.baby_bed ?? false,
    });
    setEditing(true);
  };

  const submitNewBooking = async () => {
    setNewBookingError("");
    if (!newBooking.guest.trim()) {
      setNewBookingError("Navn på gjest er påkrevd.");
      return;
    }
    if (!newBooking.check_in || !newBooking.check_out) {
      setNewBookingError("Innsjekk- og utsjekkdato er påkrevd.");
      return;
    }
    if (newBooking.check_out <= newBooking.check_in) {
      setNewBookingError("Utsjekk må være etter innsjekk.");
      return;
    }
    setLoading(true);
    const { data: inserted, error } = await supabase
      .from("bookings")
      .insert({
        guest: newBooking.guest.trim(),
        country: newBooking.country.trim() || null,
        check_in: toISODate(newBooking.check_in),
        check_out: toISODate(newBooking.check_out),
        guests: parseInt(newBooking.guests) || 1,
        obs: newBooking.obs.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error("submitNewBooking error:", error);
      setNewBookingError("Noe gikk galt ved lagring. Prøv igjen.");
      setLoading(false);
      return;
    }

    await supabase.from("bed_plans").insert({
      booking_id: inserted.id,
      double_beds: newBooking._double,
      single_beds: newBooking._single,
      baby_bed: newBooking._baby,
    });

    await sendNotification(
      "booking_updated",
      inserted,
      `Ny booking lagt inn: ${newBooking._double} dobbel, ${newBooking._single} enkel${newBooking._baby ? ", barneseng" : ""}. OBS: ${newBooking.obs || "ingen"}`
    );

    setNewBooking(emptyNewBooking);
    showToast("✅ Ny booking lagret og Jovita varslet!");
    setView("list");
    loadBookings();
    setLoading(false);
  };

  // LOGIN
  if (!user) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginBox}>
          <Logo />
          {!loginRole ? (
            <>
              <p style={styles.loginLabel}>Logg inn som</p>
              <button style={styles.btnHost} onClick={() => { setLoginRole("thomas"); setPassword(""); setLoginError(""); }}>🏠 Thomas (Utleier)</button>
              <button style={styles.btnCleaner} onClick={() => { setLoginRole("jovita"); setPassword(""); setLoginError(""); }}>🧹 Jovita (Vasker)</button>
            </>
          ) : (
            <>
              <p style={styles.loginLabel}>Passord for {loginRole === "thomas" ? "Thomas" : "Jovita"}</p>
              <input
                style={{ ...styles.input, marginBottom: 8 }}
                type="password"
                placeholder="Skriv passord..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin(loginRole)}
                autoFocus
              />
              {loginError && <p style={{ color: "#e53e3e", fontSize: 13, margin: "0 0 8px" }}>{loginError}</p>}
              <button style={loginRole === "thomas" ? styles.btnHost : styles.btnCleaner} onClick={() => handleLogin(loginRole)}>
                Logg inn
              </button>
              <button style={{ ...styles.btnCancel, marginTop: 8 }} onClick={() => setLoginRole(null)}>← Tilbake</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // NEW BOOKING VIEW (host only)
  if (view === "newBooking" && user.role === "host") {
    return (
      <div style={styles.wrap}>
        {toast && <div style={{ ...styles.toast, background: toast.type === "success" ? "#00d68f" : "#fc8181" }}>{toast.msg}</div>}
        <header style={styles.header}>
          <button style={styles.back} onClick={() => { setView("list"); setNewBooking(emptyNewBooking); setNewBookingError(""); }}>← Tilbake</button>
          <span style={styles.headerName}>{user.name}</span>
          <button style={styles.logout} onClick={() => { setUser(null); setView("list"); }}>Logg ut</button>
        </header>

        <div style={styles.detailCard}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>➕ Ny booking</div>

            <label style={styles.label}>Navn på gjest *</label>
            <input style={styles.input} type="text" placeholder="F.eks. Sarah"
              value={newBooking.guest}
              onChange={e => setNewBooking(d => ({ ...d, guest: e.target.value }))} />

            <label style={styles.label}>Land (valgfritt)</label>
            <input style={styles.input} type="text" placeholder="F.eks. USA"
              value={newBooking.country}
              onChange={e => setNewBooking(d => ({ ...d, country: e.target.value }))} />

            <label style={styles.label}>Innsjekk *</label>
            <input style={styles.input} type="date"
              value={newBooking.check_in}
              onChange={e => setNewBooking(d => ({ ...d, check_in: e.target.value }))} />

            <label style={styles.label}>Utsjekk *</label>
            <input style={styles.input} type="date"
              value={newBooking.check_out}
              onChange={e => setNewBooking(d => ({ ...d, check_out: e.target.value }))} />

            <label style={styles.label}>Antall gjester</label>
            <input style={styles.input} type="number" min="1" max="20"
              value={newBooking.guests}
              onChange={e => setNewBooking(d => ({ ...d, guests: e.target.value }))} />

            <label style={styles.label}>Dobbeltsenger</label>
            <input style={styles.input} type="number" min="0" max="5"
              value={newBooking._double}
              onChange={e => setNewBooking(d => ({ ...d, _double: parseInt(e.target.value) || 0 }))} />

            <label style={styles.label}>Enkelsenger</label>
            <input style={styles.input} type="number" min="0" max="5"
              value={newBooking._single}
              onChange={e => setNewBooking(d => ({ ...d, _single: parseInt(e.target.value) || 0 }))} />

            <label style={styles.label}>Barneseng?</label>
            <select style={styles.input} value={newBooking._baby ? "ja" : "nei"}
              onChange={e => setNewBooking(d => ({ ...d, _baby: e.target.value === "ja" }))}>
              <option value="nei">Nei</option>
              <option value="ja">Ja</option>
            </select>

            <label style={styles.label}>OBS / Spesielle instrukser</label>
            <textarea style={{ ...styles.input, height: 80 }}
              value={newBooking.obs}
              onChange={e => setNewBooking(d => ({ ...d, obs: e.target.value }))} />

            {newBookingError && <p style={{ color: "#e53e3e", fontSize: 13, margin: "0 0 10px" }}>{newBookingError}</p>}

            <button style={styles.btnSave} onClick={submitNewBooking} disabled={loading}>
              {loading ? "Lagrer..." : "💾 Lagre booking og varsle Jovita"}
            </button>
            <button style={styles.btnCancel} onClick={() => { setView("list"); setNewBooking(emptyNewBooking); setNewBookingError(""); }}>Avbryt</button>
          </div>
        </div>
      </div>
    );
  }

  // SUPPLIES VIEW
  if (view === "supplies") {
    return (
      <div style={styles.wrap}>
        {toast && <div style={{ ...styles.toast, background: toast.type === "success" ? "#00d68f" : "#fc8181" }}>{toast.msg}</div>}
        <header style={styles.header}>
          <button style={styles.back} onClick={() => setView("list")}>← Tilbake</button>
          <span style={styles.headerName}>{user.name}</span>
          <button style={styles.logout} onClick={() => { setUser(null); setView("list"); }}>Logg ut</button>
        </header>

        <div style={styles.listWrap}>
          <div style={styles.listTitle}>🧴 Forsyninger</div>
          <p style={{ fontSize: 12, color: "#718096", marginTop: -8, marginBottom: 14 }}>
            Trykk på et element for å endre status: OK → Lite igjen → Tom
          </p>
          {supplies.length === 0 && (
            <div style={styles.empty}>
              <p>Ingen forsyninger registrert ennå.</p>
              <p>Legg til i Supabase Table Editor (tabellen "supplies").</p>
            </div>
          )}
          {supplies.map((item) => (
            <div
              key={item.id}
              style={{
                ...styles.card,
                cursor: "pointer",
                borderLeft: `4px solid ${item.status === "empty" ? "#e53e3e" : item.status === "low" ? "#d97706" : "#0f2540"}`,
              }}
              onClick={() => cycleSupply(item)}
            >
              <div style={styles.cardLeft}>
                <div style={styles.cardGuest}>{item.name}</div>
                {item.updated_by && (
                  <div style={styles.cardMeta}>
                    Sist oppdatert av {item.updated_by}
                    {item.updated_at ? `, ${formatDate(item.updated_at)}` : ""}
                  </div>
                )}
              </div>
              <div style={styles.cardRight}>
                <SupplyBadge status={item.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STATISTIKK VIEW
  if (view === "stats") {
    const countryCounts = {};
    bookings.forEach((b) => {
      const c = (b.country || "").trim();
      if (!c) return;
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    });
    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const totalBookingsWithCountry = sortedCountries.reduce((sum, [, count]) => sum + count, 0);

    return (
      <div style={styles.wrap}>
        <header style={styles.header}>
          <button style={styles.back} onClick={() => setView("list")}>← Tilbake</button>
          <span style={styles.headerName}>{user.name}</span>
          <button style={styles.logout} onClick={() => { setUser(null); setView("list"); }}>Logg ut</button>
        </header>

        <div style={styles.listWrap}>
          <div style={styles.listTitle}>📊 Statistikk</div>
          <div style={{ ...styles.card, cursor: "default", marginBottom: 14 }}>
            <div style={styles.cardLeft}>
              <div style={styles.cardGuest}>{sortedCountries.length} land</div>
              <div style={styles.cardMeta}>{totalBookingsWithCountry} bookinger med land registrert</div>
            </div>
          </div>
          {sortedCountries.length === 0 && (
            <div style={styles.empty}>
              <p>Ingen land registrert på bookinger ennå.</p>
            </div>
          )}
          {sortedCountries.map(([country, count]) => (
            <div key={country} style={{ ...styles.card, cursor: "default" }}>
              <div style={styles.cardLeft}>
                <div style={styles.cardGuest}>{country}</div>
              </div>
              <div style={styles.cardRight}>
                <div style={styles.cardMeta}>{count} {count === 1 ? "booking" : "bookinger"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── FAKTURA VIEW (host only) ────────────────────────────────────────────────
  if (view === "faktura" && user.role === "host") {
    const selectedBkgs = bookings.filter((b) => fakturaBookings[b.id]?.included);
    let previewSumServices = 0;
    selectedBkgs.forEach((b) => {
      previewSumServices += guestRate(b.guests);
      const timer = parseFloat(fakturaBookings[b.id]?.ekstraTimer) || 0;
      previewSumServices += timer * 550;
    });
    const validUtlegg = utleggItems.filter((u) => u.name && parseFloat(u.amount) > 0);
    const previewSumUtlegg = validUtlegg.reduce((s, u) => s + parseFloat(u.amount), 0);
    const previewMva = previewSumServices * 0.25;
    const previewTotal = previewSumServices + previewMva + previewSumUtlegg;
    const dueDate = addDays(fakturaDate, 14);
    const anySelected = selectedBkgs.length > 0;

    return (
      <div style={styles.wrap}>
        {toast && <div style={{ ...styles.toast, background: toast.type === "success" ? "#00d68f" : "#fc8181" }}>{toast.msg}</div>}
        <header style={styles.header}>
          <button style={styles.back} onClick={() => setView("list")}>← Tilbake</button>
          <span style={styles.headerName}>{user.name}</span>
          <button style={styles.logout} onClick={() => { setUser(null); setView("list"); }}>Logg ut</button>
        </header>

        <div style={{ ...styles.listWrap, maxWidth: 520 }}>
          <div style={styles.listTitle}>🧾 Generer faktura</div>

          {/* ── Fakturadetaljer ── */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Fakturadetaljer</div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Fakturanr</label>
                <input style={styles.input} type="text" value={fakturaNum}
                  onChange={e => setFakturaNum(e.target.value)} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={styles.label}>Fakturadato</label>
                <input style={styles.input} type="date" value={fakturaDate}
                  onChange={e => setFakturaDate(e.target.value)} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#718096", margin: "-4px 0 0" }}>
              Forfall: {isoToNO(dueDate)} (14 dager)
            </p>
          </div>

          {/* ── Velg bookinger ── */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Velg bookinger å fakturere</div>
            {bookings.length === 0 && (
              <p style={{ fontSize: 13, color: "#718096" }}>Ingen bookinger funnet.</p>
            )}
            {bookings.map((b) => {
              const included = !!fakturaBookings[b.id]?.included;
              const rate = guestRate(b.guests);
              return (
                <div key={b.id} style={{
                  border: `1px solid ${included ? "#0f2540" : "#e2e8f0"}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 8,
                  background: included ? "#f0f4f8" : "#fff",
                }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={e => setFakturaBookingField(b.id, "included", e.target.checked)}
                      style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1a202c" }}>
                        {b.guest}
                      </div>
                      <div style={{ fontSize: 12, color: "#4a5568" }}>
                        Utsjekk {formatDate(b.check_out)} · {b.guests} gjester
                      </div>
                      <div style={{ fontSize: 12, color: "#00a06f", fontWeight: 600, marginTop: 2 }}>
                        {rate.toLocaleString("nb-NO")} kr (eks. mva)
                      </div>
                    </div>
                  </label>

                  {included && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...styles.label, fontSize: 11 }}>Ekstraarbeid (timer)</label>
                          <input
                            style={{ ...styles.input, marginBottom: 0 }}
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={fakturaBookings[b.id]?.ekstraTimer || ""}
                            onChange={e => setFakturaBookingField(b.id, "ekstraTimer", e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={{ ...styles.label, fontSize: 11 }}>Hva ble gjort?</label>
                          <input
                            style={{ ...styles.input, marginBottom: 0 }}
                            type="text"
                            placeholder="F.eks. klargjøring utover ordinær vask"
                            value={fakturaBookings[b.id]?.ekstraNote || ""}
                            onChange={e => setFakturaBookingField(b.id, "ekstraNote", e.target.value)}
                          />
                        </div>
                      </div>
                      {(parseFloat(fakturaBookings[b.id]?.ekstraTimer) || 0) > 0 && (
                        <div style={{ fontSize: 11, color: "#718096", marginTop: 4 }}>
                          + {((parseFloat(fakturaBookings[b.id]?.ekstraTimer) || 0) * 550).toLocaleString("nb-NO")} kr ekstraarbeid
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Utlegg ── */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Utlegg (ingen MVA)</div>
            {utleggItems.map((u, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input
                  style={{ ...styles.input, flex: 2, marginBottom: 0 }}
                  type="text"
                  placeholder="Hva (f.eks. dusjsåpe)"
                  value={u.name}
                  onChange={e => {
                    const next = [...utleggItems];
                    next[i] = { ...next[i], name: e.target.value };
                    setUtleggItems(next);
                  }}
                />
                <input
                  style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                  type="number"
                  min="0"
                  placeholder="kr"
                  value={u.amount}
                  onChange={e => {
                    const next = [...utleggItems];
                    next[i] = { ...next[i], amount: e.target.value };
                    setUtleggItems(next);
                  }}
                />
                {utleggItems.length > 1 && (
                  <button
                    style={{ background: "#fed7d7", border: "none", borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontSize: 14, color: "#822727", flexShrink: 0 }}
                    onClick={() => setUtleggItems(utleggItems.filter((_, j) => j !== i))}
                  >×</button>
                )}
              </div>
            ))}
            <button
              style={{ ...styles.btnEdit, marginTop: 4, fontSize: 13, padding: "8px 0" }}
              onClick={() => setUtleggItems([...utleggItems, { name: "", amount: "" }])}
            >
              + Legg til utlegg
            </button>
          </div>

          {/* ── Totalsum ── */}
          {anySelected && (
            <div style={{ ...styles.section, background: "#0f2540", color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span>Sum tjenester eks. mva</span>
                <span>{formatKr(previewSumServices)} kr</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span>MVA (25%)</span>
                <span>{formatKr(previewMva)} kr</span>
              </div>
              {previewSumUtlegg > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span>Utlegg (ingen mva)</span>
                  <span>{formatKr(previewSumUtlegg)} kr</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, borderTop: "1px solid #ffffff44", paddingTop: 8, marginTop: 4 }}>
                <span>TOTALT Å BETALE</span>
                <span>{formatKr(previewTotal)} kr</span>
              </div>
            </div>
          )}

          <button
            style={{
              ...styles.btnSave,
              background: anySelected ? "#00d68f" : "#e2e8f0",
              color: anySelected ? "#0f2540" : "#a0aec0",
              fontSize: 16,
              padding: "16px 0",
              marginTop: 4,
              cursor: anySelected ? "pointer" : "not-allowed",
            }}
            onClick={openFaktura}
            disabled={!anySelected}
          >
            🧾 Forhåndsvis og skriv ut faktura
          </button>
          {!anySelected && (
            <p style={{ fontSize: 12, color: "#a0aec0", textAlign: "center", marginTop: 8 }}>
              Velg minst én booking for å generere faktura
            </p>
          )}
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (view === "detail" && booking) {
    const bp = booking.bed_plans?.[0] || {};
    const sr = booking.status_reports?.[0];

    return (
      <div style={styles.wrap}>
        {toast && <div style={{ ...styles.toast, background: toast.type === "success" ? "#00d68f" : "#fc8181" }}>{toast.msg}</div>}
        <header style={styles.header}>
          <button style={styles.back} onClick={() => { setView("list"); setEditing(false); }}>← Tilbake</button>
          <span style={styles.headerName}>{user.name}</span>
          <button style={styles.logout} onClick={() => { setUser(null); setView("list"); }}>Logg ut</button>
        </header>

        <div style={styles.detailCard}>
          <div style={styles.detailTop}>
            <div>
              <div style={styles.guestName}>{booking.guest}</div>
              <div style={styles.guestDates}>{formatDate(booking.check_in)} → {formatDate(booking.check_out)}{booking.country ? ` · ${booking.country}` : ""}</div>
              <div style={styles.guestCount}>👥 {booking.guests} gjester</div>
            </div>
            <StatusBadge status={sr?.status} />
          </div>

          {editing && user.role === "host" ? (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>✏️ Rediger gjesteinfo</div>
              <label style={styles.label}>Navn på gjest</label>
              <input style={styles.input} type="text" value={editData.guest || ""}
                onChange={e => setEditData(d => ({ ...d, guest: e.target.value }))} />
              <label style={styles.label}>Land (valgfritt)</label>
              <input style={styles.input} type="text" value={editData.country || ""}
                onChange={e => setEditData(d => ({ ...d, country: e.target.value }))} />
              <label style={styles.label}>Innsjekk</label>
              <input style={styles.input} type="date" value={editData.check_in || ""}
                onChange={e => setEditData(d => ({ ...d, check_in: e.target.value }))} />
              <label style={styles.label}>Utsjekk</label>
              <input style={styles.input} type="date" value={editData.check_out || ""}
                onChange={e => setEditData(d => ({ ...d, check_out: e.target.value }))} />
              <label style={styles.label}>Antall gjester</label>
              <input style={styles.input} type="number" min="1" value={editData.guests}
                onChange={e => setEditData(d => ({ ...d, guests: parseInt(e.target.value) || 1 }))} />

              <div style={styles.sectionTitle}>✏️ Rediger oppredning</div>
              <label style={styles.label}>Dobbeltsenger</label>
              <input style={styles.input} type="number" min="0" max="5" value={editData._double}
                onChange={e => setEditData(d => ({ ...d, _double: parseInt(e.target.value) || 0 }))} />
              <label style={styles.label}>Enkelsenger</label>
              <input style={styles.input} type="number" min="0" max="5" value={editData._single}
                onChange={e => setEditData(d => ({ ...d, _single: parseInt(e.target.value) || 0 }))} />
              <label style={styles.label}>Barneseng?</label>
              <select style={styles.input} value={editData._baby ? "ja" : "nei"}
                onChange={e => setEditData(d => ({ ...d, _baby: e.target.value === "ja" }))}>
                <option value="nei">Nei</option>
                <option value="ja">Ja</option>
              </select>
              <label style={styles.label}>OBS / Spesielle instrukser</label>
              <textarea style={{ ...styles.input, height: 80 }} value={editData.obs || ""}
                onChange={e => setEditData(d => ({ ...d, obs: e.target.value }))} />
              <button style={styles.btnSave} onClick={saveBedPlan} disabled={loading}>
                {loading ? "Lagrer..." : "💾 Lagre og varsle Jovita"}
              </button>
              <button style={styles.btnCancel} onClick={() => setEditing(false)}>Avbryt</button>
            </div>
          ) : (
            <>
              <div style={styles.section}>
                <div style={styles.sectionTitle}>🛏️ Oppredningsplan</div>
                <div style={styles.bedGrid}>
                  <div style={styles.bedItem}>
                    <div style={styles.bedNum}>{bp.double_beds ?? "–"}</div>
                    <div style={styles.bedLabel}>Dobbelt</div>
                  </div>
                  <div style={styles.bedItem}>
                    <div style={styles.bedNum}>{bp.single_beds ?? "–"}</div>
                    <div style={styles.bedLabel}>Enkel</div>
                  </div>
                  <div style={styles.bedItem}>
                    <div style={styles.bedNum}>{bp.baby_bed ? "✓" : "–"}</div>
                    <div style={styles.bedLabel}>Barneseng</div>
                  </div>
                </div>
              </div>

              {booking.obs ? (
                <div style={styles.obsBox}>
                  <div style={styles.obsTitle}>⚠️ OBS</div>
                  <div style={styles.obsText}>{booking.obs}</div>
                </div>
              ) : null}

              {user.role === "host" && (
                <button style={styles.btnEdit} onClick={() => startEdit(booking)}>✏️ Rediger booking</button>
              )}
            </>
          )}

          {user.role === "cleaner" && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>📋 Statusrapport etter utsjekk</div>
              {sr ? (
                <div style={styles.statusDone}>
                  <StatusBadge status={sr.status} />
                  <div style={styles.statusNote}>{sr.note}</div>
                  {sr.photo_url && (
                    <img src={sr.photo_url} alt="Bilde fra rapport" style={styles.reportPhoto} />
                  )}
                  {sr.duration_minutes != null && (
                    <div style={styles.statusTime}>⏱ Tidsbruk: {formatDuration(sr.duration_minutes)}</div>
                  )}
                  <div style={styles.statusTime}>Sendt: {new Date(sr.sent_at).toLocaleString("no-NO")}</div>
                </div>
              ) : !booking.cleaning_started_at ? (
                <>
                  <p style={{ fontSize: 13, color: "#718096", marginTop: -4, marginBottom: 14 }}>
                    Trykk når du faktisk begynner å vaske — det gir riktig tidsbruk.
                  </p>
                  <button style={styles.btnQuickDone} onClick={startCleaning} disabled={loading}>
                    {loading ? "Starter..." : "▶️ Start vask"}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "#a0aec0", marginTop: -4, marginBottom: 12 }}>
                    ⏱ Vask startet: {new Date(booking.cleaning_started_at).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div style={styles.radioRow}>
                    <label style={styles.radioLabel}>
                      <input type="radio" name="status" value="ok" checked={statusType === "ok"} onChange={() => setStatusType("ok")} /> Alt bra
                    </label>
                    <label style={styles.radioLabel}>
                      <input type="radio" name="status" value="obs" checked={statusType === "obs"} onChange={() => setStatusType("obs")} /> Obs / Avvik
                    </label>
                  </div>
                  <textarea style={{ ...styles.input, height: 80 }}
                    placeholder={statusType === "ok" ? "Valgfri kommentar..." : "Beskriv avviket..."}
                    value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                  <label style={styles.label}>📷 Bilde (valgfritt)</label>
                  <input style={styles.input} type="file" accept="image/*" capture="environment"
                    onChange={e => setStatusPhoto(e.target.files?.[0] || null)} />
                  {statusPhoto && (
                    <p style={{ fontSize: 12, color: "#00a06f", marginTop: -6, marginBottom: 10 }}>
                      ✓ {statusPhoto.name} valgt
                    </p>
                  )}
                  <button style={styles.btnSend} onClick={submitStatus} disabled={loading}>
                    {loading ? "Sender..." : "📤 Send status til Thomas"}
                  </button>
                  <p style={{ fontSize: 12, color: "#a0aec0", textAlign: "center", margin: "16px 0 8px" }}>
                    eller
                  </p>
                  <button style={styles.btnQuickDone} onClick={quickCleanDone} disabled={loading}>
                    {loading ? "Sender..." : "🧹 Vask ferdig!"}
                  </button>
                </>
              )}
            </div>
          )}

          {user.role === "host" && sr && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>📋 Status fra Jovita</div>
              <div style={styles.statusDone}>
                <StatusBadge status={sr.status} />
                <div style={styles.statusNote}>{sr.note}</div>
                {sr.photo_url && (
                  <img src={sr.photo_url} alt="Bilde fra rapport" style={styles.reportPhoto} />
                )}
                {sr.duration_minutes != null && (
                  <div style={styles.statusTime}>⏱ Tidsbruk: {formatDuration(sr.duration_minutes)}</div>
                )}
                <div style={styles.statusTime}>Mottatt: {new Date(sr.sent_at).toLocaleString("no-NO")}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div style={styles.wrap}>
      {toast && <div style={{ ...styles.toast, background: toast.type === "success" ? "#00d68f" : "#fc8181" }}>{toast.msg}</div>}
      <header style={styles.header}>
        <span style={styles.headerTitle}>Hovden Hytteservice</span>
        <div style={styles.headerRight}>
          {user.role === "host" && (
            <button style={styles.newBookingBtn} onClick={() => setView("newBooking")}>➕ Ny booking</button>
          )}
          {user.role === "host" && (
            <button style={styles.fakturaBtn} onClick={() => setView("faktura")}>🧾 Faktura</button>
          )}
          <button style={styles.suppliesBtn} onClick={() => setView("supplies")}>🧴 Forsyninger</button>
          <button style={styles.suppliesBtn} onClick={() => setView("stats")}>📊 Statistikk</button>
          <span style={styles.headerName}>{user.name}</span>
          <button style={styles.logout} onClick={() => setUser(null)}>Logg ut</button>
        </div>
      </header>

      <div style={styles.listWrap}>
        <div style={styles.listTitle}>Bookinger</div>
        {loading && <p style={{ color: "#718096", fontSize: 14 }}>Laster...</p>}
        {bookings.length === 0 && !loading && (
          <div style={styles.empty}>
            <p>Ingen bookinger ennå.</p>
            {user.role === "host" && <p>Trykk "➕ Ny booking" over for å legge til.</p>}
          </div>
        )}
        {bookings.map((b) => {
          const sr = b.status_reports?.[0];
          return (
            <div key={b.id} style={styles.card} onClick={() => { setSelected(b.id); setView("detail"); }}>
              <div style={styles.cardLeft}>
                <div style={styles.cardGuest}>{b.guest}</div>
                <div style={styles.cardDates}>{formatDate(b.check_in)} → {formatDate(b.check_out)}{b.country ? ` · ${b.country}` : ""}</div>
                <div style={styles.cardMeta}>👥 {b.guests} gjester · {guestRate(b.guests).toLocaleString("nb-NO")} kr</div>
                {b.obs && <div style={styles.cardObs}>⚠️ Har OBS</div>}
              </div>
              <div style={styles.cardRight}>
                <StatusBadge status={sr?.status} />
                <div style={styles.chevron}>›</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", background: "#f0f4f8", minHeight: "100vh", color: "#1a202c" },
  toast: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", padding: "12px 24px", borderRadius: 10, color: "#0f2540", fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: "0 4px 16px #0003" },
  header: { background: "#0f2540", color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  headerName: { fontSize: 13, color: "#00d68f", fontWeight: 600 },
  back: { background: "none", border: "none", color: "#00d68f", fontSize: 14, cursor: "pointer", padding: 0 },
  logout: { background: "none", border: "1px solid #ffffff44", color: "#fff", fontSize: 12, borderRadius: 6, padding: "4px 10px", cursor: "pointer" },
  suppliesBtn: { background: "#00d68f22", border: "1px solid #00d68f", color: "#00d68f", fontSize: 12, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontWeight: 600 },
  fakturaBtn: { background: "#00d68f44", border: "1px solid #00d68f", color: "#fff", fontSize: 12, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontWeight: 700 },
  newBookingBtn: { background: "#00d68f", border: "1px solid #00d68f", color: "#0f2540", fontSize: 12, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontWeight: 700 },
  loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f0f4f8" },
  loginBox: { background: "#fff", borderRadius: 16, padding: 36, textAlign: "center", boxShadow: "0 4px 24px #0002", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 280 },
  loginLabel: { color: "#4a5568", fontSize: 14, margin: 0 },
  btnHost: { width: "100%", padding: "12px 0", background: "#0f2540", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  btnCleaner: { width: "100%", padding: "12px 0", background: "#00d68f", color: "#0f2540", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  listWrap: { padding: 16, maxWidth: 480, margin: "0 auto" },
  listTitle: { fontWeight: 700, fontSize: 15, color: "#0f2540", marginBottom: 12, marginTop: 8 },
  card: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px #0001", cursor: "pointer", borderLeft: "4px solid #0f2540" },
  cardLeft: { flex: 1 },
  cardGuest: { fontWeight: 700, fontSize: 15, marginBottom: 3 },
  cardDates: { fontSize: 13, color: "#4a5568", marginBottom: 3 },
  cardMeta: { fontSize: 12, color: "#718096" },
  cardObs: { fontSize: 12, color: "#d97706", marginTop: 4, fontWeight: 600 },
  cardRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 },
  chevron: { fontSize: 20, color: "#a0aec0" },
  detailCard: { padding: 16, maxWidth: 480, margin: "0 auto" },
  detailTop: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", boxShadow: "0 2px 8px #0001" },
  guestName: { fontWeight: 700, fontSize: 18, marginBottom: 4 },
  guestDates: { fontSize: 13, color: "#4a5568", marginBottom: 3 },
  guestCount: { fontSize: 13, color: "#718096" },
  section: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 2px 8px #0001" },
  sectionTitle: { fontWeight: 700, fontSize: 13, color: "#0f2540", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  bedGrid: { display: "flex", gap: 12 },
  bedItem: { flex: 1, background: "#f0f4f8", borderRadius: 10, padding: "12px 8px", textAlign: "center" },
  bedNum: { fontSize: 22, fontWeight: 700, color: "#0f2540" },
  bedLabel: { fontSize: 11, color: "#718096", marginTop: 2 },
  obsBox: { background: "#fffbeb", border: "1px solid #f6e05e", borderRadius: 12, padding: 14, marginBottom: 12 },
  obsTitle: { fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 },
  obsText: { fontSize: 13, color: "#78350f", lineHeight: 1.5 },
  badgeNone: { fontSize: 11, background: "#e2e8f0", color: "#718096", borderRadius: 20, padding: "3px 10px", fontWeight: 600 },
  badgeOk: { fontSize: 11, background: "#c6f6d5", color: "#22543d", borderRadius: 20, padding: "3px 10px", fontWeight: 600 },
  badgeObs: { fontSize: 11, background: "#fefcbf", color: "#744210", borderRadius: 20, padding: "3px 10px", fontWeight: 600 },
  badgeEmpty: { fontSize: 11, background: "#fed7d7", color: "#822727", borderRadius: 20, padding: "3px 10px", fontWeight: 600 },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" },
  label: { fontSize: 12, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 4 },
  btnSave: { width: "100%", padding: "12px 0", background: "#0f2540", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 8 },
  btnCancel: { width: "100%", padding: "12px 0", background: "#e2e8f0", color: "#4a5568", border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer" },
  btnEdit: { width: "100%", padding: "12px 0", background: "#edf2f7", color: "#0f2540", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  btnSend: { width: "100%", padding: "12px 0", background: "#00d68f", color: "#0f2540", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  btnQuickDone: { width: "100%", padding: "16px 0", background: "#0f2540", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer" },
  radioRow: { display: "flex", gap: 20, marginBottom: 12 },
  radioLabel: { fontSize: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
  statusDone: { background: "#f0fff4", borderRadius: 10, padding: 14 },
  statusNote: { fontSize: 13, color: "#2d3748", marginTop: 8, lineHeight: 1.5 },
  reportPhoto: { width: "100%", borderRadius: 10, marginTop: 10, display: "block" },
  statusTime: { fontSize: 11, color: "#a0aec0", marginTop: 6 },
  empty: { textAlign: "center", color: "#718096", fontSize: 14, marginTop: 40 },
};
