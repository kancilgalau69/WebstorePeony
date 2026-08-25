/**
 * Email delivery for reseller orders.
 * Supports SMTP (nodemailer) and Resend (fetch-based, no extra dependency).
 * Uses the same env vars as user web: EMAIL_PROVIDER, SMTP_*, RESEND_*.
 */

export type OrderEmailItem = {
  productName: string
  productCode: string
  quantity: number
  price: number
  itemData?: string | null
}

export type OrderEmailPayload = {
  orderId: string
  customerName: string
  customerEmail: string
  totalAmount: number
  items: OrderEmailItem[]
  storeName?: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeItemDataText(text: string) {
  return String(text).replace(/\s*\|\|\s*/g, '\n').trim()
}

function itemDataLines(itemData?: string | null): string[] {
  if (!itemData) return []
  return String(itemData)
    .split(/\r?\n/)
    .map(line => normalizeItemDataText(line))
    .filter(Boolean)
}

function buildEmail(payload: OrderEmailPayload) {
  const { orderId, customerName, customerEmail, totalAmount, items, storeName } = payload
  const storeLabel = storeName || 'Toko Digital'

  const subject = `Pesanan Berhasil - ${orderId}`

  // Plain text version
  const textItemSections = items
    .map((item, idx) => {
      const dataLines = itemDataLines(item.itemData)
      const lines: string[] = [
        `${idx + 1}. ${item.productName}`,
        `   - Kode: ${item.productCode}`,
        `   - Qty: ${item.quantity}x @ ${formatCurrency(item.price)}`,
      ]
      if (dataLines.length > 0) {
        lines.push('   - Detail Item:')
        for (let i = 0; i < dataLines.length; i++) {
          lines.push(`     #${i + 1}: ${dataLines[i]}`)
        }
      } else {
        lines.push('   - Detail Item: (akan dikirim segera)')
      }
      return lines.join('\n')
    })
    .join('\n\n')

  const text = [
    `Halo ${customerName},`,
    '',
    `Pembayaran Anda di ${storeLabel} sudah berhasil diproses.`,
    'Berikut detail pesanan dan item digital Anda:',
    '',
    `Order ID: ${orderId}`,
    `Email: ${customerEmail}`,
    '',
    '=== ITEM PEMBELIAN ===',
    textItemSections || '(Tidak ada item)',
    '',
    `Total: ${formatCurrency(totalAmount)}`,
    '',
    'Simpan email ini sebagai bukti pembelian Anda.',
    'Jika ada kendala, hubungi toko dengan menyertakan Order ID.',
  ].join('\n')

  // HTML version
  const htmlItemSections = items
    .map((item, idx) => {
      const dataLines = itemDataLines(item.itemData)
      const dataHtml = dataLines.length
        ? `<div style="margin-top:8px;"><strong>Detail Item:</strong><ol style="margin:6px 0 0 18px;padding:0;">${dataLines
            .map(line => `<li><pre style="display:inline;white-space:pre-wrap;font-family:monospace;">${escapeHtml(line)}</pre></li>`)
            .join('')}</ol></div>`
        : '<div style="margin-top:8px;color:#a16207;">Detail item akan dikirim segera.</div>'

      return `
        <div style="border:1px solid #d1fae5;background:#f0fdf4;border-radius:10px;padding:14px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${idx + 1}. ${escapeHtml(item.productName)}</div>
          <div>Kode: <strong>${escapeHtml(item.productCode)}</strong></div>
          <div>Qty: <strong>${item.quantity}x</strong> @ ${formatCurrency(item.price)}</div>
          ${dataHtml}
        </div>
      `
    })
    .join('')

  const html = `
    <div style="font-family:Segoe UI,Roboto,Arial,sans-serif;max-width:720px;margin:0 auto;color:#111827;line-height:1.5;">
      <h2 style="margin:0 0 10px;color:#065f46;">Pembayaran Berhasil</h2>
      <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0 0 14px;">Pembayaran Anda di <strong>${escapeHtml(storeLabel)}</strong> sudah berhasil. Berikut detail pesanan Anda:</p>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;background:#f9fafb;margin-bottom:14px;">
        <div>Order ID: <strong>${escapeHtml(orderId)}</strong></div>
        <div>Email: <strong>${escapeHtml(customerEmail)}</strong></div>
      </div>

      <h3 style="margin:0 0 10px;">Item Pembelian</h3>
      ${htmlItemSections || '<p>Tidak ada item.</p>'}

      <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:12px;">
        <div style="font-size:16px;">Total: <strong>${formatCurrency(totalAmount)}</strong></div>
      </div>

      <p style="margin-top:14px;">Simpan email ini sebagai bukti pembelian Anda.</p>
      <p style="margin-top:8px;">Jika ada kendala, hubungi toko dan sertakan Order ID di atas.</p>
    </div>
  `

  return { subject, text, html }
}

function resolveEmailProvider(): 'smtp' | 'resend' {
  const explicit = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase()
  if (explicit === 'resend') return 'resend'
  if (explicit === 'smtp') return 'smtp'
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) return 'resend'
  return 'smtp'
}

async function sendViaResend(to: string, subject: string, text: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const fromEmail = String(process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || '').trim()
  const fromName = String(process.env.RESEND_FROM_NAME || process.env.SMTP_FROM_NAME || 'Toko Digital').trim()

  if (!apiKey || !fromEmail) {
    return { ok: false, error: 'Resend API key or from email not configured' }
  }

  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return { ok: false, error: `Resend API error ${response.status}: ${errBody}` }
    }

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: `Resend fetch error: ${err.message}` }
  }
}

async function sendViaSmtp(to: string, subject: string, text: string, html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Dynamic import nodemailer (it's added as dependency)
    const nodemailer = await import('nodemailer')

    const smtpUrl = String(process.env.SMTP_URL || '').trim()
    const host = String(process.env.SMTP_HOST || '').trim()
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
    const user = String(process.env.SMTP_USER || '').trim()
    const pass = String(process.env.SMTP_PASS || '').trim()
    const fromEmail = String(process.env.SMTP_FROM_EMAIL || user).trim()
    const fromName = String(process.env.SMTP_FROM_NAME || 'Toko Digital').trim()

    if (!smtpUrl && (!host || !port)) {
      return { ok: false, error: 'SMTP host/port not configured' }
    }

    let transporter: any
    if (smtpUrl) {
      transporter = nodemailer.default.createTransport(smtpUrl)
    } else {
      transporter = nodemailer.default.createTransport({
        host,
        port,
        secure,
        auth: user ? { user, pass } : undefined,
      })
    }

    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail

    await transporter.sendMail({ from, to, subject, text, html })
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: `SMTP error: ${err.message}` }
  }
}

/**
 * Send order delivery email to customer after successful payment.
 * Retries up to 3 times with exponential backoff.
 */
export async function sendResellerOrderEmail(payload: OrderEmailPayload): Promise<{ ok: boolean; error?: string }> {
  const email = String(payload.customerEmail || '').trim().toLowerCase()
  if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    return { ok: false, error: 'Invalid customer email' }
  }

  const { subject, text, html } = buildEmail(payload)
  const provider = resolveEmailProvider()
  const maxAttempts = 3

  let lastError = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = provider === 'resend'
      ? await sendViaResend(email, subject, text, html)
      : await sendViaSmtp(email, subject, text, html)

    if (result.ok) return { ok: true }

    lastError = result.error || 'Unknown error'
    console.error(`[Email] Attempt ${attempt}/${maxAttempts} failed:`, lastError)

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1500 * Math.pow(2, attempt - 1)))
    }
  }

  return { ok: false, error: lastError }
}
