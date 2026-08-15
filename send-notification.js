export default async (req) => {
  const { type, guest, checkIn, checkOut, message } = await req.json()

  const RESEND_API_KEY = process.env.RESEND_API_KEY

  const JOVITA_EMAIL = 'jovitakakia@gmail.com'
  const THOMAS_EMAIL = 'thnyga@online.no'

  let to, subject, html

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
          <a href="https://ekstrah-nd-bnb.netlify.app" 
             style="display: inline-block; background: #0f2540; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            Åpne appen
          </a>
        </div>
      </div>
    `
  } else if (type === 'status_report') {
    // Jovita sent status → notify Thomas
    to = THOMAS_EMAIL
    subject = `📊 Statusrapport fra Jovita – ${guest}`
    html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #0f2540; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: #00d68f; margin: 0;">Ekstrahånd</h2>
          <p style="color: #fff; margin: 4px 0 0;">Hytteservice & IT-løsninger</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
          <h3 style="color: #0f2540;">Statusrapport fra Jovita</h3>
          <p><strong>Gjest:</strong> ${guest}</p>
          <p><strong>Inn/ut:</strong> ${checkIn} → ${checkOut}</p>
          <p><strong>Status:</strong> ${message}</p>
          <a href="https://ekstrah-nd-bnb.netlify.app" 
             style="display: inline-block; background: #0f2540; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
            Åpne appen
          </a>
        </div>
      </div>
    `
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Ekstrahånd <onboarding@resend.dev>',
      to,
      subject,
      html
    })
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), { status: res.ok ? 200 : 500 })
}

export const config = { path: '/api/send-notification' }
