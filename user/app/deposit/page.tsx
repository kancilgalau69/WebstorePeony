'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 200000, 500000]

type TxRow = {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string | null
  status: string
  created_at: string
}

export default function DepositPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // active topup / QR state
  const [qrString, setQrString] = useState('')
  const [payAmount, setPayAmount] = useState(0)
  const [adminFee, setAdminFee] = useState(0)
  const [baseAmount, setBaseAmount] = useState(0)
  const [topupId, setTopupId] = useState('')
  const [status, setStatus] = useState<'idle' | 'pending' | 'completed'>('idle')
  const pollRef = useRef<any>(null)

  const formatPrice = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login?redirect=/deposit'); return }
      const data = await res.json()
      if (res.ok) {
        setBalance(Number(data.balance || 0))
        setTransactions(data.transactions || [])
      }
    } catch {}
  }, [router])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login?redirect=/deposit'); return }
    if (user) loadWallet()
  }, [authLoading, user, router, loadWallet])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const qrImageSrc = qrString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`
    : ''

  const startTopup = async () => {
    setError('')
    const amt = Math.round(Number(amount))
    if (!amt || amt < 1000) { setError('Minimal deposit Rp 1.000'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      })
      const data = await res.json()
      if (res.status === 401) { router.push('/login?redirect=/deposit'); return }
      if (!res.ok) { setError(data.error || 'Gagal membuat deposit'); return }
      setQrString(data.qrString || '')
      setPayAmount(Number(data.amount || 0))
      setAdminFee(Number(data.adminFee || 0))
      setBaseAmount(Number(data.baseAmount || amt))
      setTopupId(data.topupId || '')
      setStatus('pending')
      // start polling
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => checkStatus(data.topupId), 5000)
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const checkStatus = async (id?: string) => {
    const tid = id || topupId
    if (!tid) return
    try {
      const res = await fetch(`/api/wallet/topup?topup_id=${encodeURIComponent(tid)}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.status === 'completed') {
        if (pollRef.current) clearInterval(pollRef.current)
        setStatus('completed')
        await loadWallet()
      } else if (data.status === 'expired' || data.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current)
        setStatus('idle')
        setQrString('')
        setError('Deposit kedaluwarsa. Silakan ulangi.')
      }
    } catch {}
  }

  const resetTopup = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setQrString(''); setStatus('idle'); setTopupId(''); setAmount('')
  }

  if (authLoading || (!user && !authLoading)) {
    return <div className="py-16 text-center text-[#9E6B72] font-fredoka">Memuat...</div>
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6 animate-fadeIn">
      {/* Balance card */}
      <div className="rounded-3xl berry-gradient text-white p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-wider text-white/80">Saldo Anda</p>
          <p className="font-fredoka text-4xl mt-1">{balance === null ? '...' : formatPrice(balance)}</p>
          <p className="text-[11px] text-white/70 mt-2">Saldo bisa dipakai untuk pembayaran instan saat checkout.</p>
        </div>
      </div>

      {status !== 'completed' && !qrString && (
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 shadow-xs space-y-4">
          <h2 className="font-fredoka text-xl text-[#720002]">Deposit Saldo</h2>

          {error && (
            <div className="bg-[#FFE4E6] border border-[#C81E3A]/20 text-[#C81E3A] rounded-2xl p-3 text-xs font-bold">{error}</div>
          )}

          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                className={`py-2.5 rounded-2xl border-2 font-extrabold text-xs transition ${
                  Number(amount) === a
                    ? 'bg-gradient-to-r from-[#DB8291] to-[#E7A6B1] text-white border-transparent'
                    : 'bg-[#FBEEF1] text-[#720002] border-[#F4D6DC] hover:border-[#DB8291]'
                }`}
              >
                {formatPrice(a)}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">Nominal Deposit</label>
            <input
              type="number"
              min={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Masukkan nominal (min. Rp 1.000)"
              className="w-full px-4 py-3 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
            />
          </div>

          <button onClick={startTopup} disabled={loading} className="btn-card-buy w-full py-3.5 text-xs">
            {loading ? 'Memproses...' : 'Lanjut Bayar via QRIS ✦'}
          </button>
        </div>
      )}

      {/* QR to pay */}
      {status === 'pending' && qrString && (
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 shadow-xs text-center space-y-4">
          <h2 className="font-fredoka text-xl text-[#720002]">Scan untuk Deposit</h2>
          <div className="bg-[#FBEEF1] border-2 border-[#F4D6DC] rounded-2xl p-5 inline-block mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImageSrc} alt="QRIS Deposit" className="w-56 h-56 mx-auto" />
          </div>
          <div className="rounded-2xl bg-[#FBEEF1] p-4 space-y-1.5 text-left">
            <div className="flex justify-between text-xs font-bold text-[#9E6B72]"><span>Deposit</span><span className="text-[#720002]">{formatPrice(baseAmount)}</span></div>
            {adminFee > 0 && <div className="flex justify-between text-xs font-bold text-[#9E6B72]"><span>Biaya Admin (kode unik)</span><span className="text-[#720002]">{formatPrice(adminFee)}</span></div>}
            <div className="flex justify-between items-center pt-1 border-t border-[#F4D6DC]"><span className="text-xs font-extrabold text-[#720002] uppercase">Total Bayar</span><span className="font-fredoka text-2xl text-[#DB8291]">{formatPrice(payAmount)}</span></div>
            <p className="text-[10px] text-[#9E6B72] font-bold pt-1">⚠️ Bayar tepat sesuai nominal agar terverifikasi otomatis. Saldo masuk = {formatPrice(baseAmount)}.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => checkStatus()} className="flex-1 py-3 rounded-2xl border-2 border-[#F4D6DC] bg-white font-extrabold text-xs text-[#720002] hover:border-[#DB8291]">Cek Status</button>
            <button onClick={resetTopup} className="flex-1 py-3 rounded-2xl border-2 border-[#FFE4E6] bg-[#FFE4E6] font-extrabold text-xs text-[#C81E3A]">Batal</button>
          </div>
          <p className="text-[10px] text-[#9E6B72]">Halaman ini otomatis cek status tiap 5 detik.</p>
        </div>
      )}

      {/* Success */}
      {status === 'completed' && (
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs text-center space-y-3">
          <div className="text-5xl">💖</div>
          <h2 className="font-fredoka text-2xl text-[#720002]">Deposit Berhasil!</h2>
          <p className="text-xs text-[#9E6B72] font-bold">Saldo Anda sudah bertambah. Selamat berbelanja!</p>
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={resetTopup} className="btn-card-buy w-full py-3 text-xs">Deposit Lagi</button>
            <Link href="/" className="block text-center text-xs font-extrabold text-[#DB8291] pt-1 hover:underline">← Kembali ke Shop</Link>
          </div>
        </div>
      )}

      {/* Transaction history */}
      {transactions.length > 0 && status !== 'pending' && (
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 shadow-xs">
          <h3 className="font-fredoka text-lg text-[#720002] mb-3">Riwayat Saldo</h3>
          <div className="space-y-2">
            {transactions.map((t) => {
              const isCredit = t.type === 'topup' || t.type === 'refund'
              return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-[#F4D6DC] last:border-0">
                  <div>
                    <p className="text-xs font-extrabold text-[#720002]">{t.description || (isCredit ? 'Top up saldo' : 'Pembelian')}</p>
                    <p className="text-[10px] text-[#9E6B72]">{new Date(t.created_at).toLocaleString('id-ID')}</p>
                  </div>
                  <span className={`font-extrabold text-sm ${isCredit ? 'text-[#2E7D5B]' : 'text-[#C81E3A]'}`}>
                    {isCredit ? '+' : '-'}{formatPrice(Number(t.amount))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
