import { Resend } from 'resend'

let resendCache: { apiKey: string; client: Resend } | null = null

function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) throw new Error('RESEND_API_KEY belum dikonfigurasi')
  if (!resendCache || resendCache.apiKey !== apiKey) {
    resendCache = { apiKey, client: new Resend(apiKey) }
  }
  return resendCache.client
}

function fromAddress() {
  const email = (process.env.RESEND_FROM_EMAIL || '').trim()
  if (!email) throw new Error('RESEND_FROM_EMAIL belum dikonfigurasi')
  const name = (process.env.RESEND_FROM_NAME || 'Peony Store').trim()
  return `${name} <${email}>`
}

export async function sendPasswordVerificationCode(params: {
  to: string
  name: string
  code: string
  purpose: 'forgot_password' | 'change_password'
}) {
  const title = params.purpose === 'forgot_password' ? 'Kode Reset Password' : 'Kode Ubah Password'
  const text = [
    title,
    '',
    `Halo ${params.name || 'Peony'},`,
    `Kode verifikasi kamu adalah: ${params.code}`,
    '',
    'Kode ini berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.',
    '',
    'Peony Store',
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #F4D6DC;border-radius:18px;background:#fff;">
      <h2 style="color:#720002;margin:0 0 12px;">${title}</h2>
      <p style="color:#8A3A44;">Halo <strong>${params.name || 'Peony'}</strong>, gunakan kode berikut untuk ${params.purpose === 'forgot_password' ? 'reset password' : 'mengubah password'} akun kamu.</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:800;color:#720002;background:#FBEEF1;border:2px solid #F4D6DC;border-radius:14px;padding:16px;text-align:center;margin:20px 0;">${params.code}</div>
      <p style="color:#9E6B72;font-size:13px;">Kode ini berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.</p>
      <p style="color:#DB8291;font-weight:700;margin-top:24px;">Peony Store</p>
    </div>`

  const response = await getResendClient().emails.send({
    from: fromAddress(),
    to: params.to,
    subject: `${title} - Peony Store`,
    text,
    html,
  })

  if ((response as any).error) throw new Error(String((response as any).error?.message || 'Gagal mengirim email'))
  return response
}
