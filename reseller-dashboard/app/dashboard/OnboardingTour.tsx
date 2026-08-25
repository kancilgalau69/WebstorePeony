"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";

const TOUR_STORAGE_PREFIX = "reseller_dashboard_onboarding_done_v1";

type TourStep = {
  element: string;
  title: string;
  description: string;
  beforeClick?: string;
  beforeClicks?: string[];
  waitFor?: string;
  optional?: boolean;
  skipIfBeforeMissing?: boolean;
  delayMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const PAGE_TOURS: Record<string, TourStep[]> = {
  "/dashboard": [
    {
      element: '[data-tour="dashboard-home-welcome"]',
      title: "Ringkasan Reseller",
      description: "Halaman ini merangkum performa toko reseller Anda: komisi, order, pendapatan, grafik, dan order terbaru.",
    },
    {
      element: '[data-tour="dashboard-home-stats"]',
      title: "Statistik Utama",
      description: "Pantau saldo komisi, total order, pendapatan bulan ini, dan komisi bulan ini secara cepat.",
    },
    {
      element: '[data-tour="dashboard-home-lifetime-stats"]',
      title: "Statistik Lifetime",
      description: "Bagian ini menunjukkan total penjualan, total komisi, dan jumlah order hari ini.",
    },
    {
      element: '[data-tour="dashboard-home-orders-chart-card"]',
      title: "Grafik Order",
      description: "Grafik ini membantu Anda melihat tren order selama 7 hari terakhir.",
    },
    {
      element: '[data-tour="dashboard-home-recent-orders"]',
      title: "Order Terbaru",
      description: "Order terbaru tampil di sini. Gunakan link Lihat Semua untuk membuka riwayat order lengkap.",
    },
  ],
  "/dashboard/orders": [
    {
      element: '[data-tour="orders-stats"]',
      title: "Statistik Order",
      description: "Lihat total order, order selesai, total penjualan, dan total komisi dari order reseller Anda.",
    },
    {
      element: '[data-tour="orders-filters"]',
      title: "Filter & Pencarian",
      description: "Cari order berdasarkan ID, nama, email, atau nomor telepon. Anda juga bisa menyaring berdasarkan status order.",
    },
    {
      element: '[data-tour="orders-list-card"]',
      title: "Daftar Order",
      description: "Klik baris order untuk membuka detail customer, pembayaran, modal, komisi, dan item digital.",
    },
    {
      element: '[data-tour="orders-expanded-detail"]',
      beforeClick: '[data-tour="orders-row"]',
      waitFor: '[data-tour="orders-expanded-detail"]',
      optional: true,
      title: "Detail Inline Order",
      description: "Detail order dibuka langsung di bawah baris. Step ini muncul jika sudah ada order di halaman ini.",
    },
    {
      element: '[data-tour="orders-expanded-meta"]',
      optional: true,
      title: "Informasi Tambahan",
      description: "Bagian ini menampilkan nomor telepon, metode pembayaran, modal, dan waktu order lengkap.",
    },
    {
      element: '[data-tour="orders-items-section"]',
      optional: true,
      title: "Item Digital",
      description: "Jika order sudah selesai, item digital yang dikirim ke pembeli akan tampil di bagian ini.",
    },
  ],
  "/dashboard/products": [
    {
      element: '[data-tour="products-stats"]',
      title: "Ringkasan Produk",
      description: "Kartu ini juga berfungsi sebagai filter cepat untuk semua produk, produk yang ditampilkan, dan produk yang disembunyikan.",
    },
    {
      element: '[data-tour="products-controls"]',
      title: "Kontrol Katalog",
      description: "Gunakan pencarian, filter kategori, pilihan tampilan grid/list, dan mode massal dari panel ini.",
    },
    {
      element: '[data-tour="products-view-toggle"]',
      title: "Grid atau List",
      description: "Ubah tampilan katalog antara grid card dan tabel list sesuai kebutuhan Anda.",
    },
    {
      element: '[data-tour="products-grid"]',
      title: "Katalog Produk",
      description: "Produk dari pusat tampil di sini bersama harga jual, modal, margin, stok, dan status tampil di toko reseller.",
    },
    {
      element: '[data-tour="products-grid-visibility-toggle"]',
      optional: true,
      title: "Toggle Tampil",
      description: "Gunakan toggle ini untuk menampilkan atau menyembunyikan produk tertentu di toko reseller Anda.",
    },
    {
      element: '[data-tour="products-bulk-actions"]',
      beforeClicks: ['[data-tour="products-bulk-toggle-button"]', '[data-tour="products-grid-card-checkbox"]'],
      waitFor: '[data-tour="products-bulk-actions"]',
      optional: true,
      title: "Aksi Massal",
      description: "Pilih beberapa produk, lalu tampilkan atau sembunyikan sekaligus. Step ini muncul jika produk tersedia.",
    },
    {
      element: '[data-tour="products-list"]',
      beforeClick: '[data-tour="products-view-list-button"]',
      waitFor: '[data-tour="products-list"]',
      optional: true,
      title: "Tampilan List",
      description: "Tampilan list cocok untuk membandingkan banyak produk dalam tabel yang lebih ringkas.",
    },
  ],
  "/dashboard/pricing": [
    {
      element: '[data-tour="pricing-info-banner"]',
      title: "Aturan Harga Jual",
      description: "Harga jual reseller dihitung dari harga pusat ditambah margin yang Anda atur.",
    },
    {
      element: '[data-tour="pricing-controls"]',
      title: "Cari & Atur Massal",
      description: "Cari produk tertentu atau buka panel Atur Massal untuk menerapkan margin ke semua produk sekaligus.",
    },
    {
      element: '[data-tour="pricing-bulk-form"]',
      beforeClick: '[data-tour="pricing-bulk-toggle-button"]',
      waitFor: '[data-tour="pricing-bulk-form"]',
      title: "Form Margin Massal",
      description: "Pilih tipe margin nominal atau persentase, isi nilainya, lalu terapkan ke semua produk.",
    },
    {
      element: '[data-tour="pricing-table-card"]',
      title: "Tabel Harga Jual",
      description: "Tabel ini menampilkan harga pusat, tipe margin, nilai margin, harga jual, dan aksi edit per produk.",
    },
    {
      element: '[data-tour="pricing-row-edit-form"]',
      beforeClick: '[data-tour="pricing-row-edit-button"]',
      waitFor: '[data-tour="pricing-row-edit-form"]',
      optional: true,
      title: "Edit Harga Per Produk",
      description: "Klik Edit untuk mengatur margin satu produk secara inline tanpa meninggalkan halaman.",
    },
    {
      element: '[data-tour="pricing-edit-selling-price-preview"]',
      optional: true,
      title: "Preview Harga Jual",
      description: "Saat margin diubah, harga jual baru langsung terlihat sebelum Anda menekan tombol simpan.",
    },
  ],
  "/dashboard/store-settings": [
    {
      element: '[data-tour="store-settings-info-form"]',
      title: "Informasi Toko",
      description: "Atur identitas toko reseller yang tampil ke pelanggan di storefront Anda.",
    },
    {
      element: '[data-tour="store-settings-name-slug"]',
      title: "Nama & Slug Toko",
      description: "Nama toko tampil ke pelanggan, sedangkan slug menjadi bagian URL toko reseller Anda.",
    },
    {
      element: '[data-tour="store-settings-description-address"]',
      title: "Deskripsi & Alamat",
      description: "Isi deskripsi dan alamat agar pembeli mengenali toko Anda dengan lebih jelas.",
    },
    {
      element: '[data-tour="store-settings-contact"]',
      title: "Kontak Toko",
      description: "Lengkapi telepon dan WhatsApp agar pelanggan mudah menghubungi toko Anda.",
    },
    {
      element: '[data-tour="store-settings-branding"]',
      title: "Branding Toko",
      description: "Atur Instagram dan warna tema untuk memperkuat identitas storefront reseller Anda.",
    },
    {
      element: '[data-tour="store-settings-logo"]',
      title: "Logo Toko",
      description: "Masukkan URL logo agar toko reseller terlihat lebih profesional.",
    },
    {
      element: '[data-tour="store-settings-save-button"]',
      title: "Simpan Pengaturan",
      description: "Tekan tombol ini setelah mengubah informasi toko.",
    },
    {
      element: '[data-tour="store-settings-password-form"]',
      title: "Ubah Password",
      description: "Gunakan form ini untuk mengganti password akun reseller Anda.",
    },
    {
      element: '[data-tour="store-settings-link-preview"]',
      title: "Link Toko",
      description: "Bagikan link toko ini ke pelanggan. Tombol Salin memudahkan Anda menyalin URL storefront.",
    },
  ],
  "/dashboard/balance": [
    {
      element: '[data-tour="balance-stats"]',
      title: "Saldo & Komisi",
      description: "Kartu ini menampilkan saldo tersedia, total penjualan, total komisi, dan pending WD.",
    },
    {
      element: '[data-tour="balance-withdraw-panel"]',
      title: "Panel Withdraw",
      description: "Ajukan penarikan saldo komisi dari panel ini.",
    },
    {
      element: '[data-tour="balance-withdraw-form"]',
      beforeClick: '[data-tour="balance-withdraw-toggle-button"]',
      waitFor: '[data-tour="balance-withdraw-form"]',
      title: "Form Withdraw",
      description: "Isi nominal, bank, nomor rekening, dan nama pemilik rekening untuk mengajukan WD.",
    },
    {
      element: '[data-tour="balance-withdraw-amount-bank"]',
      title: "Nominal & Bank",
      description: "Masukkan nominal withdraw dan pilih bank atau e-wallet tujuan.",
    },
    {
      element: '[data-tour="balance-withdraw-account"]',
      title: "Data Rekening",
      description: "Pastikan nomor rekening dan nama pemilik rekening sudah benar sebelum submit.",
    },
    {
      element: '[data-tour="balance-withdraw-submit-button"]',
      title: "Ajukan Withdraw",
      description: "Tekan tombol ini untuk mengirim pengajuan WD ke admin.",
    },
    {
      element: '[data-tour="balance-withdraw-history"]',
      title: "Riwayat Withdraw",
      description: "Semua pengajuan withdraw dan status prosesnya tercatat di bagian ini.",
    },
  ],
};

function waitForElement(selector: string, timeoutMs = 8000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const start = Date.now();
    const interval = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        window.clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        window.clearInterval(interval);
        resolve(null);
      }
    }, 120);
  });
}

