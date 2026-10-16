# ☀ GlitchNest — Sunny Clouds & Hand-Sketched Indie Gaming Portal

GlitchNest is a cheerful, hand-crafted browser gaming portal where the developer/owner can host, showcase, and monetize custom HTML5/WebGL games via Google AdSense, presenting titles through a YouTube-style 16:9 sketchbook media grid.

---

## 🎨 Visual Identity & UI/UX Standards

- **Aesthetic**: Hand-drawn sketchbook / notebook doodle with warm sunshine and drifting clouds
- **Primary Canvas Background**: Clean, warm white / soft sky blue (`#faf9f6`, `#ffffff`, `#f0f7ff`)
- **Surface / Card Containers**: White paper surfaces (`#ffffff`) with faint notebook grid and organic ink borders
- **Accents**: Warm Sunshine Yellow (`#ffd166`), Golden Amber (`#ffb703`), Sunshine Orange (`#ff8500`), Sky Blue (`#70d6ff`), and Pastel Pink (`#ff85a2`)
- **Typography**: Hand-drawn indie fonts (*Shantell Sans*, *Patrick Hand*) paired with clean monospace for code/telemetry
- **Zero Framework Bloat**: 100% pure vanilla HTML5, CSS3 Grid/Flexbox, and vanilla JavaScript (no Bootstrap, no Tailwind, no external UI libraries)

---

## 📂 Architecture & Directory Structure

```
Gaming_Website/
├── public/
│   ├── index.html            # Page 1: Homepage & Catalog with floating clouds, real-time search, category filters, AdSense #1, 16:9 grid
│   ├── play.html             # Page 2: Game Runner with 16:9 stage frame, action bar, AdSense #2 & #3, controls guide
│   ├── admin.html            # Page 3: Creator Desk & Admin Dashboard with doodle lock gate, deployment form, catalog table
│   ├── css/
│   │   └── style.css         # Complete hand-sketched design system with CSS custom properties
│   ├── js/
│   │   ├── main.js           # Client-side search, category filter pills, dynamic cards, share toast
│   │   ├── player.js         # Fullscreen API, iframe runner, restart, like/favorite, control keys, recommendations
│   │   └── admin.js          # Passcode auth gateway, deployment form validation, delete/toggle visibility
│   ├── assets/
│   │   ├── logo.svg          # Cute hand-sketched sunshine & cloud vector logo
│   │   └── thumbnails/       # Hand-drawn 16:9 vector thumbnails (cyber-drift, neon-survivor, demo-game, etc.)
│   └── games/
│       ├── demo-game/        # Pre-registered HTML5 Canvas demo: Neon Bounce Arcade (Sunny Cloud Edition)
│       │   └── index.html
│       ├── cyber-drift/      # Playable coastal highway speed runner game
│       │   └── index.html
│       └── neon-survivor/    # Playable top-down space skiff shooter
│           └── index.html
├── data/
│   └── games.json            # Flat JSON database storing all game registry records
├── server.js                 # Minimal Express backend with REST API and static server
├── package.json
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Install & Run
```bash
# Start server (runs on port 3000 by default)
node server.js
```
Open your browser to: **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Admin Access & Authentication

- **Admin Portal URL**: `http://localhost:3000/admin.html`
- **Default Owner Passcode**: `glitchnest-2026`
- **Custom Passcode**: Set the environment variable `ADMIN_PASSCODE` prior to launching:
  ```bash
  $env:ADMIN_PASSCODE="your-secure-passcode"
  node server.js
  ```

---

## 💰 Google AdSense Monetization Setup

All three strategic ad slots are pre-configured with standard `<ins class="adsbygoogle" ...>` tags and local development preview fallbacks:

| Ad Unit | Placement | Dimensions | Purpose |
| :--- | :--- | :--- | :--- |
| **Slot #1** | Homepage (`index.html`) under hero/nav | `728x90` Desktop / `320x50` Mobile | High-visibility leaderboard banner |
| **Slot #2** | Game Runner (`play.html`) below canvas | `728x90` / Fluid | In-content banner right under game action |
| **Slot #3** | Game Runner (`play.html`) sticky sidebar | `300x250` / `300x600` | Companion display unit next to game controls |

---

## 🎮 Bundled Playable Games

GlitchNest includes 3 self-contained, high-performance HTML5 Canvas games:
1. **Neon Bounce Arcade: Sunny Cloud Edition** (`/games/demo-game/index.html`): Cheerful cloud block-breaking game with multi-ball powerups, Web Audio synthesizers, and combo multipliers.
2. **Cyber Drift: Sunny Coast Cruiser** (`/games/cyber-drift/index.html`): Highway cruiser with sunshine boost, traffic avoidance, and energy tokens.
3. **Neon Survivor: Starry Sky Skiff** (`/games/neon-survivor/index.html`): 360-degree vector arena combat with twin-stick controls and goofy alien blobs.

---

## 🖼️ Thumbnail Studio & Strict 16:9 Aspect Ratio Enforcement

In the Creator Desk (`admin.html`), game publishers can upload pictures directly from their local PC folder:
- **Local PC Upload**: Drag-and-drop or browse local images (PNG, JPG, WebP, SVG).
- **Strict 16:9 Ratio Verification**: Instant aspect ratio analysis (e.g. `1280×720`, `1920×1080`).
- **Auto-Cropper Tools**: If an uploaded picture is not 16:9, the studio provides one-click `✂ Auto-Crop to 16:9 (Center)` and `🖼 Fit to 16:9 (Letterbox)` tools powered by HTML5 Canvas.
- **Instant Cloud Save**: Processed thumbnails are automatically uploaded to `/assets/thumbnails/` and linked to the game deployment record.

---

## 🔌 REST API Endpoints

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/games` | Public | Returns all visible game entries (`?all=true` includes hidden) |
| `GET` | `/api/games/:id` | Public | Returns single game details by slug or ID |
| `POST` | `/api/admin/test-github` | Protected (`x-admin-token`) | Tests GitHub token write access to repository |
| `GET`  | `/api/admin/status` | Public | Returns platform status (Vercel vs Local) and sync config |

---

## ☁️ Vercel Deployment & GitHub Cloud Sync (Live Persistence)

Vercel functions run in a serverless environment where the file system is strictly read-only (`EROFS`). To make game management, deletions, and thumbnail uploads persist permanently without requiring an external database:

1. **Auto GitHub Commits**: The backend uses GitHub's Contents REST API to commit game removals, edits, and thumbnail image files directly into the repository (`Adittya202/Gaming_Website`) on branch `main`.
2. **Auto Vercel Redeployment**: Each commit pushed to GitHub automatically triggers a fresh deployment on Vercel within ~30 seconds.
3. **Instant Live Cache**: All game catalog operations update in-memory storage immediately so players and administrators see updates with 0 latency.
4. **Setup**:
   - In `admin.html`, go to the **GITHUB CLOUD SYNC & VERCEL PERSISTENCE** section.
   - Paste a GitHub Personal Access Token (PAT) with `repo` permissions and click **Save Token**.
   - Or configure `GITHUB_TOKEN` in your Vercel Project Environment Variables.

