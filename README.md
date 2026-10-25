# ReSlide — Revamp Slide Lama

Website untuk menukar slide lama kepada persembahan baharu yang **beranimasi penuh**, **tanpa mengubah isi kandungan**.

1. Masukkan slide lama (`.pptx`, `.pdf`, `.txt` / `.md`, atau tampal teks)
2. Pilih tema, transisi dan auto-main
3. Tekan **Generate** → pratonton, **Persembahkan** (tab baharu) atau **Muat turun HTML**

Semua pemprosesan berlaku dalam pelayar; fail tidak dihantar ke mana-mana pelayan.

## Apa yang dihasilkan

- Teks (termasuk **tebal**/*condong*/garis bawah), tahap poin, gambar dan jadual dikekalkan sama seperti asal.
- Setiap slide diberi layout moden secara automatik: muka depan, pembahagi seksyen, senarai, kad grid,
  statistik (nombor kiraan naik), garis masa, teks + gambar, galeri, jadual dan petikan.
  Layout boleh ditukar per slide dalam panel "Kandungan dikesan".
- Animasi: tajuk muncul perkataan demi perkataan, elemen masuk berperingkat, latar gradien bergerak,
  partikel, Ken Burns pada gambar, bar kemajuan, dan transisi (tolak, zum, pusing 3D, pudar).
- Teks yang panjang dikecilkan secara automatik supaya tiada kandungan terpotong.
- Fail HTML yang dimuat turun berdiri sendiri (gambar dibenamkan). Kekunci: `←` `→` / Space untuk navigasi,
  `F` skrin penuh, sapu pada telefon, `Ctrl+P` untuk simpan sebagai PDF (satu slide setiap halaman).

## Had semasa

- `.ppt` (format lama) tidak disokong — simpan sebagai `.pptx` atau PDF dahulu.
- Carta PowerPoint asli (bukan gambar), SmartArt dan gambar EMF/WMF tidak dibaca.
- Gambar latar penuh daripada templat lama dibuang sengaja kerana ia hiasan, bukan kandungan.
- PDF hanya membaca teks (tajuk dikesan daripada saiz fon terbesar).

## Jalankan secara lokal

Ia laman statik (ES modules), jadi perlu dihidangkan melalui pelayan HTTP:

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

Boleh juga dihoskan terus di GitHub Pages (fail `.nojekyll` sudah disediakan).

## Struktur

| Fail | Fungsi |
| --- | --- |
| `index.html`, `assets/css/app.css` | Antara muka website |
| `assets/js/app.js` | Aliran muat naik → generate → pratonton / muat turun |
| `assets/js/parsers.js` | Membaca PPTX (JSZip), PDF (pdf.js) dan teks kepada model dek neutral |
| `assets/js/layout.js` | Memilih layout setiap slide berdasarkan bentuk kandungan |
| `assets/js/deck.js` | Tema, CSS animasi dan runtime navigasi; menjana fail HTML persembahan |
