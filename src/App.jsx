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
  return d; // input[type=date] already gives YYYY-MM-DD
};

const formatDuration = (minutes) => {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
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
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [loginRole, setLoginRole] = useState(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [newBookingError, setNewBookingError] = useState("");

  const handleLogin = (role) => {
    const u = USERS[role];
    if (password === u.password) {
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

  // Load bookings from Supabase — includes related bed_plans and status_reports
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

  // Load supplies from Supabase
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

  // Realtime subscription
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

  // Auto-record cleaning start time when Jovita opens a booking with no report yet
  useEffect(() => {
    if (view !== "detail" || !booking || user?.role !== "cleaner") return;
    const sr = booking.status_reports?.[0];
    if (!sr && !booking.cleaning_started_at) {
      supabase
        .from("bookings")
        .update({ cleaning_started_at: new Date().toISOString() })
        .eq("id", booking.id)
        .then(() => loadBookings());
    }
  }, [view, selected]);

  const sendNotification = async (type, b, message) => {
    await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        guest: b.guest,
        checkIn: formatDate(b.check_in),
        checkOut: formatDate(b.check_out),
        message,
      }),
    });
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
    await supabase.from("bookings").update({ obs: editData.obs }).eq("id", editData.id);
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

  const computeDurationMinutes = () => {
    if (!booking?.cleaning_started_at) return null;
    const started = new Date(booking.cleaning_started_at).getTime();
    return Math.max(1, Math.round((Date.now() - started) / 60000));
  };

  // Full status report (with optional comment)
  const submitStatus = async () => {
    setLoading(true);
    const duration = computeDurationMinutes();
    await supabase.from("status_reports").insert({
      booking_id: selected,
      status: statusType,
      note: statusNote,
      sent_at: new Date().toISOString(),
      duration_minutes: duration,
    });
    const durationText = duration ? ` (Tidsbruk: ${formatDuration(duration)})` : "";
    await sendNotification(
      "status_report",
      booking,
      `${statusType === "ok" ? "✓ Alt bra" : "⚠ Obs"}: ${statusNote || "Ingen kommentar"}${durationText}`
    );
    setStatusNote("");
    showToast("📤 Status sendt til Thomas!");
    loadBookings();
    setLoading(false);
  };

  // Quick one-tap "Vask ferdig!" — sends an "ok" status immediately, no form needed
  const quickCleanDone = async () => {
    setLoading(true);
    const duration = computeDurationMinutes();
    await supabase.from("status_reports").insert({
      booking_id: selected,
      status: "ok",
      note: "Vasket ferdig ✓",
      sent_at: new Date().toISOString(),
      duration_minutes: duration,
    });
    const durationText = duration ? ` (Tidsbruk: ${formatDuration(duration)})` : "";
    await sendNotification(
      "status_report",
      booking,
      `✓ Hytta er vasket ferdig!${durationText}`
    );
    showToast(`🧹 Vask ferdig sendt til Thomas!${duration ? ` (${formatDuration(duration)})` : ""}`);
    loadBookings();
    setLoading(false);
  };

  const cycleSupply = async (item) => {
    const newStatus = nextSupplyStatus(item.status);
    // optimistic update
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
              <div style={styles.guestName}>{booking.country} {booking.guest}</div>
              <div style={styles.guestDates}>{formatDate(booking.check_in)} → {formatDate(booking.check_out)}</div>
              <div style={styles.guestCount}>👥 {booking.guests} gjester</div>
            </div>
            <StatusBadge status={sr?.status} />
          </div>

          {editing && user.role === "host" ? (
            <div style={styles.section}>
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
                <button style={styles.btnEdit} onClick={() => startEdit(booking)}>✏️ Rediger instrukser</button>
              )}
            </>
          )}

          {/* Status for cleaner */}
          {user.role === "cleaner" && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>📋 Statusrapport etter utsjekk</div>
              {sr ? (
                <div style={styles.statusDone}>
                  <StatusBadge status={sr.status} />
                  <div style={styles.statusNote}>{sr.note}</div>
                  {sr.duration_minutes != null && (
                    <div style={styles.statusTime}>⏱ Tidsbruk: {formatDuration(sr.duration_minutes)}</div>
                  )}
                  <div style={styles.statusTime}>Sendt: {new Date(sr.sent_at).toLocaleString("no-NO")}</div>
                </div>
              ) : (
                <>
                  {booking.cleaning_started_at && (
                    <p style={{ fontSize: 12, color: "#a0aec0", marginTop: -4, marginBottom: 12 }}>
                      ⏱ Vask startet: {new Date(booking.cleaning_started_at).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  <button style={styles.btnQuickDone} onClick={quickCleanDone} disabled={loading}>
                    {loading ? "Sender..." : "🧹 Vask ferdig!"}
                  </button>
                  <p style={{ fontSize: 12, color: "#a0aec0", textAlign: "center", margin: "8px 0 16px" }}>
                    eller send en detaljert rapport under
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
                  <button style={styles.btnSend} onClick={submitStatus} disabled={loading}>
                    {loading ? "Sender..." : "📤 Send status til Thomas"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Status for host */}
          {user.role === "host" && sr && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>📋 Status fra Jovita</div>
              <div style={styles.statusDone}>
                <StatusBadge status={sr.status} />
                <div style={styles.statusNote}>{sr.note}</div>
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
          <button style={styles.suppliesBtn} onClick={() => setView("supplies")}>🧴 Forsyninger</button>
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
                <div style={styles.cardGuest}>{b.country} {b.guest}</div>
                <div style={styles.cardDates}>{formatDate(b.check_in)} → {formatDate(b.check_out)}</div>
                <div style={styles.cardMeta}>👥 {b.guests} gjester</div>
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
  statusTime: { fontSize: 11, color: "#a0aec0", marginTop: 6 },
  empty: { textAlign: "center", color: "#718096", fontSize: 14, marginTop: 40 },
};
