import Link from "next/link";
import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";

export const metadata = { title: "Pusat Bantuan - BaliCivic AI" };

const PAGE_CSS = `
body { font-family: 'Inter', sans-serif; }
* { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
a, button, .card, .btn, details { transition: all 0.3s ease; }
.card-hover:hover, [class*="rounded"]:hover { transform: translateY(-2px); box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08); }
button:hover, .btn:hover, a[class*="bg-"]:hover { transform: translateY(-1px); box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.08); }
button:active, .btn:active { transform: translateY(0px); }
a:not([class*="bg-"]):hover { color: #C94B4B; }
i:hover { transform: scale(1.05); transition: transform 0.2s ease; }
details summary { transition: all 0.3s ease; }
details[open] summary { color: #C94B4B; }
`;

export default function BantuanPage() {
  return (
    <div className="pb-24 md:pb-0">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <NavbarApp active="/bantuan" />

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-textDark mb-4">Pusat Bantuan</h1>
          <p className="text-lg text-textSecondary max-w-2xl mx-auto">
            Temukan panduan lengkap untuk menggunakan BaliCivic AI dan laporkan masalah lingkungan dengan mudah
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { href: "#getting-started", iconBg: "bg-primary/10 group-hover:bg-primary", icon: "fas fa-rocket text-2xl text-primary group-hover:text-white", t: "Memulai", d: "Pelajari cara menggunakan aplikasi untuk pertama kali" },
            { href: "#how-to-report", iconBg: "bg-accentGreen/10 group-hover:bg-accentGreen", icon: "fas fa-file-alt text-2xl text-accentGreen group-hover:text-white", t: "Cara Melapor", d: "Panduan lengkap membuat laporan kerusakan" },
            { href: "#faq", iconBg: "bg-accentTeal/10 group-hover:bg-accentTeal", icon: "fas fa-question-circle text-2xl text-accentTeal group-hover:text-white", t: "FAQ", d: "Pertanyaan yang sering diajukan" },
          ].map((c) => (
            <a key={c.href} href={c.href} className="group bg-white rounded-2xl border border-lightBorder p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className={`w-12 h-12 ${c.iconBg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all`}>
                <i className={`${c.icon} transition-colors`}></i>
              </div>
              <h3 className="font-bold text-textDark mb-2">{c.t}</h3>
              <p className="text-sm text-textSecondary">{c.d}</p>
            </a>
          ))}
        </div>

        {/* Getting Started */}
        <section id="getting-started" className="mb-16">
          <h2 className="text-3xl font-bold text-textDark mb-6">Memulai dengan BaliCivic AI</h2>
          <div className="bg-white rounded-2xl border border-lightBorder p-8 mb-6">
            <h3 className="text-xl font-bold text-textDark mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm">1</span>
              Akses Dashboard
            </h3>
            <p className="text-textSecondary mb-4">
              Klik tombol &quot;Dashboard&quot; di menu navigasi atau tombol &quot;Coba Sekarang&quot; untuk mengakses halaman dashboard.
              Di sini Anda dapat melihat statistik laporan, peta heatmap, dan data terkini.
            </p>
            <div className="bg-bgPage rounded-xl p-4 border border-lightBorder">
              <p className="text-sm text-textSecondary">
                <i className="fas fa-lightbulb text-accentGreen mr-2"></i>
                Gunakan mode mobile untuk pengalaman terbaik saat melapor dari lapangan.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-lightBorder p-8 mb-6">
            <h3 className="text-xl font-bold text-textDark mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm">2</span>
              Buat Laporan Baru
            </h3>
            <p className="text-textSecondary mb-4">
              Klik menu &quot;Laporan&quot; atau tombol FAB (+) di pojok kanan bawah untuk membuat laporan kerusakan baru.
              Anda akan diarahkan ke halaman formulir pelaporan.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-lightBorder p-8">
            <h3 className="text-xl font-bold text-textDark mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm">3</span>
              Pahami Hasil Analisis
            </h3>
            <p className="text-textSecondary mb-4">
              Setelah mengirim laporan, sistem AI akan menganalisis foto dan memberikan hasil deteksi otomatis,
              termasuk jenis kerusakan, tingkat keparahan, dan rekomendasi tindakan.
            </p>
          </div>
        </section>

        {/* How to Report */}
        <section id="how-to-report" className="mb-16">
          <h2 className="text-3xl font-bold text-textDark mb-6">Cara Membuat Laporan</h2>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-lightBorder p-8">
              <h3 className="text-xl font-bold text-textDark mb-4 flex items-center gap-3">
                <i className="fas fa-camera text-primary"></i>
                Upload Foto
              </h3>
              <ul className="space-y-3 text-textSecondary">
                {[
                  "Ambil foto yang jelas dan fokus pada area kerusakan",
                  "Pastikan pencahayaan cukup (hindari foto terlalu gelap atau silau)",
                  "Ambil dari jarak yang memperlihatkan konteks sekitar",
                  "Format yang didukung: JPG, PNG (maksimal 5MB)",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <i className="fas fa-check-circle text-accentGreen mt-1"></i>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-lightBorder p-8">
              <h3 className="text-xl font-bold text-textDark mb-4 flex items-center gap-3">
                <i className="fas fa-map-marker-alt text-accentGreen"></i>
                Tentukan Lokasi
              </h3>
              <p className="text-textSecondary mb-4">Anda dapat menentukan lokasi dengan dua cara:</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-accentGreen/5 rounded-xl p-4 border border-accentGreen/20">
                  <h4 className="font-bold text-textDark mb-2 flex items-center gap-2">
                    <i className="fas fa-crosshairs text-accentGreen"></i> Deteksi Otomatis
                  </h4>
                  <p className="text-sm text-textSecondary">Klik tombol &quot;Deteksi Lokasi Saya&quot; untuk menggunakan GPS perangkat Anda</p>
                </div>
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                  <h4 className="font-bold text-textDark mb-2 flex items-center gap-2">
                    <i className="fas fa-edit text-primary"></i> Input Manual
                  </h4>
                  <p className="text-sm text-textSecondary">Masukkan koordinat latitude dan longitude secara manual</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-lightBorder p-8">
              <h3 className="text-xl font-bold text-textDark mb-4 flex items-center gap-3">
                <i className="fas fa-pen text-accentTeal"></i>
                Isi Deskripsi
              </h3>
              <p className="text-textSecondary mb-4">Berikan deskripsi singkat tentang kerusakan yang Anda laporkan:</p>
              <ul className="space-y-2 text-textSecondary">
                {["Jelaskan kondisi kerusakan secara spesifik", "Sebutkan landmark terdekat jika ada", "Tambahkan informasi waktu kejadian jika relevan"].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="text-primary">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-lightBorder p-8">
              <h3 className="text-xl font-bold text-textDark mb-4 flex items-center gap-3">
                <i className="fas fa-robot text-primary"></i>
                Analisis AI
              </h3>
              <p className="text-textSecondary mb-4">Setelah klik &quot;Analisis Sekarang&quot;, sistem akan:</p>
              <div className="space-y-3">
                {[
                  ["fas fa-brain", "Deteksi Objek", "Mengidentifikasi jenis kerusakan menggunakan YOLOv8"],
                  ["fas fa-chart-line", "Penilaian Keparahan", "Menentukan tingkat urgensi (Rendah, Sedang, Tinggi)"],
                  ["fas fa-lightbulb", "Rekomendasi", "Memberikan saran tindakan perbaikan"],
                ].map(([icon, t, d]) => (
                  <div key={t} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`${icon} text-primary text-xs`}></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-textDark">{t}</h4>
                      <p className="text-sm text-textSecondary">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-16">
          <h2 className="text-3xl font-bold text-textDark mb-6">Pertanyaan yang Sering Diajukan</h2>
          <div className="space-y-4">
            {[
              ["Apa itu BaliCivic AI?", "BaliCivic AI adalah sistem pelaporan cerdas berbasis Vision AI yang membantu warga melaporkan kerusakan infrastruktur dan masalah lingkungan. Sistem ini menggunakan teknologi YOLOv8 untuk deteksi otomatis dan LLM untuk analisis konteks."],
              ["Jenis kerusakan apa saja yang bisa dideteksi?", "Sistem dapat mendeteksi berbagai jenis kerusakan termasuk: jalan rusak (lubang, retak), genangan air / drainase buruk, kabel semrawut, sampah menumpuk, trotoar rusak, dan masalah infrastruktur lainnya."],
              ["Apakah laporan saya akan ditindaklanjuti?", "Saat ini BaliCivic AI masih dalam tahap pilot project di Gianyar, Bali. Data laporan dikumpulkan dan dianalisis untuk membantu pemerintah daerah dalam perencanaan perbaikan infrastruktur. Integrasi dengan sistem pemerintah sedang dalam pengembangan."],
              ["Bagaimana cara meningkatkan akurasi deteksi AI?", "Untuk hasil terbaik: ambil foto dengan pencahayaan yang cukup, fokuskan kamera pada area kerusakan, hindari foto yang blur atau terlalu jauh, sertakan konteks sekitar untuk referensi lokasi, gunakan mode landscape untuk area yang luas."],
              ["Apakah data saya aman?", "Ya, kami sangat menjaga privasi Anda. Foto difokuskan pada infrastruktur publik, dan sistem kami dirancang untuk mengaburkan wajah atau informasi pribadi yang terdeteksi. Data lokasi hanya digunakan untuk keperluan pelaporan dan tidak dibagikan ke pihak ketiga."],
              ["Bagaimana jika hasil deteksi AI tidak akurat?", "Model AI kami terus belajar dan berkembang. Jika hasil deteksi kurang akurat, Anda tetap dapat menambahkan deskripsi manual untuk melengkapi informasi. Feedback Anda sangat membantu kami meningkatkan akurasi sistem."],
            ].map(([q, a]) => (
              <details key={q} className="group bg-white rounded-2xl border border-lightBorder overflow-hidden hover:border-primary/30 transition-colors">
                <summary className="flex items-center justify-between w-full p-6 text-left font-semibold text-textDark cursor-pointer hover:bg-gray-50 transition-colors">
                  {q}
                  <i className="fas fa-chevron-down text-textSecondary group-open:rotate-180 transition-transform"></i>
                </summary>
                <div className="p-6 pt-0 text-textSecondary border-t border-lightBorder/50">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Contact Support */}
        <section className="bg-gradient-to-br from-primary/5 to-accentTeal/5 rounded-2xl border border-primary/20 p-8 md:p-12 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-headset text-3xl text-primary"></i>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-textDark mb-4">Masih Butuh Bantuan?</h2>
            <p className="text-textSecondary mb-6">
              Tim kami siap membantu Anda. Hubungi kami untuk pertanyaan lebih lanjut atau dukungan teknis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="mailto:support@balicivic.ai" className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primaryHover transition-all hover:-translate-y-1 shadow-lg">
                <i className="fas fa-envelope"></i> Email Kami
              </a>
              <Link href="/" className="inline-flex items-center justify-center gap-2 bg-white text-textDark px-6 py-3 rounded-xl font-semibold border border-lightBorder hover:bg-gray-50 transition-all hover:-translate-y-1">
                <i className="fas fa-home"></i> Kembali ke Beranda
              </Link>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}