export default function OnboardingTour() {
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const runningRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const startTour = useCallback(async () => {
    if (runningRef.current) return;
    const pageSteps = PAGE_TOURS[pathname] || [];
    if (pageSteps.length === 0) return;
    runningRef.current = true;

    const steps: DriveStep[] = pageSteps.map((step) => ({
      element: step.element,
      popover: {
        title: step.title,
        description: step.description,
      },
    }));

    const storageKey = `${TOUR_STORAGE_PREFIX}:${pathname}`;
    const finish = () => {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
      runningRef.current = false;
      driverRef.current?.destroy();
      driverRef.current = null;
    };

    const clickSelectors = async (selectors: string[], step: TourStep) => {
      for (const selector of selectors) {
        const trigger = await waitForElement(selector, step.optional ? 1800 : 8000);
        if (!trigger) {
          if (step.skipIfBeforeMissing !== false) return false;
          continue;
        }
        trigger.click();
        await sleep(step.delayMs ?? 250);
      }
      return true;
    };

    const goToStep = async (index: number, d: Driver) => {
      const step = pageSteps[index];
      if (!step) {
        finish();
        return;
      }

      const selectors = step.beforeClicks || (step.beforeClick ? [step.beforeClick] : []);
      if (selectors.length > 0) {
        const clicked = await clickSelectors(selectors, step);
        if (!clicked) {
          await goToStep(index + 1, d);
          return;
        }
      }

      if (step.waitFor) {
        const waited = await waitForElement(step.waitFor, step.optional ? 3000 : 8000);
        if (!waited) {
          await goToStep(index + 1, d);
          return;
        }
      }

      const target = await waitForElement(step.element, step.optional ? 3000 : 8000);
      if (!target) {
        await goToStep(index + 1, d);
        return;
      }

      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      await sleep(180);

      if (d.isActive()) d.moveTo(index);
      else d.drive(index);
    };

    const d = driver({
      showProgress: true,
      allowClose: true,
      showButtons: ["next", "close"],
      overlayColor: "rgba(15, 23, 42, 0.75)",
      nextBtnText: "Berikutnya",
      doneBtnText: "Selesai",
      progressText: "{{current}} dari {{total}}",
      steps,
      onNextClick: async (_el, _step, opts) => {
        const nextIndex = opts.state.activeIndex != null ? opts.state.activeIndex + 1 : 0;
        const currentDriver = driverRef.current;
        if (!currentDriver) return;
        await goToStep(nextIndex, currentDriver);
      },
      onCloseClick: () => finish(),
      onDestroyed: () => {
        try {
          localStorage.setItem(storageKey, "1");
        } catch {}
        runningRef.current = false;
      },
    });

    driverRef.current = d;
    await goToStep(0, d);
  }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    const pageSteps = PAGE_TOURS[pathname] || [];
    if (pageSteps.length === 0) return;

    let done = false;
    try {
      done = localStorage.getItem(`${TOUR_STORAGE_PREFIX}:${pathname}`) === "1";
    } catch {}
    if (done) return;

    const timer = window.setTimeout(() => {
      startTour();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [ready, pathname, startTour]);

  if (!ready) return null;

  return (
    <button
      type="button"
      data-tour="help-button"
      onClick={startTour}
      title="Panduan Dashboard"
      className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#5c63f2] text-white text-sm font-semibold shadow-lg shadow-[#5c63f2]/30 hover:bg-[#4f55e0] transition"
    >
      <i className="fa-solid fa-circle-question"></i>
      <span className="hidden sm:inline">Panduan</span>
    </button>
  );
}
