import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const USERS = {
  thomas: { name: "Thomas", role: "host" },
  jovita: { name: "Jovita", role: "cleaner" },
};

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
};

const StatusBadge = ({ status }) => {
  if (!status) return <span style={styles.badgeNone}>Ikke rapportert</span>;
  if (status === "ok") return <span style={styles.badgeOk}>✓ Alt bra</span>;
  if (status === "obs") return <span style={styles.badgeObs}>⚠ Obs</span>;
  return null;
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

export default function App() {
  const [user, setUser] = useState(null);
  const [Bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [statusNote, setStatusNote] = useState("");
  const [statusType, setStatusType] = useState("ok");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const booking = Bookings.find((b) => b.id === selected);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load Bookings from Supabase
  const loadBookings = async () => {
    setLoading(true);
    const { data: bData } = await supabase
      .from("bookings")
      .select("*, bed_plans(*), status_reports(*)")
      .order("check_in", { ascending: true });
    if (bData) setBookings(bData);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadBookings();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        loadBookings();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

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
    await supabase.from(bookings).update({ obs: editData.obs }).eq("id", editData.id);
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

  const submitStatus = async () => {
    setLoading(true);
    await supabase.from("status_reports").insert({
      booking_id: selected,
      status: statusType,
      note: statusNote,
      sent_at: new Date().toISOString(),
    });
    await sendNotification(
      "status_report",
      booking,
      `${statusType === "ok" ? "✓ Alt bra" : "⚠ Obs"}: ${statusNote || "Ingen kommentar"}`
    );
    setStatusNote("");
    showToast("📤 Status sendt til Thomas!");
    loadBookings();
    setLoading(false);
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

  // LOGIN
  if (!user) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginBox}>
          <Logo />
          <p style={styles.loginLabel}>Logg inn som</p>
          <button style={styles.btnHost} onClick={() => setUser(USERS.thomas)}>🏠 Thomas (Utleier)</button>
          <button style={styles.btnCleaner} onClick={() => setUser(USERS.jovita)}>🧹 Jovita (Vasker)</button>
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
                  <div style={styles.statusTime}>Sendt: {new Date(sr.sent_at).toLocaleString("no-NO")}</div>
                </div>
              ) : (
                <>
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
          <span style={styles.headerName}>{user.name}</span>
          <button style={styles.logout} onClick={() => setUser(null)}>Logg ut</button>
        </div>
      </header>

      <div style={styles.listWrap}>
        <div style={styles.listTitle}>Bookinger</div>
        {loading && <p style={{ color: "#718096", fontSize: 14 }}>Laster...</p>}
        {Bookings.length === 0 && !loading && (
          <div style={styles.empty}>
            <p>Ingen bookinger ennå.</p>
            {user.role === "host" && <p>Legg til bookinger i Supabase Table Editor.</p>}
          </div>
        )}
        {Bookings.map((b) => {
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
  header: { background: "#0f2540", color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  headerName: { fontSize: 13, color: "#00d68f", fontWeight: 600 },
  back: { background: "none", border: "none", color: "#00d68f", fontSize: 14, cursor: "pointer", padding: 0 },
  logout: { background: "none", border: "1px solid #ffffff44", color: "#fff", fontSize: 12, borderRadius: 6, padding: "4px 10px", cursor: "pointer" },
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
  input: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" },
  label: { fontSize: 12, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 4 },
  btnSave: { width: "100%", padding: "12px 0", background: "#0f2540", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 8 },
  btnCancel: { width: "100%", padding: "12px 0", background: "#e2e8f0", color: "#4a5568", border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer" },
  btnEdit: { width: "100%", padding: "12px 0", background: "#edf2f7", color: "#0f2540", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  btnSend: { width: "100%", padding: "12px 0", background: "#00d68f", color: "#0f2540", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  radioRow: { display: "flex", gap: 20, marginBottom: 12 },
  radioLabel: { fontSize: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
  statusDone: { background: "#f0fff4", borderRadius: 10, padding: 14 },
  statusNote: { fontSize: 13, color: "#2d3748", marginTop: 8, lineHeight: 1.5 },
  statusTime: { fontSize: 11, color: "#a0aec0", marginTop: 6 },
  empty: { textAlign: "center", color: "#718096", fontSize: 14, marginTop: 40 },
};
