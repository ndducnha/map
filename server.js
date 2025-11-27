// =======================
//  SIMPLE EXPRESS SERVER
// =======================
const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https"); // <-- NEW
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// =======================
//  PHONG THỦY – HUYỀN KHÔNG
// =======================
const { Solar } = require("lunar-javascript");

const solsticeData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "solstice-compact.json"), "utf-8")
);

// === GMT+7: interpret datetime-local as VN time using UTC getters ===
function parseDatetimeLocalGmt7(datetimeLocalStr) {
  // datetime-local: "YYYY-MM-DDTHH:mm"
  if (!datetimeLocalStr) return null;
  const [d, t] = datetimeLocalStr.split("T");
  if (!d || !t) return null;
  const [Y, M, D] = d.split("-").map(Number);
  const [h, m] = t.split(":").map(Number);
  if (![Y, M, D, h, m].every((v) => Number.isFinite(v))) return null;

  // A "VN local time" represented as a UTC date with the same components.
  // So getUTC* gives VN intended Y/M/D/h/m regardless server timezone.
  return new Date(Date.UTC(Y, M - 1, D, h, m, 0));
}

function lunarFromVNDateUTC(vnDateUTC) {
  return Solar.fromYmdHms(
    vnDateUTC.getUTCFullYear(),
    vnDateUTC.getUTCMonth() + 1,
    vnDateUTC.getUTCDate(),
    vnDateUTC.getUTCHours(),
    vnDateUTC.getUTCMinutes(),
    vnDateUTC.getUTCSeconds()
  ).getLunar();
}

function getNineQi(birthYear, gender) {
  let v =
    gender === "male"
      ? 10 - ((birthYear - 1864) % 9)
      : 5 + ((birthYear - 1864) % 9);

  v = v % 9 === 0 ? 9 : v % 9;
  return v;
}

function whichHalfVN(vnDateUTC) {
  const year = vnDateUTC.getUTCFullYear();
  const sol = solsticeData[year];
  if (!sol) return "first";

  const summer = new Date(Date.UTC(year, sol.summer.month - 1, sol.summer.day, 0, 0, 0));
  const winter = new Date(Date.UTC(year, sol.winter.month - 1, sol.winter.day, 0, 0, 0));

  if (vnDateUTC < summer) return "first";
  if (vnDateUTC >= summer && vnDateUTC < winter) return "last";
  return "first";
}

function getCenter(dayZhi, hourZhiIndex, half) {
  let center = 0;

  if (["Tý", "Mão", "Ngọ", "Dậu"].includes(dayZhi)) {
    center = (1 + hourZhiIndex) % 9;
  } else if (["Sửu", "Thìn", "Mùi", "Tuất"].includes(dayZhi)) {
    center = (4 + hourZhiIndex) % 9;
  } else {
    center = (7 + hourZhiIndex) % 9;
  }

  center = center === 0 ? 9 : center;
  if (half === "last") center = 10 - center;
  return center;
}

function getRiskDirections(center, nineQi) {
  let arr = [];
  for (let i = 0; i < 9; i++) arr.push(((center + i - 1) % 9) + 1);

  const idx5 = arr.indexOf(5);
  const idx5op = idx5 === 0 ? 0 : 9 - idx5;

  const idxQi = arr.indexOf(nineQi);
  const idxQiop = idxQi === 0 ? 0 : 9 - idxQi;

  const set = new Set([idx5, idx5op, idxQi, idxQiop].filter((v) => v !== 0));

  const dirMap = {
    1: "Tây Bắc",
    2: "Tây",
    3: "Đông Bắc",
    4: "Nam",
    5: "Bắc",
    6: "Tây Nam",
    7: "Đông",
    8: "Đông Nam",
  };

  return [...set].map((i) => dirMap[i]);
}

function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const λ1 = toRad(lon1);
  const λ2 = toRad(lon2);

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Map hướng -> góc
const DIR_ANGLE = {
  "Bắc": 0,
  "Đông Bắc": 45,
  "Đông": 90,
  "Đông Nam": 135,
  "Nam": 180,
  "Tây Nam": 225,
  "Tây": 270,
  "Tây Bắc": 315,
};

