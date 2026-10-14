# Flower Vault Integration & Code Examples

Implementation examples for integrating Flower Vault into web applications, static sites, backend pipelines, and headless archival synthesis.

---

## 1. Browser JavaScript SDK

Flower Vault includes a zero-dependency client library in `js/flowerdraw.js` that attaches to `window.FlowerDraw`.

### Basic Specimen Synthesis & Vector Rendering
```html
<script src="https://flower-vault.glassgallery.my.id/js/flowerdraw.js"></script>
<script>
  // 1. Synthesize specimen deterministically from a narrative phrase or botanical name
  const result = window.FlowerDraw.synthesize('Highland White Camellia', {
    width: 600,
    height: 750,
    margin: 16,
    bg: '#EFE9DC',
    stroke: '#2A2520'
  });

  console.log('Accession Number:', result.accessionId);
  console.log('Taxon Binomial:', result.metrics.taxon);
  console.log('Family:', result.metrics.family);
  console.log('Habit:', result.metrics.habit);

  // Mount the high-resolution canvas plate directly into DOM
  document.getElementById('specimen-container').appendChild(result.canvas);

  // 2. Generate standalone Archival SVG plate
  const svgMarkup = window.FlowerDraw.generateSvgPlate(result.canvas, result.metrics);
  console.log('SVG markup length:', svgMarkup.length);
</script>
```

### Specimen Recovery from Accession ID
```javascript
// Reconstitute the exact botanical specimen using its accession ID:
const recovered = window.FlowerDraw.synthesize('FLV-C6-068WQ1', {
  width: 800,
  height: 1000
});

console.log(recovered.metrics.taxon); // Guaranteed to match original specimen
```

---

## 2. Node.js (Server-Side / CLI)

`flowerdraw.js` natively supports CommonJS `require()`:

```javascript
// generate_specimen_report.js
const FlowerDraw = require('./js/flowerdraw.js');

// Derive botanical telemetry and accession metadata deterministically
const specimen = FlowerDraw.generateSpecimen({
  narrative: 'Nocturnal Moonflower of Kyoto'
});

console.log('Accession ID:', specimen.accessionId);
console.log('Botanical Taxon:', specimen.taxon);
console.log('Botanical Family:', specimen.family);
console.log('Growth Habit:', specimen.habit);
console.log('Leaf Phyllotaxy:', specimen.metrics.phyllotaxy);
console.log('Petal Count:', specimen.metrics.flowerPetals);
console.log('Chroma Values:', specimen.metrics.pigmentChroma);
```

Run directly:
```bash
node generate_specimen_report.js
```

---

## 3. Iframe Embed Integration

Embed an interactive, distraction-free specimen viewer directly in blog posts, documentation, or CMS articles.

### Distraction-Free Specimen Embed
```html
<!-- Responsive 4:5 Archival Plate Embed -->
<iframe 
  src="https://flower-vault.glassgallery.my.id/?mode=embed&narrative=Alpine+Flora&w=4&h=5"
  width="520" 
  height="650" 
  style="border: 1px solid #DDD5C5; background-color: #EFE9DC;"
  loading="lazy"
  title="Archival Botanical Specimen">
</iframe>
```

### URL Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `default` | Set to `embed` to strip headers and control chrome. |
| `id` | `string` | `none` | Accession ID (e.g. `FLV-C6-068WQ1`) for deterministic reconstitution. |
| `narrative` | `string` | `none` | Narrative text injected into the 32-bit FNV-1a hash algorithm. |
| `seed` | `string` | `none` | Direct seed string override. |
| `w` | `number` | `4` | Width ratio component. |
| `h` | `number` | `5` | Height ratio component. |

---

## 4. Bidirectional PostMessage Event Protocol

Host applications can remotely control embedded Flower Vault frames and consume real-time specimen telemetry.

### Parent Application Controller
```javascript
const vaultFrame = document.querySelector('iframe#flower-vault-frame');

// 1. Send narrative mutation
vaultFrame.contentWindow.postMessage({
  type: 'SET_NARRATIVE',
  data: { narrative: 'Crimson Peony in Spring Rain' }
}, '*');

// 2. Switch aspect ratio to square (1:1)
vaultFrame.contentWindow.postMessage({
  type: 'SET_RATIO',
  data: { w: 1, h: 1 }
}, '*');

// 3. Listen for specimen generation events
window.addEventListener('message', (event) => {
  if (event.data?.type === 'SPECIMEN_SYNTHESIZED') {
    const { id, taxon, family, habit, metrics } = event.data.data;
    console.log(`Specimen mounted: [${id}] ${taxon} (${family})`);
  }
});
```

---

## 5. Python Automation Script

Query and verify specimens programmatically via Python:

```python
import subprocess
import json

def synthesize_botanical_specimen(narrative: str):
    node_code = f"""
    const FlowerDraw = require('./js/flowerdraw.js');
    const spec = FlowerDraw.generateSpecimen({{ narrative: {json.dumps(narrative)} }});
    console.log(JSON.stringify(spec.metrics));
    """
    proc = subprocess.run(
        ["node", "-e", node_code],
        capture_output=True,
        text=True,
        check=True
    )
    return json.loads(proc.stdout)

specimen = synthesize_botanical_specimen("Orchis spectabilis")
print(f"Taxon: {specimen['taxon']}")
print(f"ID: {specimen['accessionId']}")
print(f"Habit: {specimen['habit']}")
```
