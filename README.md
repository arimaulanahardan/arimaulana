# Zelio — Personal Portfolio (Development Source)

Template portfolio personal berbasis **HTML + Bootstrap**, versi development source **v3.0.0** (AliThemes). Proyek ini memakai **Gulp** untuk compile SCSS, include partial HTML, live reload, dan build ke folder `dist/`.

## Persyaratan

- [Node.js](https://nodejs.org/) (LTS disarankan)
- npm (sudah termasuk Node.js)

## Instalasi

```bash
npm install
```

## Perintah

| Perintah | Keterangan |
| --- | --- |
| `npm run dev` | Build + jalankan BrowserSync dengan watch (live reload) |
| `npm run build` | Build sekali ke folder `dist/` |

Setelah `npm run dev`, buka URL yang ditampilkan BrowserSync (biasanya `http://localhost:3000`).

## Struktur proyek

```text
├── gulpfile.js          # Task Gulp (HTML include, Sass, copy assets)
├── package.json
├── dist/                # Output build (di-ignore Git)
└── src/
    ├── assets/
    │   ├── css/         # CSS (main.css digenerate dari SCSS)
    │   ├── fonts/
    │   ├── imgs/
    │   ├── js/
    │   └── scss/        # Source style (edit di sini)
    │       └── main.scss
    └── views/
        ├── pages/       # Halaman utama (entry HTML)
        ├── partials/    # Header, footer, scripts, dll.
        └── sections/    # Section konten (hero, services, dll.)
```

## Cara kerja development

1. **Halaman** ada di `src/views/pages/` (contoh: `index.html`).
2. Partial digabung lewat sintaks `@@include(...)` (`gulp-file-include`).
3. Style diedit di `src/assets/scss/`; Gulp compile ke `src/assets/css/main.css`.
4. Hasil akhir (HTML + assets) ditulis ke `dist/`.

Contoh include di halaman:

```html
@@include("../partials/head-links.html", {"title": "Ari Maulana"})
@@include("../sections/hero/hero-1.html")
```

### Halaman tersedia

- `index.html` — home
- `work.html` / `work-single.html`
- `services.html`
- `blog-list.html` / `blog-details.html`
- `pricing.html`
- `coming-soon.html`
- `404.html`

## Edit konten

- **Teks / layout section** → `src/views/sections/`
- **Header / footer / menu** → `src/views/partials/`
- **Style & tema** → `src/assets/scss/` (mulai dari `main.scss` / `_customize.scss`)
- **Gambar** → `src/assets/imgs/`
- **Script** → `src/assets/js/`

## Format kode

Proyek memakai Prettier (lihat `.prettierrc`). Format file secara manual sesuai setup editor Anda.

## Deploy

1. Jalankan `npm run build`.
2. Upload isi folder `dist/` ke hosting / server static.

## Lisensi

Template asli: AliThemes. Sesuaikan lisensi sesuai paket yang Anda beli.
