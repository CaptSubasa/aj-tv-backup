# Roadmap AJ TV / NusaPlay IPTV

- [ ] Audit dan perbaiki deteksi format/player, mixed content, dan kategori error tanpa mengubah URL pengguna
- [ ] Uji player tanpa stream pihak ketiga; lint dan pemeriksaan preview terbaru

- [x] State terpusat: context provider, state persisten namespaced `aj-tv.*`, migrasi sumber lama (`aj-tv.sources.v1`), favorites, history, settings
- [x] Fix bug pemilihan channel setelah filter (lacak channel by id, bukan index filtered)
- [x] Cegah penghapusan sumber aktif tanpa memilih sumber pengganti
- [x] Player controls lengkap: volume/mute, fullscreen, retry, fit/fill, PiP, audio/subtitle, kualitas HLS nyata
- [x] Navigasi + routes: Home, Live TV, Sports, Favorites, History, TV Guide/EPG, Playlist Manager, Settings
- [x] Impor/ekspor JSON
- [x] Simpan file playlist lokal dengan IndexedDB
- [x] PWA manifest + icons (manifest-only, tanpa service worker)
- [x] Tests untuk logika baru (migrasi, history, favorites, impor/ekspor)
- [x] Jalankan lint, TypeScript, vitest, production build
- [x] Verifikasi di preview (Playwright)
- [ ] Deploy/publish — menunggu persetujuan pengguna
