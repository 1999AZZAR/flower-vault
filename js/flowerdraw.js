/**
 * Flower Vault // Archival Botanical Synthesis Engine (FlowerDraw)
 * Procedural botany and Gongbi-style floral specimen generator.
 *
 * Based on Lingdong Huang's nonflowers (2018) and Azzar Budiyanto's Archival Vault Suite.
 * Core design: Swiss-Archival technical minimalism, deterministic narrative seeds,
 * losslessly recoverable accession IDs, and botanical morphometrics.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FlowerDraw = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // Math constants & shortcuts
  const PI = Math.PI;
  const sin = Math.sin;
  const cos = Math.cos;
  const abs = Math.abs;
  const pow = Math.pow;
  const deg2rad = PI / 180;
  const rad2deg = 180 / PI;

  function rad(x) { return x * deg2rad; }
  function deg(x) { return x * rad2deg; }
  function distance(p0, p1) {
    return Math.sqrt(pow(p0[0] - p1[0], 2) + pow(p0[1] - p1[1], 2));
  }
  function mapval(value, istart, istop, ostart, ostop) {
    return ostart + (ostop - ostart) * ((value - istart) * 1.0 / (istop - istart));
  }
  function sigmoid(x, k = 10) {
    return 1 / (1 + Math.exp(-k * (x - 0.5)));
  }
  function bean(x) {
    return pow(0.25 - pow(x - 0.5, 2), 0.5) * (2.6 + 2.4 * pow(x, 1.5)) * 0.54;
  }
  function squircle(r, a) {
    return function(th) {
      let t = th;
      while (t > PI / 2) t -= PI / 2;
      while (t < 0) t += PI / 2;
      return r * pow(1 / (pow(cos(t), a) + pow(sin(t), a)), 1 / a);
    };
  }

  // Safe vector helpers (does not pollute global Array.prototype)
  const v3 = {
    forward: [0, 0, 1],
    up: [0, 1, 0],
    right: [1, 0, 0],
    zero: [0, 0, 0],

    rotvec: function(vec, axis, th) {
      const [l, m, n] = axis;
      const [x, y, z] = vec;
      const costh = Math.cos(th);
      const sinth = Math.sin(th);
      const oneMinusCos = 1 - costh;

      const m11 = l * l * oneMinusCos + costh;
      const m12 = m * l * oneMinusCos - n * sinth;
      const m13 = n * l * oneMinusCos + m * sinth;

      const m21 = l * m * oneMinusCos + n * sinth;
      const m22 = m * m * oneMinusCos + costh;
      const m23 = n * m * oneMinusCos - l * sinth;

      const m31 = l * n * oneMinusCos - m * sinth;
      const m32 = m * n * oneMinusCos + l * sinth;
      const m33 = n * n * oneMinusCos + costh;

      return [
        x * m11 + y * m12 + z * m13,
        x * m21 + y * m22 + z * m23,
        x * m31 + y * m32 + z * m33
      ];
    },

    roteuler: function(vec, rot) {
      let v = vec;
      const rx = rot[0] || 0;
      const ry = rot[1] || 0;
      const rz = rot[2] || 0;
      if (rz !== 0) v = v3.rotvec(v, v3.forward, rz);
      if (rx !== 0) v = v3.rotvec(v, v3.right, rx);
      if (ry !== 0) v = v3.rotvec(v, v3.up, ry);
      return v;
    },

    scale: function(v, p) {
      return [v[0] * p, v[1] * p, v[2] * p];
    },
    copy: function(v0) {
      return [v0[0], v0[1], v0[2]];
    },
    add: function(v0, v) {
      return [v0[0] + v[0], v0[1] + v[1], v0[2] + v[2]];
    },
    subtract: function(v0, v) {
      return [v0[0] - v[0], v0[1] - v[1], v0[2] - v[2]];
    },
    mag: function(v) {
      return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    },
    normalize: function(v) {
      const p = 1 / (v3.mag(v) || 1);
      return [v[0] * p, v[1] * p, v[2] * p];
    },
    dot: function(u, v) {
      return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    },
    cross: function(u, v) {
      return [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
      ];
    },
    angcos: function(u, v) {
      const denom = (v3.mag(u) * v3.mag(v)) || 1;
      return Math.max(-1, Math.min(1, v3.dot(u, v) / denom));
    },
    ang: function(u, v) {
      return Math.acos(v3.angcos(u, v));
    },
    toeuler: function(v0) {
      const ep = 5;
      let ma = 2 * PI;
      let mr = [0, 0, 0];
      for (let x = -180; x < 180; x += ep) {
        for (let y = -90; y < 90; y += ep) {
          const r = [rad(x), rad(y), 0];
          const v = v3.roteuler([0, 0, 1], r);
          const a = v3.ang(v0, v);
          if (a < rad(ep)) return r;
          if (a < ma) { ma = a; mr = r; }
        }
      }
      return mr;
    },
    lerp: function(u, v, p) {
      return [
        u[0] * (1 - p) + v[0] * p,
        u[1] * (1 - p) + v[1] * p,
        u[2] * (1 - p) + v[2] * p
      ];
    }
  };

  // Safe point accessors for point tuples [x, y, z]
  function px(p) { return p[0]; }
  function py(p) { return p[1]; }
  function pz(p) { return p[2]; }
  function plast(arr, offset = 1) { return arr[arr.length - offset]; }

  function midPt(...args) {
    const plist = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
    const len = plist.length || 1;
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < plist.length; i++) {
      sx += plist[i][0];
      sy += plist[i][1];
      sz += plist[i][2] || 0;
    }
    return [sx / len, sy / len, sz / len];
  }

  function bezmh(P, w = 1) {
    let pts = P;
    if (pts.length === 2) {
      pts = [pts[0], midPt(pts[0], pts[1]), pts[1]];
    }
    const plist = [];
    for (let j = 0; j < pts.length - 2; j++) {
      const p0 = (j === 0) ? pts[j] : midPt(pts[j], pts[j + 1]);
      const p1 = pts[j + 1];
      const p2 = (j === pts.length - 3) ? pts[j + 2] : midPt(pts[j + 1], pts[j + 2]);
      const pl = 20;
      const isLast = (j === pts.length - 3);
      for (let i = 0; i < pl + (isLast ? 1 : 0); i++) {
        const t = i / pl;
        const u = Math.pow(1 - t, 2) + 2 * t * (1 - t) * w + t * t;
        plist.push([
          (Math.pow(1 - t, 2) * p0[0] + 2 * t * (1 - t) * p1[0] * w + t * t * p2[0]) / u,
          (Math.pow(1 - t, 2) * p0[1] + 2 * t * (1 - t) * p1[1] * w + t * t * p2[1]) / u,
          (Math.pow(1 - t, 2) * p0[2] + 2 * t * (1 - t) * p1[2] * w + t * t * p2[2]) / u
        ]);
      }
    }
    return plist;
  }

  // PRNG Deterministic Generator
  class SeedablePRNG {
    constructor(seedVal = 12345678) {
      this.p = 999979;
      this.q = 999983;
      this.m = this.p * this.q;
      this.s = 1234;
      this.seed(seedVal);
    }

    hash(str) {
      let h = 2166136261 >>> 0;
      const s = String(str);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h;
    }

    seed(x) {
      let num = typeof x === 'number' ? x : this.hash(x);
      let y = 0, z = 0;
      const redo = () => {
        y = (num + z) % this.m;
        z += 1;
      };
      redo();
      while (y % this.p === 0 || y % this.q === 0 || y === 0 || y === 1) {
        redo();
      }
      this.s = y;
      for (let i = 0; i < 10; i++) this.next();
    }

    next() {
      this.s = (this.s * this.s) % this.m;
      return this.s / this.m;
    }

    randChoice(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }

    normRand(min, max) {
      return mapval(this.next(), 0, 1, min, max);
    }

    randint(min, max) {
      return Math.floor(this.normRand(min, max));
    }
  }

  // Perlin Noise Generator
  class PerlinNoise {
    constructor(prng) {
      this.prng = prng || Math;
      this.PERLIN_YWRAPB = 4;
      this.PERLIN_YWRAP = 1 << this.PERLIN_YWRAPB;
      this.PERLIN_ZWRAPB = 8;
      this.PERLIN_ZWRAP = 1 << this.PERLIN_ZWRAPB;
      this.PERLIN_SIZE = 4095;
      this.perlin_octaves = 4;
      this.perlin_amp_falloff = 0.5;
      this.perlin = null;
      this.init();
    }

    init() {
      this.perlin = new Array(this.PERLIN_SIZE + 1);
      for (let i = 0; i < this.PERLIN_SIZE + 1; i++) {
        this.perlin[i] = this.prng.next ? this.prng.next() : Math.random();
      }
    }

    scaled_cosine(i) {
      return 0.5 * (1.0 - Math.cos(i * Math.PI));
    }

    noise(x, y = 0, z = 0) {
      if (x < 0) x = -x;
      if (y < 0) y = -y;
      if (z < 0) z = -z;

      let xi = Math.floor(x);
      let yi = Math.floor(y);
      let zi = Math.floor(z);
      let xf = x - xi;
      let yf = y - yi;
      let zf = z - zi;

      let r = 0;
      let ampl = 0.5;

      for (let o = 0; o < this.perlin_octaves; o++) {
        let of = xi + (yi << this.PERLIN_YWRAPB) + (zi << this.PERLIN_ZWRAPB);
        let rxf = this.scaled_cosine(xf);
        let ryf = this.scaled_cosine(yf);

        let n1 = this.perlin[of & this.PERLIN_SIZE];
        n1 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n1);
        let n2 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
        n2 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n2);
        n1 += ryf * (n2 - n1);

        of += this.PERLIN_ZWRAP;
        n2 = this.perlin[of & this.PERLIN_SIZE];
        n2 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n2);
        let n3 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
        n3 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n3);
        n2 += ryf * (n3 - n2);

        n1 += this.scaled_cosine(zf) * (n2 - n1);
        r += n1 * ampl;
        ampl *= this.perlin_amp_falloff;

        xi <<= 1; xf *= 2;
        yi <<= 1; yf *= 2;
        zi <<= 1; zf *= 2;

        if (xf >= 1.0) { xi++; xf--; }
        if (yf >= 1.0) { yi++; yf--; }
        if (zf >= 1.0) { zi++; zf--; }
      }
      return r;
    }
  }

  // Color utilities
  function rgba(r, g, b, a = 1.0) {
    const red = Math.max(0, Math.min(255, Math.floor(r)));
    const green = Math.max(0, Math.min(255, Math.floor(g)));
    const blue = Math.max(0, Math.min(255, Math.floor(b)));
    const alpha = Math.max(0, Math.min(1, a)).toFixed(3);
    return `rgba(${red},${green},${blue},${alpha})`;
  }

  function hsv(h, s, v, a = 1.0) {
    const c = v * s;
    const hNorm = ((h % 360) + 360) % 360;
    const x = c * (1 - abs(((hNorm / 60) % 2) - 1));
    const m = v - c;
    const table = [
      [c, x, 0], [x, c, 0], [0, c, x],
      [0, x, c], [x, 0, c], [c, 0, x]
    ];
    const [rv, gv, bv] = table[Math.floor(hNorm / 60)] || [0, 0, 0];
    return rgba((rv + m) * 255, (gv + m) * 255, (bv + m) * 255, a);
  }

  function lerpHue(h0, h1, p) {
    const methods = [
      [abs(h1 - h0), mapval(p, 0, 1, h0, h1)],
      [abs(h1 + 360 - h0), mapval(p, 0, 1, h0, h1 + 360)],
      [abs(h1 - 360 - h0), mapval(p, 0, 1, h0, h1 - 360)]
    ];
    methods.sort((a, b) => a[0] - b[0]);
    return ((methods[0][1] + 720) % 360);
  }

  // Polygon and Tubify helpers
  function tubify(pts, widFunc) {
    const vtxlist0 = [];
    const vtxlist1 = [];
    const len = pts.length;
    if (len < 2) return [vtxlist0, vtxlist1];

    for (let i = 1; i < len - 1; i++) {
      const w = widFunc(i / len);
      const a1 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
      const a2 = Math.atan2(pts[i][1] - pts[i + 1][1], pts[i][0] - pts[i + 1][0]);
      let a = (a1 + a2) / 2;
      if (a < a2) a += PI;
      vtxlist0.push([pts[i][0] + w * cos(a), pts[i][1] + w * sin(a)]);
      vtxlist1.push([pts[i][0] - w * cos(a), pts[i][1] - w * sin(a)]);
    }

    const l = len - 1;
    const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) - PI / 2;
    const a1 = Math.atan2(pts[l][1] - pts[l - 1][1], pts[l][0] - pts[l - 1][0]) - PI / 2;
    const w0 = widFunc(0);
    const w1 = widFunc(1);

    vtxlist0.unshift([pts[0][0] + w0 * cos(a0), pts[0][1] + w0 * sin(a0)]);
    vtxlist1.unshift([pts[0][0] - w0 * cos(a0), pts[0][1] - w0 * sin(a0)]);
    vtxlist0.push([pts[l][0] + w1 * cos(a1), pts[l][1] + w1 * sin(a1)]);
    vtxlist1.push([pts[l][0] - w1 * cos(a1), pts[l][1] - w1 * sin(a1)]);

    return [vtxlist0, vtxlist1];
  }

  function polygon(ctx, pts, col = 'black', fil = true, str = false, xof = 0, yof = 0) {
    if (!pts || pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + xof, pts[0][1] + yof);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] + xof, pts[i][1] + yof);
    }
    if (fil) {
      ctx.fillStyle = col;
      ctx.fill();
    }
    if (str) {
      ctx.strokeStyle = col;
      ctx.stroke();
    }
  }

  function strokePath(ctx, pts, col, widFunc, noise, xof = 0, yof = 0) {
    const wf = widFunc || ((x) => 1 * sin(x * PI) * mapval(noise.noise(x * 10), 0, 1, 0.5, 1));
    const [vtx0, vtx1] = tubify(pts, wf);
    const poly = vtx0.concat(vtx1.slice().reverse());
    polygon(ctx, poly, col, true, false, xof, yof);
  }

  function grot(P, ind) {
    const p1 = P[ind];
    const p0 = P[ind - 1] || [0, 0, 0];
    const d = v3.subtract(p1, p0);
    return v3.toeuler(d);
  }

  // Layer bound calculations
  function getLayerBounds(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    let xmin = w, xmax = 0, ymin = h, ymax = 0;
    try {
      const imgd = ctx.getImageData(0, 0, w, h);
      const pix = imgd.data;
      for (let i = 0, n = pix.length; i < n; i += 4) {
        if (pix[i + 3] > 1) {
          const idx = i >> 2;
          const x = idx % w;
          const y = Math.floor(idx / w);
          if (x < xmin) xmin = x;
          if (x > xmax) xmax = x;
          if (y < ymin) ymin = y;
          if (y > ymax) ymax = y;
        }
      }
    } catch (e) {
      return { xmin: 0, xmax: w, ymin: 0, ymax: h };
    }
    return {
      xmin: Math.max(0, xmin),
      xmax: Math.min(w, xmax),
      ymin: Math.max(0, ymin),
      ymax: Math.min(h, ymax)
    };
  }

  // Gongbi Pigment Filter & Bleed Simulation
  function applyWispyFilter(ctx, noise) {
    try {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const imgd = ctx.getImageData(0, 0, w, h);
      const pix = imgd.data;
      for (let i = 0, n = pix.length; i < n; i += 4) {
        if (pix[i + 3] === 0) continue;
        const idx = i >> 2;
        const x = idx % w;
        const y = Math.floor(idx / w);
        const n1 = noise.noise(x * 0.2, y * 0.2);
        const m1 = noise.noise(x * 0.5, y * 0.5, 2);
        pix[i + 1] = Math.min(255, pix[i + 1] * mapval(m1, 0, 1, 0.95, 1));
        pix[i + 2] = Math.min(255, pix[i + 2] * mapval(m1, 0, 1, 0.90, 1));
        pix[i + 3] = Math.min(255, pix[i + 3] * mapval(n1, 0, 1, 0.5, 1));
      }
      ctx.putImageData(imgd, 0, 0);
    } catch (err) {
      // Ignored if canvas security policy blocks direct pixel access
    }
  }

  function applyFadeFilter(ctx, noise) {
    try {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const imgd = ctx.getImageData(0, 0, w, h);
      const pix = imgd.data;
      for (let i = 0, n = pix.length; i < n; i += 4) {
        if (pix[i + 3] === 0) continue;
        const idx = i >> 2;
        const x = idx % w;
        const y = Math.floor(idx / w);
        const n1 = noise.noise(x * 0.01, y * 0.01);
        pix[i + 3] = Math.min(255, Math.max(0, pix[i + 3] * mapval(n1, 0, 1, 0.1, 1)));
      }
      ctx.putImageData(imgd, 0, 0);
    } catch (err) {
      // Ignored
    }
  }

  // Botanical Taxonomy Dictionary (Rich Latin Binomens & Families)
  const BOTANICAL_GENERA = [
    { genus: 'Floragemma', meaning: 'Flower bud', family: 'Ranunculaceae' },
    { genus: 'Dendrocalyx', meaning: 'Woody cup', family: 'Magnoliaceae' },
    { genus: 'Phyllonema', meaning: 'Leaf thread', family: 'Orchidaceae' },
    { genus: 'Silvicarpa', meaning: 'Forest fruit', family: 'Rosaceae' },
    { genus: 'Anthocladus', meaning: 'Blossom branch', family: 'Asteraceae' },
    { genus: 'Petalostemma', meaning: 'Petal crown', family: 'Ericaceae' },
    { genus: 'Chrysantha', meaning: 'Golden blossom', family: 'Asteraceae' },
    { genus: 'Orchidopsis', meaning: 'Orchid-like', family: 'Orchidaceae' },
    { genus: 'Liriodendron', meaning: 'Lily tree', family: 'Magnoliaceae' },
    { genus: 'Calopteryx', meaning: 'Fair wing', family: 'Fabaceae' },
    { genus: 'Bambusina', meaning: 'Slender reed', family: 'Poaceae' },
    { genus: 'Rhodocladus', meaning: 'Rose cane', family: 'Rosaceae' },
    { genus: 'Melanthium', meaning: 'Dark blossom', family: 'Melanthiaceae' },
    { genus: 'Pterocarpa', meaning: 'Winged seed', family: 'Fabaceae' },
    { genus: 'Actinostemma', meaning: 'Radiant star', family: 'Cucurbitaceae' },
    { genus: 'Leucothoe', meaning: 'Shining white', family: 'Ericaceae' },
    { genus: 'Campanulopsis', meaning: 'Bell flower', family: 'Campanulaceae' },
    { genus: 'Gentianella', meaning: 'Little alpine', family: 'Gentianaceae' },
    { genus: 'Papaverula', meaning: 'Slender poppy', family: 'Papaveraceae' },
    { genus: 'Malvastrum', meaning: 'Silken mallow', family: 'Malvaceae' }
  ];

  const BOTANICAL_SPECIES = [
    { epithet: 'silvatica', meaning: 'of the woodland' },
    { epithet: 'aurata', meaning: 'golden' },
    { epithet: 'campestris', meaning: 'of the open fields' },
    { epithet: 'montana', meaning: 'mountain-dwelling' },
    { epithet: 'procumbens', meaning: 'trailing / prostrate' },
    { epithet: 'viridiflora', meaning: 'green-flowered' },
    { epithet: 'speciosa', meaning: 'splendid / remarkable' },
    { epithet: 'palustris', meaning: 'marsh-dwelling' },
    { epithet: 'fragilis', meaning: 'delicate / slender' },
    { epithet: 'tenuifolia', meaning: 'slender-leaved' },
    { epithet: 'lanceolata', meaning: 'lance-shaped' },
    { epithet: 'nodosa', meaning: 'jointed / knotty' },
    { epithet: 'caerulea', meaning: 'sky-blue' },
    { epithet: 'autumnalis', meaning: 'autumn-flowering' },
    { epithet: 'saxatilis', meaning: 'rock-dwelling' },
    { epithet: 'umbraculifera', meaning: 'umbrella-bearing' },
    { epithet: 'vernalis', meaning: 'spring-blooming' },
    { epithet: 'pendula', meaning: 'drooping / pendulous' },
    { epithet: 'purpurascens', meaning: 'purplish' },
    { epithet: 'stellata', meaning: 'star-like' }
  ];

  // Accession ID & Seed Codec (Matching Geometry & Fish Vault Architecture)
  function hashStringTo32Bit(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || 'Archival Botanical Specimen');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hashToAccessionId(hash) {
    const h = hash >>> 0;
    const highByte = ((h >>> 24) & 0xFF).toString(16).padStart(2, '0').toUpperCase();
    const lowPart = (h & 0x00FFFFFF).toString(36).padStart(6, '0').toUpperCase();
    return `FLV-${highByte}-${lowPart}`;
  }

  function accessionIdToHash(id) {
    const clean = String(id || '').trim().toUpperCase();
    const match = clean.match(/^FLV-([0-9A-F]{2})-([0-9A-Z]{6})$/i);
    if (!match) return null;
    const high = parseInt(match[1], 16);
    const low = parseInt(match[2], 36);
    return ((high << 24) | low) >>> 0;
  }

  // Derive Deterministic Botanical Taxon
  function deriveTaxonFromHash(hash) {
    const gIdx = hash % BOTANICAL_GENERA.length;
    const sIdx = (hash >>> 8) % BOTANICAL_SPECIES.length;
    const g = BOTANICAL_GENERA[gIdx];
    const s = BOTANICAL_SPECIES[sIdx];
    return {
      genus: g.genus,
      species: s.epithet,
      taxonName: `${g.genus} ${s.epithet}`,
      family: g.family,
      meaning: `${g.meaning}, ${s.meaning}`
    };
  }

  // ============================================================================
  // Authentic Hershey Vector Font Engine (Vector Glyphs & Pen-Up)
  // ============================================================================

  const HERSHEY_RAW = {
    "501":"  9I[RFJ[ RRFZ[ RMTWT",
    "502":" 24G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[",
    "503":" 19H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV",
    "504":" 16G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[",
    "505":" 12H[LFL[ RLFYF RLPTP RL[Y[",
    "506":"  9HZLFL[ RLFYF RLPTP",
    "507":" 23H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS",
    "508":"  9G]KFK[ RYFY[ RKPYP",
    "509":"  3NVRFR[",
    "510":" 11JZVFVVUYTZR[P[NZMYLVLT",
    "511":"  9G\\KFK[ RYFKT RPOY[",
    "512":"  6HYLFL[ RL[X[",
    "513":" 12F^JFJ[ RJFR[ RZFR[ RZFZ[",
    "514":"  9G]KFK[ RKFY[ RYFY[",
    "515":" 22G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF",
    "516":" 14G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ",
    "517":" 25G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]",
    "518":" 17G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[",
    "519":" 21H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
    "520":"  6JZRFR[ RKFYF",
    "521":" 11G]KFKULXNZQ[S[VZXXYUYF",
    "522":"  6I[JFR[ RZFR[",
    "523":" 12F^HFM[ RRFM[ RRFW[ R\\FW[",
    "524":"  6H\\KFY[ RYFK[",
    "525":"  7I[JFRPR[ RZFRP",
    "526":"  9H\\YFK[ RKFYF RK[Y[",
    "601":" 18I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "602":" 18H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
    "603":" 15I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "604":" 18I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "605":" 18I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "606":"  9MYWFUFSGRJR[ ROMVM",
    "607":" 23I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "608":" 11I\\MFM[ RMQPNRMUMWNXQX[",
    "609":"  9NVQFRGSFREQF RRMR[",
    "610":" 12MWRFSGTFSERF RSMS^RaPbNb",
    "611":"  9IZMFM[ RWMMW RQSX[",
    "612":"  3NVRFR[",
    "613":" 19CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][",
    "614":" 11I\\MMM[ RMQPNRMUMWNXQX[",
    "615":" 18I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM",
    "616":" 18H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
    "617":" 18I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "618":"  9KXOMO[ ROSPPRNTMWM",
    "619":" 18J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX",
    "620":"  9MYRFRWSZU[W[ ROMVM",
    "621":" 11I\\MMMWNZP[S[UZXW RXMX[",
    "622":"  6JZLMR[ RXMR[",
    "623":" 12G]JMN[ RRMN[ RRMV[ RZMV[",
    "624":"  6J[MMX[ RXMM[",
    "625":" 10JZLMR[ RXMR[P_NaLbKb",
    "626":"  9J[XMM[ RMMXM RM[X[",
    "710":"  6MWRYQZR[SZRY"
  };

  const hersheyCache = {};

  function compile_hershey(i) {
    if (hersheyCache[i]) return hersheyCache[i];
    const entry = HERSHEY_RAW[i];
    if (!entry) return null;
    const ordR = 82;
    const bound = entry.substring(3, 5);
    const xmin = bound.charCodeAt(0) - ordR;
    const xmax = bound.charCodeAt(1) - ordR;
    const content = entry.substring(5);
    const polylines = [[]];
    let j = 0;
    while (j < content.length) {
      const digit = content.substring(j, j + 2);
      if (digit === " R") {
        polylines.push([]);
      } else {
        const x = digit.charCodeAt(0) - ordR;
        const y = digit.charCodeAt(1) - ordR;
        polylines[polylines.length - 1].push([x, y]);
      }
      j += 2;
    }
    const data = { xmin, xmax, polylines };
    hersheyCache[i] = data;
    return data;
  }

  function put_text(txt) {
    const base = 500;
    let x = 0;
    const o = [];
    for (let i = 0; i < txt.length; i++) {
      const ord = txt.charCodeAt(i);
      let idx;
      if (65 <= ord && ord <= 90) {
        idx = base + 1 + (ord - 65);
      } else if (97 <= ord && ord <= 122) {
        idx = base + 101 + (ord - 97);
      } else if (ord === 46) {
        idx = 710;
      } else if (ord === 32) {
        x += 10;
        continue;
      } else {
        continue;
      }
      const h = compile_hershey(idx);
      if (!h) continue;
      for (const poly of h.polylines) {
        if (poly.length === 0) continue;
        o.push(poly.map(p => [p[0] + x - h.xmin, p[1]]));
      }
      x += (h.xmax - h.xmin);
    }
    return [x, o];
  }

  function renderHersheyText(ctx, text, x, y, scale = 0.35, color = '#2A2520') {
    const [totalWidth, polylines] = put_text(text);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const poly of polylines) {
      if (poly.length === 0) continue;
      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const gx = x + poly[i][0] * scale;
        const gy = y + poly[i][1] * scale;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
    ctx.restore();
    return totalWidth * scale;
  }

  // Draw Hershey Text into clean SVG path elements
  function hersheyToSvgPaths(text, x, y, scale = 0.35) {
    const [totalWidth, polylines] = put_text(text);
    let paths = '';
    for (const poly of polylines) {
      if (poly.length === 0) continue;
      let d = '';
      for (let i = 0; i < poly.length; i++) {
        const gx = (x + poly[i][0] * scale).toFixed(1);
        const gy = (y + poly[i][1] * scale).toFixed(1);
        d += (i === 0 ? `M ${gx} ${gy} ` : `L ${gx} ${gy} `);
      }
      if (d) {
        paths += `<path d="${d.trim()}" fill="none" />\n`;
      }
    }
    return paths;
  }

  // Botanical Morphometric Parameter Generator
  function generateBotanicalParams(prng, noise) {
    const PAR = {};
    const flowerShapeMask = (x) => pow(sin(PI * x), 0.2);
    const leafShapeMask = (x) => pow(sin(PI * x), 0.5);

    PAR.flowerChance = prng.randChoice([prng.normRand(0, 0.08), prng.normRand(0, 0.03)]);
    PAR.leafChance = prng.randChoice([0, prng.normRand(0, 0.1), prng.normRand(0, 0.1)]);
    PAR.leafType = prng.randChoice([
      [1, prng.randint(2, 5)],
      [2, prng.randint(3, 7), prng.randint(3, 8)],
      [2, prng.randint(3, 7), prng.randint(3, 8)]
    ]);

    const flowerShapeNoiseSeed = prng.next() * PI;
    const flowerJaggedness = prng.normRand(0.5, 8);
    PAR.flowerShape = (x) => noise.noise(x * flowerJaggedness, flowerShapeNoiseSeed) * flowerShapeMask(x);

    const leafJaggedness = prng.normRand(0.1, 40);
    const leafPointyness = prng.normRand(0.5, 1.5);
    PAR.leafShape = prng.randChoice([
      (x) => noise.noise(x * leafJaggedness, flowerShapeNoiseSeed) * leafShapeMask(x),
      (x) => pow(sin(PI * x), leafPointyness)
    ]);

    const flowerHue0 = (prng.normRand(0, 180) - 130 + 360) % 360;
    const flowerHue1 = Math.floor((flowerHue0 + prng.normRand(-70, 70) + 360) % 360);
    const flowerValue0 = Math.min(1, prng.normRand(0.5, 1.3));
    const flowerValue1 = Math.min(1, prng.normRand(0.5, 1.3));
    const flowerSaturation0 = prng.normRand(0, Math.max(0.1, 1.1 - flowerValue0));
    const flowerSaturation1 = prng.normRand(0, Math.max(0.1, 1.1 - flowerValue1));

    PAR.flowerColor = {
      min: [flowerHue0, flowerSaturation0, flowerValue0, prng.normRand(0.8, 1)],
      max: [flowerHue1, flowerSaturation1, flowerValue1, prng.normRand(0.5, 1)]
    };

    PAR.leafColor = {
      min: [prng.normRand(10, 200), prng.normRand(0.05, 0.4), prng.normRand(0.3, 0.7), prng.normRand(0.8, 1)],
      max: [prng.normRand(10, 200), prng.normRand(0.05, 0.4), prng.normRand(0.3, 0.7), prng.normRand(0.8, 1)]
    };

    const curveCoeff0 = [prng.normRand(-0.5, 0.5), prng.normRand(5, 10)];
    const curveCoeff2 = [prng.next() * PI, prng.normRand(5, 15)];
    const curveCoeff4 = [prng.next() * 0.5, prng.normRand(0.8, 1.2)];

    PAR.flowerOpenCurve = prng.randChoice([
      (x, op) => (x < 0.1 ? 2 + op * curveCoeff2[1] : noise.noise(x * 10, curveCoeff2[0])),
      (x, op) => (x < curveCoeff4[0] ? 0 : 10 - x * mapval(op, 0, 1, 16, 20) * curveCoeff4[1])
    ]);

    PAR.flowerColorCurve = (x) => sigmoid(x + curveCoeff0[0], curveCoeff0[1]);

    PAR.leafLength = prng.normRand(30, 100);
    PAR.flowerLength = prng.normRand(10, 55);
    PAR.pedicelLength = prng.normRand(5, 30);
    PAR.leafWidth = prng.normRand(5, 30);
    PAR.flowerWidth = prng.normRand(5, 30);

    PAR.stemWidth = prng.normRand(2, 11);
    PAR.stemBend = prng.normRand(2, 16);
    PAR.stemLength = prng.normRand(300, 400);
    PAR.stemCount = prng.randChoice([2, 3, 4, 5]);

    PAR.sheathLength = prng.randChoice([0, prng.normRand(50, 100)]);
    PAR.sheathWidth = prng.normRand(5, 15);
    PAR.shootCount = prng.normRand(1, 7);
    PAR.shootLength = prng.normRand(50, 180);
    PAR.leafPosition = prng.randChoice([1, 2]);

    PAR.flowerPetal = Math.max(3, Math.round(mapval(PAR.flowerWidth, 5, 50, 8, 3)));

    PAR.innerLength = Math.min(prng.normRand(0, 20), PAR.flowerLength * 0.8);
    PAR.innerWidth = Math.min(prng.randChoice([0, prng.normRand(1, 8)]), PAR.flowerWidth * 0.8);
    const innerHue = prng.normRand(0, 60);
    PAR.innerColor = {
      min: [innerHue, prng.normRand(0.1, 0.7), prng.normRand(0.5, 0.9), prng.normRand(0.8, 1)],
      max: [innerHue, prng.normRand(0.1, 0.7), prng.normRand(0.5, 0.9), prng.normRand(0.5, 1)]
    };

    PAR.branchWidth = prng.normRand(0.4, 1.3);
    PAR.branchTwist = Math.round(prng.normRand(2, 5));
    PAR.branchDepth = prng.randChoice([3, 4]);
    PAR.branchFork = prng.randChoice([4, 5, 6, 7]);

    const branchHue = prng.normRand(30, 60);
    const branchSaturation = prng.normRand(0.05, 0.3);
    const branchValue = prng.normRand(0.7, 0.9);
    PAR.branchColor = {
      min: [branchHue, branchSaturation, branchValue, 1],
      max: [branchHue, branchSaturation, branchValue, 1]
    };

    // Derived Plant Habit: Woody vs. Herbal
    PAR.habit = (prng.next() <= 0.5) ? 'Woody (Ligneous)' : 'Herbal (Herbaceous)';

    return PAR;
  }

  // Botanical Structure Synthesis Elements
  function drawLeaf(ctx, args, noise, prng) {
    const xof = args.xof || 0;
    const yof = args.yof || 0;
    const rot = args.rot || [PI / 2, 0, 0];
    const len = args.len || 500;
    const seg = args.seg || 40;
    const wid = args.wid || ((x) => sin(x * PI) * 20);
    const vei = args.vei || [1, 3];
    const flo = args.flo || false;
    const col = args.col || { min: [90, 0.2, 0.3, 1], max: [90, 0.1, 0.9, 1] };
    const cof = args.cof || ((x) => x);
    const ben = args.ben || ((x) => [prng.normRand(-10, 10), 0, prng.normRand(-5, 5)]);

    let disp = [0, 0, 0];
    let crot = [0, 0, 0];
    const P = [disp];
    const L = [disp];
    const R = [disp];

    const orient = (v) => v3.roteuler(v, rot);

    for (let i = 0; i < seg; i++) {
      const p = i / (seg - 1);
      crot = v3.add(crot, v3.scale(ben(p), 1 / seg));
      disp = v3.add(disp, orient(v3.roteuler([0, 0, len / seg], crot)));
      const w = wid(p);
      const l = v3.add(disp, orient(v3.roteuler([-w, 0, 0], crot)));
      const r = v3.add(disp, orient(v3.roteuler([w, 0, 0], crot)));

      if (i > 0) {
        let lt = 0;
        if (!flo) {
          const v0 = v3.subtract(disp, L[L.length - 1]);
          const v1 = v3.subtract(l, disp);
          const v2 = v3.cross(v0, v1);
          lt = mapval(abs(v3.ang(v2, [0, -1, 0])), 0, PI, 1, 0);
        } else {
          lt = p * prng.normRand(0.95, 1);
        }
        lt = cof(lt) || 0;

        const h = lerpHue(col.min[0], col.max[0], lt);
        const s = mapval(lt, 0, 1, col.min[1], col.max[1]);
        const v = mapval(lt, 0, 1, col.min[2], col.max[2]);
        const a = mapval(lt, 0, 1, col.min[3], col.max[3]);

        polygon(ctx, [l, L[L.length - 1], P[P.length - 1], disp], hsv(h, s, v, a), true, true, xof, yof);
        polygon(ctx, [r, R[R.length - 1], P[P.length - 1], disp], hsv(h, s, v, a), true, true, xof, yof);
      }
      P.push(disp);
      L.push(l);
      R.push(r);
    }

    if (vei[0] === 1) {
      for (let i = 1; i < P.length; i++) {
        for (let j = 0; j < vei[1]; j++) {
          const p = j / vei[1];
          const p0 = v3.lerp(L[i - 1], P[i - 1], p);
          const p1 = v3.lerp(L[i], P[i], p);
          const q0 = v3.lerp(R[i - 1], P[i - 1], p);
          const q1 = v3.lerp(R[i], P[i], p);
          polygon(ctx, [p0, p1], hsv(0, 0, 0, prng.normRand(0.3, 0.7)), false, true, xof, yof);
          polygon(ctx, [q0, q1], hsv(0, 0, 0, prng.normRand(0.3, 0.7)), false, true, xof, yof);
        }
      }
      strokePath(ctx, P, rgba(0, 0, 0, 0.3), null, noise, xof, yof);
    } else if (vei[0] === 2 && P.length > vei[1]) {
      for (let i = 1; i < P.length - vei[1]; i += vei[2]) {
        polygon(ctx, [P[i], L[i + vei[1]]], hsv(0, 0, 0, prng.normRand(0.3, 0.7)), false, true, xof, yof);
        polygon(ctx, [P[i], R[i + vei[1]]], hsv(0, 0, 0, prng.normRand(0.3, 0.7)), false, true, xof, yof);
      }
      strokePath(ctx, P, rgba(0, 0, 0, 0.3), null, noise, xof, yof);
    }

    strokePath(ctx, L, rgba(120, 100, 0, 0.3), null, noise, xof, yof);
    strokePath(ctx, R, rgba(120, 100, 0, 0.3), null, noise, xof, yof);
    return P;
  }

  function drawStem(ctx, args, noise, prng) {
    const xof = args.xof || 0;
    const yof = args.yof || 0;
    const rot = args.rot || [PI / 2, 0, 0];
    const len = args.len || 400;
    const seg = args.seg || 40;
    const wid = args.wid || ((x) => 6);
    const col = args.col || { min: [250, 0.2, 0.4, 1], max: [250, 0.3, 0.6, 1] };
    const ben = args.ben || ((x) => [prng.normRand(-10, 10), 0, prng.normRand(-5, 5)]);

    let disp = [0, 0, 0];
    let crot = [0, 0, 0];
    const P = [disp];

    const orient = (v) => v3.roteuler(v, rot);

    for (let i = 0; i < seg; i++) {
      const p = i / (seg - 1);
      crot = v3.add(crot, v3.scale(ben(p), 1 / seg));
      disp = v3.add(disp, orient(v3.roteuler([0, 0, len / seg], crot)));
      P.push(disp);
    }

    const [L, R] = tubify(P, wid);
    const wseg = 4;
    for (let i = 1; i < P.length; i++) {
      for (let j = 1; j < wseg; j++) {
        const m = (j - 1) / (wseg - 1);
        const n = j / (wseg - 1);
        const p = i / (P.length - 1);

        const p0 = v3.lerp(L[i - 1], R[i - 1], m);
        const p1 = v3.lerp(L[i], R[i], m);
        const p2 = v3.lerp(L[i - 1], R[i - 1], n);
        const p3 = v3.lerp(L[i], R[i], n);

        const lt = n / (p || 1);
        const h = lerpHue(col.min[0], col.max[0], lt) * mapval(noise.noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1);
        const s = mapval(lt, 0, 1, col.max[1], col.min[1]) * mapval(noise.noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1);
        const v = mapval(lt, 0, 1, col.min[2], col.max[2]) * mapval(noise.noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1);
        const a = mapval(lt, 0, 1, col.min[3], col.max[3]);

        polygon(ctx, [p0, p1, p3, p2], hsv(h, s, v, a), true, true, xof, yof);
      }
    }
    strokePath(ctx, L, rgba(0, 0, 0, 0.5), null, noise, xof, yof);
    strokePath(ctx, R, rgba(0, 0, 0, 0.5), null, noise, xof, yof);
    return P;
  }

  function drawBranch(ctx, args, noise, prng) {
    const xof = args.xof || 0;
    const yof = args.yof || 0;
    const rot = args.rot || [PI / 2, 0, 0];
    const len = args.len || 400;
    const seg = args.seg || 40;
    const wid = args.wid !== undefined ? args.wid : 1;
    const twi = args.twi || 5;
    const col = args.col || { min: [50, 0.2, 0.8, 1], max: [50, 0.2, 0.8, 1] };
    const dep = args.dep !== undefined ? args.dep : 3;
    const frk = args.frk || 4;

    const jnt = [];
    for (let i = 0; i < twi; i++) {
      jnt.push([Math.floor(prng.next() * seg), prng.normRand(-1, 1)]);
    }

    function jntdist(x) {
      let m = seg;
      let j = 0;
      for (let i = 0; i < jnt.length; i++) {
        const n = Math.abs(x * seg - jnt[i][0]);
        if (n < m) { m = n; j = i; }
      }
      return [m, jnt[j][1]];
    }

    const wfun = function(x) {
      const [m] = jntdist(x);
      if (m < 1) return wid * (3 + 5 * (1 - x));
      return wid * (2 + 7 * (1 - x) * mapval(noise.noise(x * 10), 0, 1, 0.5, 1));
    };

    const bfun = function(x) {
      const [m, j] = jntdist(x);
      if (m < 1) return [0, j * 20, 0];
      return [0, prng.normRand(-5, 5), 0];
    };

    const P = drawStem(ctx, { xof, yof, rot, len, seg, wid: wfun, col, ben: bfun }, noise, prng);

    let child = [];
    if (dep > 0 && wid > 0.1) {
      const forkCount = Math.floor(frk * prng.next());
      for (let i = 0; i < forkCount; i++) {
        const ind = Math.floor(prng.normRand(1, P.length));
        const r = grot(P, ind);
        const subBranch = drawBranch(ctx, {
          xof: xof + P[ind][0],
          yof: yof + P[ind][1],
          rot: [
            r[0] + prng.normRand(-1, 1) * PI / 6,
            r[1] + prng.normRand(-1, 1) * PI / 6,
            r[2] + prng.normRand(-1, 1) * PI / 6
          ],
          seg,
          len: len * prng.normRand(0.4, 0.6),
          wid: wid * prng.normRand(0.4, 0.7),
          twi: twi * 0.7,
          dep: dep - 1,
          frk
        }, noise, prng);
        child = child.concat(subBranch);
      }
    }
    return [[dep, P.map(v => [v[0] + xof, v[1] + yof, v[2]])]].concat(child);
  }

  // Generate Woody (Ligneous / Fruticose) Specimen
  function generateWoodyPlant(targetCtx, PAR, noise, prng, renderWidth, renderHeight) {
    const cwid = 1000;
    const canvas0 = document.createElement('canvas');
    canvas0.width = cwid;
    canvas0.height = cwid;
    const lay0 = canvas0.getContext('2d');

    const canvas1 = document.createElement('canvas');
    canvas1.width = cwid;
    canvas1.height = cwid;
    const lay1 = canvas1.getContext('2d');

    const PL = drawBranch(lay0, {
      xof: cwid * 0.5,
      yof: cwid * 0.75,
      wid: PAR.branchWidth,
      twi: PAR.branchTwist,
      dep: PAR.branchDepth,
      col: PAR.branchColor,
      frk: PAR.branchFork
    }, noise, prng);

    for (let i = 0; i < PL.length; i++) {
      if (i / PL.length > 0.1) {
        const pts = PL[i][1];
        for (let j = 0; j < pts.length; j++) {
          if (prng.next() < PAR.leafChance) {
            drawLeaf(lay0, {
              xof: pts[j][0],
              yof: pts[j][1],
              len: PAR.leafLength * prng.normRand(0.8, 1.2),
              vei: PAR.leafType,
              col: PAR.leafColor,
              rot: [prng.normRand(-1, 1) * PI, prng.normRand(-1, 1) * PI, 0],
              wid: (x) => PAR.leafShape(x) * PAR.leafWidth,
              ben: (x) => [
                mapval(noise.noise(x * 1, i), 0, 1, -1, 1) * 5,
                0,
                mapval(noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 5
              ]
            }, noise, prng);
          }

          if (prng.next() < PAR.flowerChance) {
            const hr = [prng.normRand(-1, 1) * PI, prng.normRand(-1, 1) * PI, 0];
            const P_ = drawStem(lay0, {
              xof: pts[j][0],
              yof: pts[j][1],
              rot: hr,
              len: PAR.pedicelLength,
              col: { min: [50, 1, 0.9, 1], max: [50, 1, 0.9, 1] },
              wid: (x) => sin(x * PI) * x * 2 + 1,
              ben: () => [0, 0, 0]
            }, noise, prng);

            const op = prng.next();
            const hhr = grot(P_, P_.length - 1);
            const petalCount = PAR.flowerPetal;

            for (let k = 0; k < petalCount; k++) {
              const lastP = P_[P_.length - 1];
              drawLeaf(lay1, {
                flo: true,
                xof: pts[j][0] + lastP[0],
                yof: pts[j][1] + lastP[1],
                rot: [hhr[0], hhr[1], hhr[2] + (k / petalCount) * PI * 2],
                len: PAR.flowerLength * prng.normRand(0.7, 1.3),
                wid: (x) => PAR.flowerShape(x) * PAR.flowerWidth,
                vei: [0],
                col: PAR.flowerColor,
                cof: PAR.flowerColorCurve,
                ben: (x) => [PAR.flowerOpenCurve(x, op), 0, 0]
              }, noise, prng);

              drawLeaf(lay1, {
                flo: true,
                xof: pts[j][0] + lastP[0],
                yof: pts[j][1] + lastP[1],
                rot: [hhr[0], hhr[1], hhr[2] + (k / petalCount) * PI * 2],
                len: PAR.innerLength * prng.normRand(0.8, 1.2),
                wid: (x) => sin(x * PI) * 4,
                vei: [0],
                col: PAR.innerColor,
                cof: (x) => x,
                ben: (x) => [PAR.flowerOpenCurve(x, op), 0, 0]
              }, noise, prng);
            }
          }
        }
      }
    }

    applyFadeFilter(lay0, noise);
    applyWispyFilter(lay0, noise);
    applyWispyFilter(lay1, noise);

    const b1 = getLayerBounds(lay0);
    const b2 = getLayerBounds(lay1);
    const bd = {
      xmin: Math.min(b1.xmin, b2.xmin),
      xmax: Math.max(b1.xmax, b2.xmax),
      ymin: Math.min(b1.ymin, b2.ymin),
      ymax: Math.max(b1.ymax, b2.ymax)
    };

    // Calculate scale and position inside target canvas
    const plantW = Math.max(10, bd.xmax - bd.xmin);
    const plantH = Math.max(10, bd.ymax - bd.ymin);
    const targetW = renderWidth * 0.78;
    const targetH = renderHeight * 0.72;
    const scale = Math.min(targetW / plantW, targetH / plantH, 1.4);

    const cx = (bd.xmin + bd.xmax) / 2;
    const cy = bd.ymax;
    const destX = renderWidth * 0.5;
    const destY = renderHeight * 0.86;

    targetCtx.save();
    targetCtx.translate(destX, destY);
    targetCtx.scale(scale, scale);
    targetCtx.translate(-cx, -cy);

    targetCtx.globalCompositeOperation = 'multiply';
    targetCtx.drawImage(canvas0, 0, 0);

    targetCtx.globalCompositeOperation = 'source-over';
    targetCtx.drawImage(canvas1, 0, 0);
    targetCtx.restore();
  }

  // Generate Herbal (Herbaceous) Specimen
  function generateHerbalPlant(targetCtx, PAR, noise, prng, renderWidth, renderHeight) {
    const cwid = 1000;
    const canvas0 = document.createElement('canvas');
    canvas0.width = cwid;
    canvas0.height = cwid;
    const lay0 = canvas0.getContext('2d');

    const canvas1 = document.createElement('canvas');
    canvas1.width = cwid;
    canvas1.height = cwid;
    const lay1 = canvas1.getContext('2d');

    const x0 = cwid * 0.5;
    const y0 = cwid * 0.8;

    for (let i = 0; i < PAR.stemCount; i++) {
      const r = [PI / 2, 0, prng.normRand(-1, 1) * PI];
      const P = drawStem(lay0, {
        xof: x0,
        yof: y0,
        len: PAR.stemLength * prng.normRand(0.7, 1.3),
        rot: r,
        wid: (x) => PAR.stemWidth * (pow(sin(x * PI / 2 + PI / 2), 0.5) * noise.noise(x * 10) * 0.5 + 0.5),
        ben: (x) => [
          mapval(noise.noise(x * 1, i), 0, 1, -1, 1) * x * PAR.stemBend,
          0,
          mapval(noise.noise(x * 1, i + PI), 0, 1, -1, 1) * x * PAR.stemBend
        ]
      }, noise, prng);

      if (PAR.leafPosition === 2) {
        for (let j = 0; j < P.length; j++) {
          if (prng.next() < PAR.leafChance * 2) {
            drawLeaf(lay0, {
              xof: x0 + P[j][0],
              yof: y0 + P[j][1],
              len: 2 * PAR.leafLength * prng.normRand(0.8, 1.2),
              vei: PAR.leafType,
              col: PAR.leafColor,
              rot: [prng.normRand(-1, 1) * PI, prng.normRand(-1, 1) * PI, 0],
              wid: (x) => 2 * PAR.leafShape(x) * PAR.leafWidth,
              ben: (x) => [
                mapval(noise.noise(x * 1, i), 0, 1, -1, 1) * 5,
                0,
                mapval(noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 5
              ]
            }, noise, prng);
          }
        }
      }

      const hr = grot(P, P.length - 1);
      const lastP = P[P.length - 1];

      if (PAR.sheathLength !== 0) {
        drawStem(lay0, {
          xof: x0 + lastP[0],
          yof: y0 + lastP[1],
          rot: hr,
          len: PAR.sheathLength,
          col: { min: [60, 0.3, 0.9, 1], max: [60, 0.3, 0.9, 1] },
          wid: (x) => PAR.sheathWidth * (pow(sin(x * PI), 2) - x * 0.5 + 0.5),
          ben: () => [0, 0, 0]
        }, noise, prng);
      }

      const shoots = Math.max(1, Math.round(PAR.shootCount * prng.normRand(0.5, 1.5)));
      for (let j = 0; j < shoots; j++) {
        const P_ = drawStem(lay0, {
          xof: x0 + lastP[0],
          yof: y0 + lastP[1],
          rot: hr,
          len: PAR.shootLength * prng.normRand(0.5, 1.5),
          col: { min: [70, 0.2, 0.9, 1], max: [70, 0.2, 0.9, 1] },
          wid: () => 2,
          ben: (x) => [
            mapval(noise.noise(x * 1, j), 0, 1, -1, 1) * x * 10,
            0,
            mapval(noise.noise(x * 1, j + PI), 0, 1, -1, 1) * x * 10
          ]
        }, noise, prng);

        const op = prng.next();
        const hhr = [prng.normRand(-1, 1) * PI, prng.normRand(-1, 1) * PI, prng.normRand(-1, 1) * PI];
        const lastP_ = P_[P_.length - 1];
        const petalCount = PAR.flowerPetal;

        for (let k = 0; k < petalCount; k++) {
          drawLeaf(lay1, {
            flo: true,
            xof: x0 + lastP[0] + lastP_[0],
            yof: y0 + lastP[1] + lastP_[1],
            rot: [hhr[0], hhr[1], hhr[2] + (k / petalCount) * PI * 2],
            len: PAR.flowerLength * prng.normRand(0.7, 1.3) * 1.5,
            wid: (x) => 1.5 * PAR.flowerShape(x) * PAR.flowerWidth,
            vei: [0],
            col: PAR.flowerColor,
            cof: PAR.flowerColorCurve,
            ben: (x) => [PAR.flowerOpenCurve(x, op), 0, 0]
          }, noise, prng);

          drawLeaf(lay1, {
            flo: true,
            xof: x0 + lastP[0] + lastP_[0],
            yof: y0 + lastP[1] + lastP_[1],
            rot: [hhr[0], hhr[1], hhr[2] + (k / petalCount) * PI * 2],
            len: PAR.innerLength * prng.normRand(0.8, 1.2),
            wid: (x) => sin(x * PI) * 4,
            vei: [0],
            col: PAR.innerColor,
            cof: (x) => x,
            ben: (x) => [PAR.flowerOpenCurve(x, op), 0, 0]
          }, noise, prng);
        }
      }
    }

    if (PAR.leafPosition === 1) {
      const basalLeaves = Math.floor(PAR.leafChance * 100);
      for (let i = 0; i < basalLeaves; i++) {
        drawLeaf(lay0, {
          xof: x0,
          yof: y0,
          rot: [PI / 3, 0, prng.normRand(-1, 1) * PI],
          len: 4 * PAR.leafLength * prng.normRand(0.8, 1.2),
          wid: (x) => 2 * PAR.leafShape(x) * PAR.leafWidth,
          vei: PAR.leafType,
          ben: (x) => [
            mapval(noise.noise(x * 1, i), 0, 1, -1, 1) * 10,
            0,
            mapval(noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 10
          ]
        }, noise, prng);
      }
    }

    applyFadeFilter(lay0, noise);
    applyWispyFilter(lay0, noise);
    applyWispyFilter(lay1, noise);

    const b1 = getLayerBounds(lay0);
    const b2 = getLayerBounds(lay1);
    const bd = {
      xmin: Math.min(b1.xmin, b2.xmin),
      xmax: Math.max(b1.xmax, b2.xmax),
      ymin: Math.min(b1.ymin, b2.ymin),
      ymax: Math.max(b1.ymax, b2.ymax)
    };

    const plantW = Math.max(10, bd.xmax - bd.xmin);
    const plantH = Math.max(10, bd.ymax - bd.ymin);
    const targetW = renderWidth * 0.78;
    const targetH = renderHeight * 0.74;
    const scale = Math.min(targetW / plantW, targetH / plantH, 1.4);

    const cx = (bd.xmin + bd.xmax) / 2;
    const cy = bd.ymax;
    const destX = renderWidth * 0.5;
    const destY = renderHeight * 0.86;

    targetCtx.save();
    targetCtx.translate(destX, destY);
    targetCtx.scale(scale, scale);
    targetCtx.translate(-cx, -cy);

    targetCtx.globalCompositeOperation = 'multiply';
    targetCtx.drawImage(canvas0, 0, 0);

    targetCtx.globalCompositeOperation = 'source-over';
    targetCtx.drawImage(canvas1, 0, 0);
    targetCtx.restore();
  }

  // Draw Procedural Paper Texture on Canvas
  function drawPaperGrain(ctx, width, height, noise) {
    const patchSize = 256;
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = patchSize;
    patchCanvas.height = patchSize;
    const pctx = patchCanvas.getContext('2d');
    const pimg = pctx.createImageData(patchSize, patchSize);
    const d = pimg.data;

    for (let i = 0; i < patchSize; i++) {
      for (let j = 0; j < patchSize; j++) {
        const idx = (j * patchSize + i) * 4;
        const n = noise.noise(i * 0.08, j * 0.08);
        const val = Math.floor(255 - n * 18 + (Math.random() - 0.5) * 8);
        d[idx] = Math.min(255, Math.floor(val * 0.94));     // R
        d[idx + 1] = Math.min(255, Math.floor(val * 0.91)); // G
        d[idx + 2] = Math.min(255, Math.floor(val * 0.86)); // B
        d[idx + 3] = 40; // Subtle alpha blend
      }
    }
    pctx.putImageData(pimg, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (let x = 0; x < width; x += patchSize) {
      for (let y = 0; y < height; y += patchSize) {
        ctx.drawImage(patchCanvas, x, y);
      }
    }
    ctx.restore();
  }

  // ============================================================================
  // FlowerDraw Primary Interface
  // ============================================================================

  const FlowerDraw = {
    hashStringTo32Bit,
    hashToAccessionId,
    accessionIdToHash,
    deriveTaxonFromHash,

    /**
     * Synthesize a complete botanical specimen plate onto a Canvas.
     * @param {string|number} seedInput - Narrative string, seed, or accession ID
     * @param {object} options - Configuration overrides (width, height, stroke, bg)
     */
    synthesize: function(seedInput, options = {}) {
      let hash = 0;
      let seedStr = String(seedInput || 'Archival Botanical Specimen');

      // Check if seedInput is already an Accession ID (FLV-XX-XXXXXX)
      const decodedHash = accessionIdToHash(seedStr);
      if (decodedHash !== null) {
        hash = decodedHash;
      } else {
        hash = hashStringTo32Bit(seedStr);
      }

      const hashHex = `0x${hash.toString(16).padStart(8, '0').toUpperCase()}`;
      const accessionId = hashToAccessionId(hash);
      const taxon = deriveTaxonFromHash(hash);

      const prng = new SeedablePRNG(hash);
      const noise = new PerlinNoise(prng);
      const PAR = generateBotanicalParams(prng, noise);

      const width = options.width || 600;
      const height = options.height || 600;
      const margin = options.margin || 14;
      const bg = options.bg || '#EFE9DC';
      const strokeColor = options.stroke || '#2A2520';
      const metaColor = options.metaColor || '#7A7068';

      // Morphometric Telemetry Payload
      const metrics = {
        seed: seedStr,
        hash,
        hashHex,
        accessionId,
        id: accessionId,
        taxon: taxon.taxonName,
        family: taxon.family,
        genus: taxon.genus,
        species: taxon.species,
        meaning: taxon.meaning,
        habit: PAR.habit,
        phyllotaxy: PAR.leafPosition === 1 ? 'Basal Clustered' : 'Alternate Cauline',
        leafType: PAR.leafType[0] === 1 ? 'Parallel-veined' : 'Pinnate-reticulate',
        leafLength: Math.round(PAR.leafLength),
        leafWidth: Math.round(PAR.leafWidth),
        flowerPetals: PAR.flowerPetal,
        flowerLength: Math.round(PAR.flowerLength),
        flowerWidth: Math.round(PAR.flowerWidth),
        stemDynamics: `${PAR.stemCount} Primary Axis (Bend: ${Math.round(PAR.stemBend * 10)}%)`,
        pigmentChroma: `Hue ${Math.round(PAR.flowerColor.min[0])}° / ${Math.round(PAR.flowerColor.max[0])}°`,
        chlorophyllHue: `Hue ${Math.round(PAR.leafColor.min[0])}°`
      };

      // Create target canvas if available or provided
      const canvas = options.canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);

      if (canvas && typeof canvas.getContext === 'function') {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 1. Fill base matte surface
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // 2. Synthesize plant according to habit
        if (PAR.habit.includes('Woody')) {
          generateWoodyPlant(ctx, PAR, noise, prng, width, height);
        } else {
          generateHerbalPlant(ctx, PAR, noise, prng, width, height);
        }

        // 3. Apply subtle paper grain texture
        drawPaperGrain(ctx, width, height, noise);

        // 4. Render Technical Archival Plate Framing & Stamps
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.0;
        ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

        // Inner subtle border
        ctx.strokeStyle = metaColor;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(margin + 4, margin + 4, width - (margin + 4) * 2, height - (margin + 4) * 2);

        // Plate stamps in JetBrains Mono / Tech font
        const fontSize = Math.max(7.5, Math.min(10, Math.round(Math.min(width, height) * 0.018)));
        ctx.fillStyle = metaColor;
        ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
        ctx.textBaseline = 'middle';

        // Bottom-Left: ID:<accessionId>
        ctx.textAlign = 'left';
        ctx.fillText(`ID:${accessionId}`, margin + 8, height - margin - 10);

        // Top-Right: PTR:<hashHex>
        ctx.textAlign = 'right';
        ctx.fillText(`PTR:${hashHex}`, width - margin - 8, margin + 14);
        ctx.restore();

        // 5. Render Cursive Hershey Latin Binomen at Bottom-Center
        const cursiveScale = Math.max(0.28, Math.min(0.38, (width / 600) * 0.34));
        const cursiveY = height - margin - 15;
        const [textW] = put_text(taxon.taxonName);
        const cursiveX = Math.max(margin + 90, Math.round((width - textW * cursiveScale) / 2));
        renderHersheyText(ctx, taxon.taxonName, cursiveX, cursiveY, cursiveScale, strokeColor);
      }

      return {
        canvas,
        metrics,
        accessionId,
        hashHex,
        taxon: taxon.taxonName,
        family: taxon.family,
        habit: PAR.habit
      };
    },

    /**
     * Alias for generateSpecimen supporting object arguments.
     */
    generateSpecimen: function(options = {}) {
      const seed = options.narrative || options.seed || options.id || 'Archival Botanical Specimen';
      return FlowerDraw.synthesize(seed, options);
    },

    /**
     * Generate an Archival SVG Document wrapping the specimen and vector framing.
     */
    generateSvgPlate: function(canvas, metrics, options = {}) {
      const width = canvas.width;
      const height = canvas.height;
      const margin = options.margin || 14;
      const dataUrl = canvas.toDataURL('image/png');
      const metaColor = options.metaColor || '#7A7068';
      const strokeColor = options.stroke || '#2A2520';

      const cursiveScale = Math.max(0.28, Math.min(0.38, (width / 600) * 0.34));
      const cursiveY = height - margin - 15;
      const [textW] = put_text(metrics.taxon || '');
      const cursiveX = Math.max(margin + 90, Math.round((width - textW * cursiveScale) / 2));
      const hersheySvgPaths = hersheyToSvgPaths(metrics.taxon || '', cursiveX, cursiveY, cursiveScale);

      const fontSize = Math.max(7.5, Math.min(10, Math.round(Math.min(width, height) * 0.018)));

      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Archival Background Plate -->
  <rect width="100%" height="100%" fill="#EFE9DC" />
  
  <!-- Gongbi Procedural Botanical Canvas Rendering -->
  <image href="${dataUrl}" x="0" y="0" width="${width}" height="${height}" />
  
  <!-- Archival Drafting Borders -->
  <rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" fill="none" stroke="${strokeColor}" stroke-width="1.0" />
  <rect x="${margin + 4}" y="${margin + 4}" width="${width - (margin + 4) * 2}" height="${height - (margin + 4) * 2}" fill="none" stroke="${metaColor}" stroke-width="0.5" />
  
  <!-- Archival Typography Stamps -->
  <g font-family="'JetBrains Mono', monospace" font-size="${fontSize}" fill="${metaColor}">
    <text x="${margin + 8}" y="${height - margin - 10}">ID:${metrics.accessionId}</text>
    <text x="${width - margin - 8}" y="${margin + 14}" text-anchor="end">PTR:${metrics.hashHex}</text>
  </g>
  
  <!-- Engraved Cursive Botanical Binomen -->
  <g stroke="${strokeColor}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
    ${hersheySvgPaths}
  </g>
</svg>`;
    }
  };

  return FlowerDraw;
}));
