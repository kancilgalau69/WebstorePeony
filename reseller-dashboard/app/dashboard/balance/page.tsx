"use client";
import { useEffect, useState } from "react";
import { useReseller } from "@/components/ResellerProvider";
import Pagination from "@/components/Pagination";

interface BalanceData {
  saldo: number;
  total_penjualan: number;
  total_komisi: number;
  pending_withdrawal: number;
  withdrawals: Withdrawal[];
}

interface Withdrawal {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  admin_notes: string;
  created_at: string;
  processed_at: string | null;
}

function WithdrawalBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    pending: "Menunggu",
    approved: "Disetujui",
    completed: "Selesai",
    rejected: "Ditolak",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

export default function BalancePage() {
  const { reseller, refresh } = useReseller();
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [wdForm, setWdForm] = useState({
    amount: "",
    bank_name: "",
    account_number: "",
    account_name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [wdError, setWdError] = useState("");
  const [wdSuccess, setWdSuccess] = useState(false);
  const [wdPage, setWdPage] = useState(1);
  const [wdPageSize, setWdPageSize] = useState(10);

  useEffect(() => {
    fetchBalance();
  }, []);

  async function fetchBalance() {
    try {
      const res = await fetch(`/api/dashboard/balance?_t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setWdError("");
    setWdSuccess(false);

    const amount = parseFloat(wdForm.amount);
    if (!amount || amount <= 0) {
      setWdError("Jumlah harus lebih dari 0");
      setSubmitting(false);
      return;
    }

    if (amount > (data?.saldo || 0)) {
      setWdError("Saldo tidak mencukupi");
      setSubmitting(false);
      return;
    }

    if (!wdForm.bank_name || !wdForm.account_number || !wdForm.account_name) {
      setWdError("Semua field wajib diisi");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/dashboard/balance/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          bank_name: wdForm.bank_name,
          account_number: wdForm.account_number,
          account_name: wdForm.account_name,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setWdError(json.error || "Gagal mengajukan withdraw");
        return;
      }

      setWdSuccess(true);
      setWdForm({ amount: "", bank_name: "", account_number: "", account_name: "" });
      setShowWithdrawForm(false);
      fetchBalance();
      refresh();
      setTimeout(() => setWdSuccess(false), 3000);
    } catch {
      setWdError("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-28 border border-gray-100"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-tour="balance-root" className="space-y-6">
      {/* Balance Cards */}
      <div data-tour="balance-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa-solid fa-wallet"></i>
            <span className="text-xs text-white/80">Saldo Tersedia</span>
          </div>
          <div className="text-2xl font-bold">Rp {(data?.saldo || 0).toLocaleString("id-ID")}</div>
        </div>
        <div className="stat-card bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa-solid fa-chart-line text-blue-500"></i>
            <span className="text-xs text-gray-500">Total Penjualan</span>
          </div>
          <div className="text-xl font-bold text-[#141a33]">
            Rp {(data?.total_penjualan || 0).toLocaleString("id-ID")}
          </div>
        </div>
        <div className="stat-card bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa-solid fa-coins text-amber-500"></i>
            <span className="text-xs text-gray-500">Total Komisi</span>
          </div>
          <div className="text-xl font-bold text-[#141a33]">
            Rp {(data?.total_komisi || 0).toLocaleString("id-ID")}
          </div>
        </div>
        <div className="stat-card bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa-solid fa-clock text-yellow-500"></i>
            <span className="text-xs text-gray-500">Pending WD</span>
          </div>
          <div className="text-xl font-bold text-[#141a33]">
            Rp {(data?.pending_withdrawal || 0).toLocaleString("id-ID")}
          </div>
        </div>
      </div>

      {/* Withdraw Action */}
      <div data-tour="balance-withdraw-panel" className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#141a33]">Tarik Saldo</h3>
            <p className="text-sm text-gray-500">Ajukan penarikan saldo ke rekening Anda</p>
          </div>
          <button
            onClick={() => setShowWithdrawForm(!showWithdrawForm)}
            data-tour="balance-withdraw-toggle-button"
            className="px-5 py-2.5 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white rounded-xl text-sm font-semibold shadow-lg shadow-[#5c63f2]/25 hover:shadow-[#5c63f2]/40 transition-all"
          >
            <i className="fa-solid fa-money-bill-transfer mr-2"></i>
            Withdraw
          </button>
        </div>

        {wdSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-4">
            <i className="fa-solid fa-check-circle mr-2"></i>
            Permintaan withdraw berhasil diajukan! Admin akan memproses dalam 1x24 jam.
          </div>
        )}

        {showWithdrawForm && (
          <form data-tour="balance-withdraw-form" onSubmit={handleWithdraw} className="p-4 bg-[#f4f5ff] rounded-xl border border-[#e5e7ff] space-y-4">
            {wdError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                <i className="fa-solid fa-circle-exclamation mr-2"></i>{wdError}
              </div>
            )}

            <div data-tour="balance-withdraw-amount-bank" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  value={wdForm.amount}
                  onChange={(e) => setWdForm({ ...wdForm, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
                  placeholder="Minimal Rp 50.000"
                  min="50000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                <select
                  value={wdForm.bank_name}
                  onChange={(e) => setWdForm({ ...wdForm, bank_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
                  required
                >
                  <option value="">Pilih Bank</option>
                  <option value="BCA">BCA</option>
                  <option value="BNI">BNI</option>
                  <option value="BRI">BRI</option>
                  <option value="Mandiri">Mandiri</option>
                  <option value="BSI">BSI</option>
                  <option value="CIMB">CIMB Niaga</option>
                  <option value="Permata">Permata</option>
                  <option value="DANA">DANA</option>
                  <option value="OVO">OVO</option>
                  <option value="GoPay">GoPay</option>
                  <option value="ShopeePay">ShopeePay</option>
                </select>
              </div>
            </div>

            <div data-tour="balance-withdraw-account" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Rekening</label>
                <input
                  type="text"
                  value={wdForm.account_number}
                  onChange={(e) => setWdForm({ ...wdForm, account_number: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
                  placeholder="Nomor rekening"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik Rekening</label>
                <input
                  type="text"
                  value={wdForm.account_name}
                  onChange={(e) => setWdForm({ ...wdForm, account_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
                  placeholder="Nama sesuai rekening"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                data-tour="balance-withdraw-submit-button"
                className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin"></i> Memproses...
                  </span>
                ) : (
                  "Ajukan Withdraw"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowWithdrawForm(false)}
                className="px-6 py-2.5 bg-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-300 transition"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Withdrawal History */}
      <div data-tour="balance-withdraw-history" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-[#141a33]">Riwayat Withdraw</h3>
        </div>
        {data?.withdrawals && data.withdrawals.length > 0 ? (
          <>
            <div className="px-6 pt-3">
              <Pagination
                currentPage={wdPage}
                totalItems={data.withdrawals.length}
                pageSize={wdPageSize}
                onPageChange={setWdPage}
                onPageSizeChange={setWdPageSize}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Tanggal</th>
                    <th className="px-6 py-3 text-right">Jumlah</th>
                    <th className="px-6 py-3 text-left">Bank</th>
                    <th className="px-6 py-3 text-left">No. Rekening</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-left">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(wdPageSize === 0 ? data.withdrawals : data.withdrawals.slice((wdPage - 1) * wdPageSize, wdPage * wdPageSize)).map((wd) => (
                    <tr key={wd.id} className="table-row-hover">
                      <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(wd.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold">
                        Rp {(wd.amount || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-3 text-gray-700">{wd.bank_name}</td>
                      <td className="px-6 py-3 text-gray-600 font-mono text-xs">
                        {wd.account_number} ({wd.account_name})
                      </td>
                      <td className="px-6 py-3 text-center">
                        <WithdrawalBadge status={wd.status} />
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{wd.admin_notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <i className="fa-solid fa-money-bill-transfer text-4xl mb-3"></i>
            <p>Belum ada riwayat withdraw</p>
          </div>
        )}
      </div>
    </div>
  );
}