// Continuous risk (0..1) theo góc
function riskLevelFromBearing(brng, riskDirs) {
  if (!riskDirs || !riskDirs.length) return 0;

  const angles = riskDirs
    .map((d) => DIR_ANGLE[d])
    .filter((a) => typeof a === "number");

  if (!angles.length) return 0;

  let minDiff = 999;
  for (const a of angles) {
    let diff = Math.abs(brng - a);
    if (diff > 180) diff = 360 - diff;
    if (diff < minDiff) minDiff = diff;
  }

  const maxInfluenceDeg = 60; // ngoài 60° coi như 0 ảnh hưởng
  if (minDiff >= maxInfluenceDeg) return 0;

  return 1 - minDiff / maxInfluenceDeg;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * LuckyMap Fast Sampled:
 * - Vẫn continuous risk theo góc
 * - Không duyệt OSRM steps
 * - Sample theo route.geometry (nhanh)
 */
function calcLuckySampled(route, riskDirs) {
  const coords = route.geometry && route.geometry.coordinates;
  if (!coords || coords.length < 2) return { luckyPoint: 50.0, riskRatio: 0.0 };

  const MAX_SEGMENTS = 36; // theo yêu cầu
  const n = coords.length;
  const step = Math.max(1, Math.ceil((n - 1) / MAX_SEGMENTS)); // ổn định hơn floor

  const picked = [];
  for (let i = 0; i < n; i += step) picked.push(coords[i]);
  if (picked[picked.length - 1] !== coords[n - 1]) picked.push(coords[n - 1]);

  let weightedRisk = 0;
  let distSum = 0;

  for (let i = 0; i < picked.length - 1; i++) {
    const [lon1, lat1] = picked[i];
    const [lon2, lat2] = picked[i + 1];

    const segDist = haversineMeters(lat1, lon1, lat2, lon2);
    if (segDist <= 0) continue;

    const brng = bearingBetween(lat1, lon1, lat2, lon2);
    const riskLevel = riskLevelFromBearing(brng, riskDirs);

    weightedRisk += riskLevel * segDist;
    distSum += segDist;
  }

  const total = route.distance || distSum || 1;
  const riskRatio = weightedRisk / total;

  const amp = 1.5;
  let luckyPoint = 100 - riskRatio * 100 * amp;

  luckyPoint = Math.max(0, Math.min(100, luckyPoint));

  // 2 decimals
  luckyPoint = Math.round(luckyPoint * 100) / 100;
  const rr = Math.max(0, Math.min(1, riskRatio));
  const riskRatio2 = Math.round(rr * 100) / 100;

  return { luckyPoint, riskRatio: riskRatio2 };
}

// =======================
//  OSRM Helper (nhẹ + alternatives)
// =======================
async function fetchOsrmRoutes(profile, coordList) {
  const coordStr = coordList.map((p) => `${p.lng},${p.lat}`).join(";");

  // overview=simplified: giảm polyline => nhanh
  // alternatives=true: có nhiều tuyến hơn mà không cần gọi thêm
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    coordStr +
    `?overview=simplified&geometries=geojson&alternatives=true`;

  try {
    const osrm = await fetch(url).then((r) => r.json());
    return osrm.routes || [];
  } catch (e) {
    console.error("OSRM error:", e);
    return [];
  }
}

// =======================
//  NEW: Proxy Nominatim (để autocomplete luôn hiện)
// =======================
function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (resp) => {
      let data = "";
      resp.on("data", (c) => (data += c));
      resp.on("end", () => {
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Invalid JSON from nominatim"));
          }
        } else {
          reject(new Error(`Nominatim HTTP ${resp.statusCode}: ${data.slice(0,200)}`));
        }
      });
    }).on("error", reject);
  });
}

const GEO_CACHE_MS = 30000;
const geoCache = new Map(); // key -> {t, v}

