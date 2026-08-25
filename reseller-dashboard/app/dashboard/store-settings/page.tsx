"use client";
import { useEffect, useState } from "react";
import { useReseller } from "@/components/ResellerProvider";

export default function StoreSettingsPage() {
  const { reseller, refresh } = useReseller();
  const [form, setForm] = useState({
    nama_toko: "",
    slug: "",
    deskripsi: "",
    alamat: "",
    phone: "",
    whatsapp: "",
    instagram: "",
    warna_tema: "#5c63f2",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch(`/api/dashboard/store-settings?_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.reseller) {
          setForm({
            nama_toko: data.reseller.nama_toko || "",
            slug: data.reseller.slug || "",
            deskripsi: data.reseller.deskripsi || "",
            alamat: data.reseller.alamat || "",
            phone: data.reseller.phone || "",
            whatsapp: data.reseller.whatsapp || "",
            instagram: data.reseller.instagram || "",
            warna_tema: data.reseller.warna_tema || "#5c63f2",
            logo_url: data.reseller.logo_url || "",
          });
        }
      }
    } catch {}
    setLoaded(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/dashboard/store-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
        return;
      }

      setSuccess(true);
      // Refetch from DB to confirm save
      await fetchSettings();
      refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess(false);

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("Password baru tidak cocok");
      setChangingPassword(false);
      return;
    }

    if (passwordForm.new.length < 8) {
      setPasswordError("Password minimal 8 karakter");
      setChangingPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/dashboard/store-settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.new,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Gagal mengubah password");
        return;
      }

      setPasswordSuccess(true);
      setPasswordForm({ current: "", new: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError("Terjadi kesalahan");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div data-tour="store-settings-root" className="space-y-6 max-w-2xl">
      {/* Store Info Form */}
      <form data-tour="store-settings-info-form" onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-[#141a33]">Informasi Toko</h3>
          <p className="text-sm text-gray-500 mt-1">Atur informasi toko yang ditampilkan ke pelanggan</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
            <i className="fa-solid fa-check-circle mr-2"></i>Pengaturan berhasil disimpan!
          </div>
        )}

        <div data-tour="store-settings-name-slug" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
            <input
              type="text"
              value={form.nama_toko}
              onChange={(e) => setForm({ ...form, nama_toko: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) =>
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                }
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
                required
              />
            </div>
          </div>
        </div>

        <div data-tour="store-settings-description-address">
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Toko</label>
          <textarea
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none resize-none"
            placeholder="Deskripsi singkat toko Anda..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
          <input
            type="text"
            value={form.alamat}
            onChange={(e) => setForm({ ...form, alamat: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
            placeholder="Alamat toko (opsional)"
          />
        </div>

        <div data-tour="store-settings-contact" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
              placeholder="6282xxxxxxxxx"
            />
          </div>
        </div>

        <div data-tour="store-settings-branding" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
                placeholder="username"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warna Tema</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.warna_tema}
                onChange={(e) => setForm({ ...form, warna_tema: e.target.value })}
                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={form.warna_tema}
                onChange={(e) => setForm({ ...form, warna_tema: e.target.value })}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none font-mono"
              />
            </div>
          </div>
        </div>

        <div data-tour="store-settings-logo">
          <label className="block text-sm font-medium text-gray-700 mb-1">URL Logo</label>
          <input
            type="url"
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
            placeholder="https://example.com/logo.png"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          data-tour="store-settings-save-button"
          className="w-full py-3 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white font-semibold rounded-xl shadow-lg shadow-[#5c63f2]/25 hover:shadow-[#5c63f2]/40 transition-all disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <i className="fa-solid fa-spinner fa-spin"></i> Menyimpan...
            </span>
          ) : (
            "Simpan Pengaturan"
          )}
        </button>
      </form>

      {/* Change Password */}
      <form data-tour="store-settings-password-form" onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-[#141a33]">Ubah Password</h3>
          <p className="text-sm text-gray-500 mt-1">Pastikan password baru Anda aman</p>
        </div>

        {passwordError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>{passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
            <i className="fa-solid fa-check-circle mr-2"></i>Password berhasil diubah!
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
          <input
            type="password"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
            <input
              type="password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={changingPassword}
          className="px-6 py-2.5 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition disabled:opacity-50"
        >
          {changingPassword ? (
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin"></i> Mengubah...
            </span>
          ) : (
            "Ubah Password"
          )}
        </button>
      </form>

      {/* Store Link Preview */}
      <div data-tour="store-settings-link-preview" className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-[#141a33] mb-2">Link Toko Anda</h3>
        <p className="text-sm text-gray-500 mb-3">Bagikan link ini ke pelanggan Anda</p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
          <i className="fa-solid fa-link text-[#5c63f2]"></i>
          <code className="text-sm text-[#141a33] flex-1 truncate">
            {process.env.NEXT_PUBLIC_RESELLER_WEB_URL || "http://localhost:3003"}/{form.slug}
          </code>
          <button
            onClick={() => {
              const url = `${process.env.NEXT_PUBLIC_RESELLER_WEB_URL || "http://localhost:3003"}/${form.slug}`;
              navigator.clipboard.writeText(url);
            }}
            className="px-3 py-1.5 bg-[#5c63f2] text-white rounded-lg text-xs font-medium hover:bg-[#4f55e0]"
          >
            <i className="fa-solid fa-copy mr-1"></i> Salin
          </button>
        </div>
      </div>
    </div>
  );
}
