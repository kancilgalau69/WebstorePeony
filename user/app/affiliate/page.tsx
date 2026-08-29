'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

interface Earning {
  id: string
  order_code: string
  order_amount: number
  commission_percent: number
  commission_amount: number
  status: string
  created_at: string
}

interface Withdrawal {
  id: string
  amount: number
  bank_name: string
  account_number: string
  account_name: string
  status: string
  admin_notes: string | null
  processed_at: string | null
  created_at: string
}

interface AffiliateData {
  enabled: boolean
  affiliate: {
    id: string
    affiliate_code: string
    saldo: number
    available_saldo: number
    pending_withdrawal: number
    total_earnings: number
    total_withdrawn: number
    total_orders: number
    total_clicks: number
    is_active: boolean
  }
  settings: {
    commission_percent: number
    min_withdraw: number
  }
  earnings: Earning[]
  withdrawals: Withdrawal[]
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-[#FEF08A] text-[#C56676]',
    approved: 'bg-[#DBEAFE] text-[#1E40AF]',
    completed: 'bg-[#DCFCE7] text-[#15803D]',
    rejected: 'bg-[#FFE4E6] text-[#BE123C]',
    paid: 'bg-[#DCFCE7] text-[#15803D]',
    reversed: 'bg-[#FFE4E6] text-[#BE123C]',
  }
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    approved: 'Disetujui',
    completed: 'Selesai',
    rejected: 'Ditolak',
    paid: 'Dibayar',
    reversed: 'Dibatalkan',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${styles[status] || 'bg-[#FBEEF1] text-[#9E6B72]'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function AffiliatePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<AffiliateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [wdForm, setWdForm] = useState({ amount: '', bank_name: '', account_number: '', account_name: '' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login?redirect=/affiliate')
      return
    }
    fetchData()
  }, [user, authLoading])

  async function fetchData() {
    try {
      const res = await fetch('/api/affiliate', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setData(json)
    } catch (err) {
      console.error('Failed to fetch affiliate:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatIDR = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`
  const formatDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const shareableLink = typeof window !== 'undefined' && data?.affiliate
    ? `${window.location.origin}/?ref=${data.affiliate.affiliate_code}`
    : ''

  const copyLink = () => {
    if (!shareableLink) return
    navigator.clipboard.writeText(shareableLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const amount = parseFloat(wdForm.amount)
    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: 'Jumlah harus lebih dari 0' })
      setSubmitting(false)
      return
    }
    if (!wdForm.bank_name || !wdForm.account_number || !wdForm.account_name) {
      setMessage({ type: 'error', text: 'Semua field wajib diisi' })
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bank_name: wdForm.bank_name,
          account_number: wdForm.account_number,
          account_name: wdForm.account_name,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || 'Gagal mengajukan withdraw' })
      } else {
        setMessage({ type: 'success', text: 'Permintaan withdraw berhasil diajukan!' })
        setWdForm({ amount: '', bank_name: '', account_number: '', account_name: '' })
        setShowWithdraw(false)
        fetchData()
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan' })
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="py-12 text-center text-[#9E6B72]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Affiliate...</p>
      </div>
    )
  }

  if (!data) return null

