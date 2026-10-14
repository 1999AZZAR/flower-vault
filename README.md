# Flower Vault: Archival Botany & Specimen Vault

> A procedural botanical synthesis engine and taxonomic archival vault designed for technical minimalism, structural honesty, and traditional Gongbi-style fine-brush watercolor flora.

[![Live Site](https://img.shields.io/badge/Live-flower--vault.glassgallery.my.id-8B1A1A?style=flat-square)](https://flower-vault.glassgallery.my.id)
[![Architecture](https://img.shields.io/badge/Design_System-Swiss--Archival-2A2520?style=flat-square)](#architectural-principles)
[![Engine](https://img.shields.io/badge/Engine-Lingdong_nonflowers-7A7068?style=flat-square)](https://github.com/LingDong-/nonflowers)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

---

## Lineage & Design Heritage

**Flower Vault** is built directly upon the creative engineering traditions of the Archival Vault Suite:

| Project | Author & Source | Contributions to Flower Vault |
|---|---|---|
| **[Geometry Vault](https://geometry-vault.glassgallery.my.id/)** | **Azzar Budiyanto**<br>([Portfolio](https://glassgallery.my.id/porto/)) | - **Swiss-Archival Design System**: Tactile 300gsm rag paper aesthetic, drafting borders, and accession numbering.<br>- **Interface Architecture**: Multi-ratio format matrix, hardware-accelerated cursor, and telemetry side-panel.<br>- **Embed Protocol**: Iframe embed mode (`?mode=embed`), URL state synchronization, and PostMessage API. |
| **[nonflowers](https://github.com/LingDong-/nonflowers)** | **Lingdong Huang**<br>([Demo](https://nonflowers.glitch.me/)) | - **Procedural Botanical Synthesis**: Algorithmic generation of woody and herbal plant architectures, rational Bézier foliage, floral calyces, and stamens.<br>- **Gongbi Chromatography**: Layered watercolor simulation utilizing Perlin pigment percolation and alpha fade filters.<br>- **Euler Rotations**: 3D spatial transformations projecting nodding flowers and curling foliage onto a 2D plate. |

---

## Architectural Principles

1. **Taxonomic Naturalism & Structural Honesty:** Visible field grids, technical metadata, and authentic Linnaean botanical taxonomy as primary aesthetic and functional elements.
2. **Technical Minimalism:** Zero-dependency vanilla engine (~70KB). Runs 100% client-side with zero build steps or heavyweight bundles.
3. **Physicality & Archival Media:** Simulates 300gsm matte cold-press xuan paper, tactile noise textures, and botanical monographs from historical scientific expeditions.
4. **Plate Purity:** Specimen plates display exclusively essential archival data: accession ID (`ID:FLV-XX-XXXXXX`) at bottom-left, memory pointer (`PTR:0x...`) at top-right, and engraved cursive Latin binomen at bottom-center via Hershey vector curves.

---

## Features

### 1. Deterministic Narrative Injection Pipeline
Transform arbitrary narrative sequences (articles, notes, blog post titles, or essays) into reproducible botanical specimens:

$$\text{Narrative String} \longrightarrow \text{Seed (FNV-1a Hash)} \longrightarrow \text{Accession ID (FLV-XX-XXXXXX)} \longrightarrow \text{Botanical Binomen \& Family}$$

- **Blog / CMS Integration Ready:** Authors can pass any narrative string (e.g. `?narrative=Nocturnal%20Jasmine`) to synthesize an authentic botanical plate with an accession ID, memory pointer, and scientific Latin binomial (*e.g. Dendrocalyx pendula*).
- **100% Bidirectional Recovery:** The accession identifier embeds a 6-character Base36 hash suffix. Entering an ID into `RECOVER FROM ID` or loading `?id=FLV-XX-XXXXXX` losslessly regenerates the identical specimen, habit, venation, and pigmentation without requiring a database.
- **Reproducibility Guarantee:** Self-contained seedable PRNG and noise generator ensure that identical seeds yield identical specimens across platforms.

### 2. Dual Plant Habit Architecture
- **Woody Habit (Frutex / Arbor):** Synthesizes bifurcating lignified stems with secondary cambial thickening, charcoal bark striae, staggered phyllotaxis, and nodding floral inflorescences.
- **Herbal Habit (Herba Succulenta):** Synthesizes tender succulent petioles radiating from basal or acaulescent nodes, broad lamina surface areas, and delicate floral scapes.

### 3. Morphometric Telemetry Dashboard
Real-time extraction and inspection of procedural botanical parameters:
- **Taxon Name:** Prominently displays the pseudo-Latin binomial nomenclature scribed onto the plate.
- **Botanical Family:** Classified into one of 12 real botanical families (e.g., *Rosaceae*, *Magnoliaceae*, *Orchidaceae*, *Ranunculaceae*).
- **Habit & Architecture:** Woody lignified stem versus Herbal succulent scape.
- **Phyllotaxis & Venation:** Basal clustered or alternate cauline arrangements; parallel versus pinnate-reticulate foliar venation.
- **Floral Merism:** Petal count, corolla diameter, and stamen density.
- **Pigment Chromatography:** Monitored hue spectra for petals and chlorophyll washes.

### 4. Centered Fullscreen Expand Modal
- Interactive `[ EXPAND ]` control presenting an edge-to-edge centered inspection viewport (`#fullscreen-viewer`).
- Backdrop blur, auto-scaling canvas, keyboard accelerator (`E` / `ESC`), backdrop click dismissal, and dedicated high-res PNG / SVG export buttons with visual feedback.

### 5. Multi-Ratio Format Matrix
Adapt specimen plates across 9 publishing aspect ratios:
`9:16`, `2:3`, `3:4`, `4:5`, `1:1`, `5:4`, `4:3`, `3:2`, `16:9`.

### 6. Archival Export Protocol
- **Archival PNG (300 DPI):** High-resolution 2400px raster render featuring mineral pigment washes, paper grain texture, and plate borders.
- **Standalone SVG:** Vector plate containing high-res raster botanical canvas, vector drafting borders, technical stamps, and authentic Hershey vector cursive curves.
- **Embed Mode (`?mode=embed`):** Strips all surrounding chrome for seamless iframe embedding with parent `postMessage` protocol.

### 7. Progressive Web App (PWA)
- Full service worker caching with network-first strategy for navigation and core scripts.
- Web App Manifest configured for standalone mobile and desktop installation.

---

## Tech Stack

- **Frontend:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (Utility Layer).
- **Core Engine:** Procedural Gongbi botanical algorithm adapted from [Lingdong Huang's nonflowers](https://github.com/LingDong-/nonflowers).
- **Typography:** JetBrains Mono (Technical telemetry) & Plus Jakarta Sans (Editorial).
- **Containerization & Deployment:** Alpine Nginx, Docker, Cloudflare Tunnel (`cloudflared`).

---

## Deployment & Local Execution

### Local Preview (No Docker required)

```bash
# Using Python 3
python3 -m http.server 8087

# Using Node.js
npx serve -l 8087
```

Navigate to `http://localhost:8087`.

### Docker Execution

```bash
docker compose up -d --build
```

Container exposes port `8087` mapped to Nginx port `80`.

---

## Repository Structure

```text
flower-vault/
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── index.html            # Primary application & embed viewport
├── docs.html             # Archival technical documentation monograph
├── sw.js                 # Service worker cache manager
├── manifest.json         # Web App Manifest
├── icon-192.svg          # Archival botanical vector icon (192x192)
├── icon-512.svg          # Archival botanical vector icon (512x512)
├── icon-maskable.svg     # Maskable PWA icon (512x512)
├── js/
│   └── flowerdraw.js     # Modular FlowerDraw procedural synthesis engine
├── API_EXAMPLES.md       # Integration and code examples
├── QUICKSTART.md         # Fast-track deployment guide
├── README.md             # Architectural overview and documentation
├── llms.txt              # LLM discovery metadata
└── LICENSE               # MIT License
```

---

## License & Credits

- **Architecture & Design System:** &copy; 2026 Azzar Budiyanto. Released under the [MIT License](LICENSE).
- **Procedural Botanical Mathematics:** Adapted from [Lingdong Huang's nonflowers](https://github.com/LingDong-/nonflowers) (MIT License).
