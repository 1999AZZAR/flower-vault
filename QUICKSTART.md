# Flower Vault Quick Start Guide

Get the Flower Vault procedural botanical engine running locally or via Docker.

---

## 1-Minute Local Preview (No Docker Required)

Flower Vault is built with technical minimalism and zero runtime dependencies. You can run it instantly using any static HTTP server:

```bash
# Using Python 3
python3 -m http.server 8087

# Or using Node.js
npx serve -l 8087
```

Open `http://localhost:8087` in your browser.

---

## Docker Deployment

### 1. Using Docker Compose (Recommended)

```bash
docker compose up -d --build
```

Access the vault at `http://localhost:8087`.

### 2. Standalone Docker Build & Run

```bash
# Build the Alpine Nginx image (~15MB)
docker build -t flower-vault .

# Run container mapped to port 8087
docker run -d -p 8087:80 --name flower-vault flower-vault
```

### 3. Verify Health Check

```bash
curl -sI http://localhost:8087
```

Expected HTTP status:
```text
HTTP/1.1 200 OK
Server: nginx/...
```

---

## Quick Node.js Verification

Verify the procedural engine determinism directly from the terminal:

```bash
node -e '
const FlowerDraw = require("./js/flowerdraw.js");
const spec = FlowerDraw.generateSpecimen({ narrative: "Alpine Primrose" });
console.log("Taxon:", spec.taxon);
console.log("Family:", spec.family);
console.log("Accession ID:", spec.id);
console.log("Habit:", spec.habit);
'
```

---

## Public Cloudflare Access

Configured for production deployment via Cloudflare Tunnel:
- Production Vault: [https://flower-vault.glassgallery.my.id](https://flower-vault.glassgallery.my.id)
- Technical Monograph: [https://flower-vault.glassgallery.my.id/docs.html](https://flower-vault.glassgallery.my.id/docs.html)
