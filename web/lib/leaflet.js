// Helper menunggu Leaflet (window.L) siap dipakai.
//
// Leaflet dimuat sebagai script global (strategy="afterInteractive") di layout,
// sehingga bisa belum tersedia saat useEffect pertama jalan. Helper ini
// menunggu sampai window.L ada, lalu resolve. Kalau timeout, reject.

export function waitForLeaflet(timeoutMs = 10000) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet hanya tersedia di browser"));
  }
  if (window.L) return Promise.resolve(window.L);

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.L) {
        clearInterval(timer);
        resolve(window.L);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Leaflet gagal dimuat (timeout)"));
      }
    }, 50);
  });
}