app.get("/api/geocode", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 3) return res.json([]);

    const key = "s:" + q.toLowerCase();
    const now = Date.now();
    const cached = geoCache.get(key);
    if (cached && (now - cached.t) < GEO_CACHE_MS) return res.json(cached.v);

    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2` +
      `&q=${encodeURIComponent(q)}` +
      `&addressdetails=1&limit=10&accept-language=vi`;

    // Nominatim khuyến nghị có User-Agent + contact (bạn sửa lại chuỗi này cho “đàng hoàng”)
    const headers = {
      "Accept": "application/json",
      "User-Agent": "LuckyMapDemo/1.0 (contact: you@example.com)"
    };

    const data = await httpsGetJson(url, headers);
    const out = Array.isArray(data) ? data : [];
    geoCache.set(key, { t: now, v: out });
    res.json(out);
  } catch (e) {
    console.error(e);
    res.json([]);
  }
});

app.get("/api/reverse", async (req, res) => {
  try {
    const lat = String(req.query.lat || "").trim();
    const lng = String(req.query.lng || "").trim();
    if (!lat || !lng) return res.json({ display_name: null });

    const key = `r:${lat},${lng}`;
    const now = Date.now();
    const cached = geoCache.get(key);
    if (cached && (now - cached.t) < GEO_CACHE_MS) return res.json(cached.v);

    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
      `&zoom=18&addressdetails=1&accept-language=vi`;

    const headers = {
      "Accept": "application/json",
      "User-Agent": "LuckyMapDemo/1.0 (contact: you@example.com)"
    };

    const data = await httpsGetJson(url, headers);
    const out = { display_name: (data && data.display_name) ? data.display_name : null };
    geoCache.set(key, { t: now, v: out });
    res.json(out);
  } catch (e) {
    console.error(e);
    res.json({ display_name: null });
  }
});

// =======================
//  API LUCKY ROUTES
// =======================
app.post("/api/lucky-routes", async (req, res) => {
  try {
    const { origin, destination, birthYear, gender, vehicle, datetime } = req.body;

    if (!origin || !destination || !birthYear || !gender) {
      return res.status(400).json({ error: "Missing params" });
    }

    // Ensure numbers
    const o = { lat: parseFloat(origin.lat), lng: parseFloat(origin.lng) };
    const d = { lat: parseFloat(destination.lat), lng: parseFloat(destination.lng) };

    if (![o.lat, o.lng, d.lat, d.lng].every((v) => Number.isFinite(v))) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // VN time in UTC-date form (uses getUTC* as VN components)
    const vnDateUTC = parseDatetimeLocalGmt7(datetime) || nowVNDateUTC();

    function nowVNDateUTC() {
      return new Date(Date.now() + 7 * 3600000);
    }

    const L = lunarFromVNDateUTC(vnDateUTC);
    const dayZhi = L.getDayZhi();
    const hourIdx = L.getTimeZhiIndex();
    const half = whichHalfVN(vnDateUTC);

    const center = getCenter(dayZhi, hourIdx, half);
    const nineQi = getNineQi(Number(birthYear), gender);
    const riskDirs = getRiskDirections(center, nineQi);

    const profile = vehicle === "foot" ? "foot" : "driving";

    // Base + 4 waypoint variants (PARALLEL)
    const midLat = (o.lat + d.lat) / 2;
    const midLng = (o.lng + d.lng) / 2;
    const delta = 0.004;

    const wps = [
      null, // base
      { lat: midLat + delta, lng: midLng },
      { lat: midLat - delta, lng: midLng },
      { lat: midLat, lng: midLng + delta },
      { lat: midLat, lng: midLng - delta },
    ];

    const promises = wps.map((wp) => {
      const coords = wp
        ? [
            { lng: o.lng, lat: o.lat },
            { lng: wp.lng, lat: wp.lat },
            { lng: d.lng, lat: d.lat },
          ]
        : [
            { lng: o.lng, lat: o.lat },
            { lng: d.lng, lat: d.lat },
          ];
      return fetchOsrmRoutes(profile, coords);
    });

    const results = await Promise.all(promises);
    const allRoutes = [];
    results.forEach((arr) => allRoutes.push(...arr));

    if (!allRoutes.length) {
      return res.json({
        birthYear,
        nineQi,
        center,
        riskDirections: riskDirs,
        routes: [],
      });
    }

    // Score (fast) + keep geometry for map + google maps
    const scored = allRoutes.map((r) => {
      const { luckyPoint, riskRatio } = calcLuckySampled(r, riskDirs);
      return {
        luckyPoint,     // base score, numeric
        riskRatio,      // numeric
        distance: r.distance,
        duration: r.duration,
        geometry: r.geometry,
      };
    });

    // Sort by base lucky desc
    scored.sort((a, b) => (b.luckyPoint || 0) - (a.luckyPoint || 0));

    // Dedup + take max 5
    const seen = new Set();
    const final5 = [];
    for (const r of scored) {
      const coords = r.geometry && r.geometry.coordinates;
      if (!coords || coords.length < 2) continue;

      const first = coords[0];
      const last = coords[coords.length - 1];
      const key = `${Math.round(r.distance)}|${coords.length}|${first[0].toFixed(5)},${first[1].toFixed(5)}|${last[0].toFixed(5)},${last[1].toFixed(5)}`;

      if (seen.has(key)) continue;
      seen.add(key);
      final5.push(r);
      if (final5.length >= 5) break;
    }

    final5.forEach((r, i) => (r.index = i));

    // ====== BOOST/REMAP theo rule của bạn (và FIX case <50 không bị all=50) ======
    const round2 = (x) => Math.round(x * 100) / 100;

    const rawScores = final5.map((r) => {
      const v = parseFloat(r.luckyPoint);
      return Number.isFinite(v) ? v : 0;
    });
    const maxRaw = rawScores.length ? Math.max(...rawScores) : 0;

    let factor = 1;
    let addAll = 0;

    if (maxRaw > 80) factor = 1;
    else if (maxRaw >= 70) factor = maxRaw > 0 ? (maxRaw + 15) / maxRaw : 1;
    else if (maxRaw >= 60) factor = maxRaw > 0 ? (maxRaw + 25) / maxRaw : 1;
    else if (maxRaw >= 50) factor = maxRaw > 0 ? (maxRaw + 35) / maxRaw : 1;
    else addAll = 50; // dưới 50: "giá trị thật" +50

    final5.forEach((r) => {
      const base = Number.isFinite(parseFloat(r.luckyPoint)) ? parseFloat(r.luckyPoint) : 0;

      let rawTrue = base;
      if (addAll > 0) rawTrue = base + addAll;
      else if (factor !== 1) rawTrue = base * factor;

      rawTrue = Math.max(0, Math.min(100, rawTrue));

      r.luckyPointBase = round2(base);     // debug: điểm trước chỉnh
      r.luckyPointRaw = round2(rawTrue);   // debug: "giá trị thật" sau chỉnh
      r.luckyPoint = round2(rawTrue);      // UI hiển thị (2 số)
    });

    res.json({
      birthYear,
      nineQi,
      center,
      riskDirections: riskDirs,
      routes: final5,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

// =======================
app.listen(3000, () => {
  console.log("Server running http://localhost:3000");
});
