import webpush from 'web-push'

const SUPABASE_URL = 'https://zyhntpadiipxxeaylxvd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5aG50cGFkaWlweHhlYXlseHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjAwMTIsImV4cCI6MjA5ODAzNjAxMn0.sKPg-VPXX_dvdWvrlKO6uhvPfLvaz1Z00S46omm8hZQ'

// Which role should get a push notification for each notification type.
// "cleaner" = Jovita, "host" = Thomas.
const PUSH_TARGET_ROLE = {
  booking_updated: 'cleaner',
  arrival_report: 'host',
  status_report: 'host',
  supply_empty: 'host',
}

const PUSH_TITLE = {
  booking_updated: '📋 Thomas oppdaterte en booking',
  arrival_report: '📍 Jovita har ankommet',
  status_report: '✅ Vask ferdig',
  supply_empty: '🧴 Forsyning trenger påfyll',
}

async function sendPushNotifications(type, guest, message) {
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return // not configured yet — skip quietly

  const role = PUSH_TARGET_ROLE[type]
  if (!role) return

  webpush.setVapidDetails('mailto:jovitakakia@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  // Fetch subscriptions for this role directly from Supabase's REST API
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?role=eq.${role}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  )
  if (!res.ok) return
  const subs = await res.json()
  if (!subs.length) return

  const title = PUSH_TITLE[type] || 'Hovden Hytteservice'
  const payload = JSON.stringify({
    title,
    body: guest ? `${guest}: ${message}` : message,
    url: 'https://ekstrahaand.no',
  })

  await Promise.all(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }
      try {
        await webpush.sendNotification(subscription, payload)
      } catch (err) {
        // 404/410 = the browser unsubscribed or the subscription expired — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
            {
              method: 'DELETE',
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
            }
          )
        }
      }
    })
  )
}

export default async (req) => {
  const { type, guest, checkIn, checkOut, message, photoUrl } = await req.json()
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  const JOVITA_EMAIL = 'jovitakakia@gmail.com'
  const THOMAS_EMAIL = 'thnyga@online.no'

  // Added bcc to our list of variables
  let to, bcc, subject, html

  if (type === 'booking_updated') {
    // Thomas updated instructions → notify Jovita
    to = JOVITA_EMAIL
    subject = `📋 Oppdaterte instrukser – ${guest}`
    html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #0f2540; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: #00d68f; margin: 0;">Ekstrahånd</h2>
          <p style="color: #fff; margin: 4px 0 0;">Hytteservice & IT-løsninger</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
          <h3 style="color: #0f2540;">Nye instrukser fra Thomas</h3>
          <p><strong>Gjest:</strong> ${guest}</p>
          <p><strong>Inn/ut:</strong> ${checkIn} → ${checkOut}</p>
          <p><strong>Melding:</strong> ${message}</p>
          <a href="https://ekstrahaand.no"
             style="display: inline-block; background: #0f2540; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            Åpne appen
          </a>
        </div>
      </div>
    `
  } else if (type === 'arrival_report') {
    // Jovita arrived and sent initial status → notify Thomas AND copy Jovita. Cleaning starts now.
    to = THOMAS_EMAIL
    bcc = JOVITA_EMAIL
    subject = `📍 Jovita har ankommet – ${guest}`
    html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #0f2540; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: #00d68f; margin: 0;">Ekstrahånd</h2>
          <p style="color: #fff; margin: 4px 0 0;">Hytteservice & IT-løsninger</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
          <h3 style="color: #0f2540;">📍 Ankomststatus fra Jovita</h3>
          <p><strong>Gjest:</strong> ${guest}</p>
          <p><strong>Inn/ut:</strong> ${checkIn} → ${checkOut}</p>
          <p><strong>Status:</strong> ${message}</p>
          ${photoUrl ? `<img src="${photoUrl}" alt="Bilde fra ankomst" style="width:100%;max-width:460px;border-radius:10px;margin-top:8px;" />` : ''}
          <p style="color:#718096;font-size:13px;margin-top:12px;">Vask er nå startet.</p>
          <a href="https://ekstrahaand.no"
             style="display: inline-block; background: #0f2540; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            Åpne appen
          </a>
        </div>
      </div>
    `
  } else if (type === 'status_report') {
    // Jovita sent the finished-cleaning report → notify Thomas AND copy Jovita
    to = THOMAS_EMAIL
    bcc = JOVITA_EMAIL
    subject = `✅ Ferdigrapport fra Jovita – ${guest}`
    html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #0f2540; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: #00d68f; margin: 0;">Ekstrahånd</h2>
          <p style="color: #fff; margin: 4px 0 0;">Hytteservice & IT-løsninger</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
          <h3 style="color: #0f2540;">✅ Ferdigrapport fra Jovita</h3>
          <p><strong>Gjest:</strong> ${guest}</p>
          <p><strong>Inn/ut:</strong> ${checkIn} → ${checkOut}</p>
          <p><strong>Status:</strong> ${message}</p>
          ${photoUrl ? `<img src="${photoUrl}" alt="Bilde fra rapport" style="width:100%;max-width:460px;border-radius:10px;margin-top:8px;" />` : ''}
          <a href="https://ekstrahaand.no"
             style="display: inline-block; background: #0f2540; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            Åpne appen
          </a>
        </div>
      </div>
    `
  } else if (type === 'supply_empty') {
    // A supply item ran out or is low → notify Thomas AND copy Jovita
    to = THOMAS_EMAIL
    bcc = JOVITA_EMAIL
    subject = `🧴 Forsyning – ${message}`
    html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #0f2540; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: #00d68f; margin: 0;">Ekstrahånd</h2>
          <p style="color: #fff; margin: 4px 0 0;">Hytteservice & IT-løsninger</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
          <h3 style="color: #0f2540;">🧴 Forsyning</h3>
          <p>${message}</p>
          <a href="https://ekstrahaand.no"
             style="display: inline-block; background: #0f2540; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            Åpne appen
          </a>
        </div>
      </div>
    `
  }

  // Build the email payload — uses the verified ekstrahaand.no domain, no testing override
  const emailPayload = {
    from: 'Ekstrahånd <post@ekstrahaand.no>',
    to: to,
    subject: subject,
    html: html
  }

  // Only add the BCC field if it has an email address assigned to it
  if (bcc) {
    emailPayload.bcc = bcc
  }

  const [emailRes] = await Promise.all([
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    }),
    sendPushNotifications(type, guest, message).catch((err) => {
      console.error('push notification error:', err)
    }),
  ])

  const data = await emailRes.json()
  return new Response(JSON.stringify(data), { status: emailRes.ok ? 200 : 500 })
}

export const config = { path: '/api/send-notification' }