  if (!data.enabled) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 animate-fadeIn text-center">
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs space-y-4">
          <div className="text-5xl text-[#DB8291] mb-2">🌸</div>
          <h1 className="font-fredoka text-2xl text-[#720002]">Program Affiliate Belum Aktif</h1>
          <p className="text-xs text-[#9E6B72]">Hubungi admin untuk informasi pendaftaran affiliate.</p>
          <Link href="/profile" className="btn-card-buy w-full py-3 text-xs">
            Kembali ke Profil ✦
          </Link>
        </div>
      </div>
    )
  }

  const { affiliate, settings, earnings, withdrawals } = data

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-4 space-y-6 animate-fadeIn">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-bold text-[#9E6B72]">
        <Link href="/profile" className="hover:text-[#DB8291]">
          <i className="fa-solid fa-user mr-1"></i> Profil
        </Link>
        <i className="fa-solid fa-chevron-right text-[9px] text-[#E7A6B1]"></i>
        <span className="text-[#720002]">Program Affiliate</span>
      </nav>

      {message && (
        <div className={`p-3 rounded-2xl text-xs font-extrabold ${
          message.type === 'success' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFE4E6] text-[#BE123C]'
        }`}>
          {message.text}
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#DB8291] to-[#E7A6B1] rounded-3xl p-6 md:p-8 text-white shadow-xs space-y-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold mb-2">
            💖 Program Affiliate
          </span>
          <h1 className="font-fredoka text-2xl md:text-3xl">Bagikan &amp; Dapatkan Komisi 🌸</h1>
          <p className="text-xs font-bold text-white/90 mt-1">
            Dapatkan komisi sebesar <span className="underline font-extrabold">{settings.commission_percent}%</span> dari setiap pembelian melalui link referral Anda!
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/20 space-y-3">
          <div>
            <p className="text-[10px] font-extrabold text-white/80 uppercase tracking-wider mb-1">Kode Affiliate Anda</p>
            <div className="font-fredoka text-2xl tracking-widest bg-white/20 px-3 py-1.5 rounded-xl inline-block">
              {affiliate.affiliate_code}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-white/80 uppercase tracking-wider mb-1">Link Referral</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareableLink}
                className="flex-1 px-3 py-2 rounded-xl bg-white/20 text-xs font-mono text-white outline-none border border-white/30"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 rounded-xl bg-white text-[#DB8291] font-extrabold text-xs hover:bg-white/90"
              >
                {copied ? '✓ Disalin' : 'Salin Link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border-2 border-[#F4D6DC] p-4 shadow-xs">
          <p className="text-xs font-extrabold text-[#9E6B72]">Saldo Tersedia</p>
          <p className="font-fredoka text-xl text-[#DB8291] mt-1">{formatIDR(affiliate.available_saldo)}</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-[#F4D6DC] p-4 shadow-xs">
          <p className="text-xs font-extrabold text-[#9E6B72]">Total Komisi</p>
          <p className="font-fredoka text-xl text-[#720002] mt-1">{formatIDR(affiliate.total_earnings)}</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-[#F4D6DC] p-4 shadow-xs">
          <p className="text-xs font-extrabold text-[#9E6B72]">Total Order</p>
          <p className="font-fredoka text-xl text-[#720002] mt-1">{affiliate.total_orders}</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-[#F4D6DC] p-4 shadow-xs">
          <p className="text-xs font-extrabold text-[#9E6B72]">Total Klik</p>
          <p className="font-fredoka text-xl text-[#720002] mt-1">{affiliate.total_clicks}</p>
        </div>
      </div>

      {/* Withdraw Box */}
      <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-fredoka text-xl text-[#720002]">Pencairan Saldo</h2>
            <p className="text-xs font-bold text-[#9E6B72]">Min withdrawal: {formatIDR(settings.min_withdraw)}</p>
          </div>
          <button
            onClick={() => setShowWithdraw(!showWithdraw)}
            disabled={affiliate.available_saldo < settings.min_withdraw}
            className="btn-card-buy px-4 py-2 text-xs"
          >
            Tarik Saldo ✦
          </button>
        </div>

        {showWithdraw && (
          <form onSubmit={handleWithdraw} className="pt-4 border-t-2 border-[#F4D6DC] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="number"
                value={wdForm.amount}
                onChange={e => setWdForm({ ...wdForm, amount: e.target.value })}
                placeholder={`Nominal (Min ${formatIDR(settings.min_withdraw)})`}
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-xs font-extrabold outline-none"
                required
              />
              <select
                value={wdForm.bank_name}
                onChange={e => setWdForm({ ...wdForm, bank_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-xs font-extrabold outline-none"
                required
              >
                <option value="">Pilih Bank / E-Wallet</option>
                <option value="BCA">BCA</option>
                <option value="Mandiri">Mandiri</option>
                <option value="BRI">BRI</option>
                <option value="BNI">BNI</option>
                <option value="DANA">DANA</option>
                <option value="OVO">OVO</option>
                <option value="GoPay">GoPay</option>
                <option value="ShopeePay">ShopeePay</option>
              </select>
              <input
                type="text"
                value={wdForm.account_number}
                onChange={e => setWdForm({ ...wdForm, account_number: e.target.value })}
                placeholder="Nomor Rekening / HP E-Wallet"
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-xs font-extrabold outline-none"
                required
              />
              <input
                type="text"
                value={wdForm.account_name}
                onChange={e => setWdForm({ ...wdForm, account_name: e.target.value })}
                placeholder="Nama Pemilik Rekening"
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-xs font-extrabold outline-none"
                required
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-card-buy w-full py-3 text-xs">
              {submitting ? 'Memproses...' : 'Kirim Pengajuan Withdraw ✦'}
            </button>
          </form>
        )}
      </div>

      {/* History Tables */}
      <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 shadow-xs space-y-4">
        <h2 className="font-fredoka text-xl text-[#720002]">Riwayat Komisi</h2>
        {earnings.length === 0 ? (
          <p className="text-xs text-[#9E6B72] font-bold text-center py-4">Belum ada komisi tercatat.</p>
        ) : (
          <div className="space-y-2">
            {earnings.map(e => (
              <div key={e.id} className="bg-[#FBEEF1] rounded-2xl p-3 flex justify-between items-center text-xs font-bold text-[#9E6B72]">
                <div>
                  <p className="text-[#720002]">{e.order_code}</p>
                  <p className="text-[10px]">{formatDate(e.created_at)}</p>
                </div>
                <div className="text-right">
                  <span className="font-fredoka text-sm text-[#DB8291] block">+{formatIDR(e.commission_amount)}</span>
                  <StatusBadge status={e.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
