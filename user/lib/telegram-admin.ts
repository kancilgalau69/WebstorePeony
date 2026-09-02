function parseAdminIds(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((id) => id.replace(/["']/g, '').trim())
    .filter(Boolean)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendTelegramToAdmins(text: string, context = 'TELEGRAM:admin') {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const adminIds = parseAdminIds(process.env.TELEGRAM_ADMIN_IDS)

  if (!token || adminIds.length === 0) {
    console.warn(`[${context}] Telegram env missing`, { hasToken: Boolean(token), adminCount: adminIds.length })
    return
  }

  await Promise.all(adminIds.map(async (chatId) => {
    let lastError = ''

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
          }),
        })

        if (response.ok) return

        const body = await response.text()
        lastError = `HTTP ${response.status}: ${body.slice(0, 300)}`
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await sleep(300 * attempt)
          continue
        }
        break
      } catch (error: any) {
        lastError = String(error?.message || error)
        if (attempt < 3) await sleep(300 * attempt)
      }
    }

    console.warn(`[${context}] Telegram send failed`, { chatId, error: lastError || 'unknown_error' })
  }))
}

export function formatTelegramCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0) || 0)
}
