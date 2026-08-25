# Zelio — Personal Portfolio & Resume Template (Development Source)

A modern, highly customizable personal portfolio, CV, and resume web application template built with **HTML5**, **Bootstrap 5**, and **SCSS**. This repository contains the **v3.0.0** development source code utilizing **Gulp** for modular HTML inclusion, Sass compilation, live reloading via BrowserSync, and production build generation into the `dist/` directory.

---

## 🌟 Key Features

- **Modular HTML Architecture:** Keeps pages clean by reusing partials (headers, footers, head links) and sections via `gulp-file-include`.
- **SCSS Compilation:** Automated Sass compilation with AutoPrefixer, Source Maps, and modular style setup.
- **Live Reload Dev Server:** Built-in BrowserSync server that automatically refreshes your browser upon file changes.
- **Production Build Task:** Clean build output generated directly into the `dist/` directory with HTML beautification.
- **Dark / Light Theme Support:** Pre-built switcher and components for seamless theme toggling.
- **Responsive Layout:** Powered by Bootstrap for seamless display across desktop, tablet, and mobile devices.

---

## 📋 Requirements

Before getting started, ensure you have the following installed on your machine:

- **[Node.js](https://nodejs.org/)** (v16.x LTS or higher recommended)
- **npm** (bundled with Node.js) or **yarn**

---

## 🚀 Quick Start

1. **Clone or Extract the repository:**
   ```bash
   git clone <repository-url>
   cd 2.Zelio_Development_SourceCode
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   This compiles all source files, launches BrowserSync (usually available at `http://localhost:3000`), and watches for file changes with live reloading.

---

## 🛠️ NPM Scripts

| Script | Command | Description |
| --- | --- | --- |
| `npm run dev` | `gulp dev` | Compiles source files, copies assets, starts BrowserSync, and watches for changes. |
| `npm run build` | `gulp build` | Generates a clean, formatted production build in the `dist/` directory. |

---

## 📁 Directory Structure

```text
2.Zelio_Development_SourceCode/
├── gulpfile.js               # Gulp workflow tasks (HTML include, SCSS compilation, live reload, build)
├── package.json              # Project dependencies and npm scripts
├── .prettierrc               # Code formatting rules
├── dist/                     # Compiled production-ready output (git-ignored)
│   ├── assets/               # Production assets (CSS, JS, Fonts, Images)
│   └── *.html                # Compiled HTML pages
└── src/                      # Source files (Edit code here)
    ├── assets/               # Static assets & source styles
    │   ├── css/              # Output CSS files generated from SCSS
    │   ├── fonts/            # Custom web fonts and icon fonts
    │   ├── images/ & imgs/   # Project images, graphics, and avatars
    │   ├── js/               # JavaScript files and vendor libraries
    │   └── scss/             # SCSS stylesheets (main.scss entry point)
    └── views/                # Modular HTML template files
        ├── pages/            # Main entry pages (index.html, services.html, etc.)
        ├── partials/         # Reusable site elements (headers, footers, head tags, menu)
        └── sections/         # Page content sections (hero, skills, experience, projects, contact, etc.)
```

---

## ⚙️ Development Workflow & Architecture

This project uses a modular template setup powered by `gulp-file-include`.

### 1. HTML Pages & Partials
Main pages reside in `src/views/pages/`. Page components and layout sections are included using `@@include()` syntax:

```html
<!-- Example from src/views/pages/index.html -->
@@include("../partials/head-links.html", {"title": "Ari Maulana - Portfolio"})
@@include("../partials/preloader.html")
@@include("../partials/header-home-1.html")

<main class="main">
    @@include("../sections/hero/hero-1.html")
    @@include("../sections/services/services-1.html")
    @@include("../sections/experience/experience-1.html")
    @@include("../sections/projects/projects-1.html")
    @@include("../sections/contact/contact-1.html")
</main>

@@include("../partials/footer-1.html")
@@include("../partials/scripts.html")
```

### 2. SCSS Styles & Compilation
- Primary SCSS styles are located in `src/assets/scss/`.
- `main.scss` serves as the main import point for all modular SCSS partials.
- During development (`npm run dev`) or build (`npm run build`), Gulp compiles SCSS to `src/assets/css/main.css` and copies assets to `dist/assets/`.

---

## 📄 Available Pages

| Entry Page File (`src/views/pages/`) | Description |
| --- | --- |
| `index.html` | Homepage / Hero section, main showcase & portfolio highlights |
| `services.html` | Services offered & detailed breakdown |
| `work.html` | Portfolio showcase / Project listing page |
| `work-single.html` | Detailed single project case study |
| `blog-list.html` | Blog posts listing |
| `blog-details.html` | Single blog article detail view |
| `pricing.html` | Service packages & pricing comparison table |
| `coming-soon.html` | Maintenance / Launch countdown page |
| `404.html` | Custom page not found error screen |

---

## ✏️ Customization Guide

- **Modifying Text & Page Content:** Edit the relevant section HTML file inside `src/views/sections/` (e.g., `src/views/sections/hero/` or `src/views/sections/contact/`).
- **Updating Navigation & Footer:** Edit header and footer components inside `src/views/partials/` (`header-home-1.html`, `footer-1.html`, `mobile-menu.html`).
- **Customizing Styles & Colors:** Edit `src/assets/scss/` variables and files, then let Gulp auto-compile the CSS.
- **Updating Images:** Replace images in `src/assets/imgs/` or `src/assets/images/` and update source paths in the HTML partials.

---

## 📦 Deployment

1. Generate the static site output:
   ```bash
   npm run build
   ```
2. The `dist/` directory will be created/updated with optimized HTML, CSS, JavaScript, and asset files.
3. Deploy the **contents of the `dist/` folder** to any static web hosting provider (such as GitHub Pages, Vercel, Netlify, Cloudflare Pages, Nginx, Apache, or cPanel).

---

## 🧼 Code Formatting

This project includes Prettier configuration (`.prettierrc`). To maintain consistent code formatting, run your editor's Prettier format command or format files before committing changes.

---

## 📜 License & Credits

- **Original Template:** AliThemes (Zelio Portfolio Template).
- Please ensure compliance with the licensing terms associated with your purchase of the template.

