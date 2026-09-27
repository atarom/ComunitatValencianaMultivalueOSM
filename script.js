(async () => {
  const maplibregl =
    await import("https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.mjs");
  const config = window.APP_CONFIG || {};
  let m,
    popup,
    mode = "",
    boot = false,
    op = [],
    opIndex = 0,
    opUrl = "",
    samples = null,
    loadSeq = 0,
    loadCtrl = null,
    overlayTimer = 0;
  const ex = { name: [], official: [] };
  const $ = (id) => document.getElementById(id);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const SRC = "review-points";
  const records = new Map();
  const CAT = {
    cY: {
      color: "yellow",
      test: "#f6e35b",
      label: "PredLingCA",
      count: "countYellow",
      toggle: "toggleYellow"
    },
    cR: {
      color: "red",
      test: "#ff5959",
      label: "PredLingES",
      count: "countRed",
      toggle: "toggleRed"
    },
    cP: {
      color: "#8e44ad",
      test: "#b07bd6",
      label: "NoCoincident",
      count: "countPurple",
      toggle: "togglePurple"
    },
    cB: {
      color: "#8b4513",
      test: "#c16e2a",
      label: "Falta :ca/:es",
      count: "countBrown",
      toggle: "toggleBrown"
    },
    cO: {
      color: "#FFD580",
      test: "#ffd08a",
      label: '"_/_" No estàndard',
      count: "countOrange",
      toggle: "toggleOrange"
    },
    cM: {
      color: "#4dd0e1",
      test: "#4dd0e1",
      label: 'Més d\'un "/"',
      count: "countCyan",
      toggle: "toggleCyan"
    },
    cD: {
      color: "#ff5bd6",
      test: "#ff5bd6",
      label: "Duplicat",
      count: "countPink",
      toggle: "togglePink"
    }
  };
  const TEST = {
    name: {
      base: "t_name_base",
      ca: "t_name_ca",
      es: "t_name_es",
      badge: "t_name_badge",
      prev: "t_name_prev",
      log: "t_name_log"
    },
    official: {
      base: "t_off_base",
      name: "t_off_name",
      ca: "t_off_ca",
      es: "t_off_es",
      badge: "t_off_badge",
      prev: "t_off_prev",
      log: "t_off_log"
    }
  };
  const baseKey = () => (mode === "official" ? "official_name" : "name");
  const value = (t) => t?.[baseKey()] || "";
  const parts = (s) =>
    `${s ?? ""}`
      .split("/")
      .map((x) => x.trim())
      .filter(Boolean);
  const slashCount = (s) => (`${s ?? ""}`.match(/\//g) || []).length;
  const esc = (s) =>
    `${s ?? ""}`.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[c]
    );
  const oq = (s) =>
    `${s ?? ""}`
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
  const badSep = (s) =>
    [...s].some(
      (c, i) =>
        c === "/" &&
        (!i ||
          i === s.length - 1 ||
          s[i - 1] !== " " ||
          s[i + 1] !== " " ||
          s[i - 2] === " " ||
          s[i + 2] === " ")
    );
  const renderTemplate = (template, values) =>
    `${template || ""}`.replace(/\{(\w+)\}/g, (_, key) => `${values[key] ?? ""}`);
  const timeoutSeconds = () =>
    Math.max(1, Number(config.overpass?.timeoutSeconds) || 35);
  const makeQuery = (tm) =>
    renderTemplate(config.overpass?.queries?.[tm], {
      timeout: timeoutSeconds()
    });
  const exceptions = () => ex[mode] || [];
  const coords = (o) => {
    const c = o?.center || o || {};
    return { x: Number(c.lon), y: Number(c.lat) };
  };
  const validCoord = (c) => Number.isFinite(c.x) && Number.isFinite(c.y);
  const uid = (o) => `${o.type}/${o.id}`;
  const layer = (k) => `review-${k}`;
  const cancelOverlayTimer = () => {
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = 0;
    }
  };
  const showOverlay = (title, line, clear) => {
    cancelOverlayTimer();
    $("overlay").style.display = "flex";
    if (title != null) $("ovTitle").textContent = title;
    if (clear) $("ovLog").textContent = "";
    if (line)
      $("ovLog").textContent += ($("ovLog").textContent ? "\n" : "") + line;
  };
  const hideOverlay = () => {
    cancelOverlayTimer();
    overlayTimer = setTimeout(() => {
      $("overlay").style.display = "none";
      overlayTimer = 0;
    }, 1500);
  };
  const timer = (seconds) => {
    let s = Math.max(0, Math.ceil(seconds));
    const paint = () => ($("ovTitle").textContent = `Carregant... ${s}s`);
    paint();
    const id = setInterval(() => {
      s--;
      if (s < 0) clearInterval(id);
      else paint();
    }, 1000);
    return () => clearInterval(id);
  };
  const modeUI = () => {
    $("app").dataset.mode = mode || "await";
    $$(".hKey").forEach((x) => (x.textContent = baseKey()));
    if (mode)
      $("exceptionsBody").innerHTML =
        `<h2>Excepcions · ${esc(mode === "official" ? "official_name multivalor" : "name multivalor")}</h2><ul>${exceptions()
          .map((x) => `<li>${esc(x)}</li>`)
          .join("")}</ul>`;
    $("modeHint").style.display = mode ? "none" : "block";
    $$("#modeBar .modeOpt").forEach((l) => {
      const i = l.querySelector("input"),
        s = l.querySelector("span"),
        k = i.value === "official" ? "official_name" : "name";
      s.textContent = !mode
        ? `Mode ${k} multivalor`
        : i.value === mode
          ? `Tornar a processar · ${k}`
          : `Canviar a · ${k}`;
    });
  };
  const formatBase = (n, ca, es) => {
    let html = "",
      text = "";
    [...n].forEach((ch, i) => {
      if (ch !== "/") {
        text += ch;
        return;
      }
      const s = text.trim();
      if (s)
        html += `<span class="${s === ca || s === es ? "match" : "nomatch"}">${esc(s)}</span>`;
      text = "";
      const left = i > 0 && n[i - 1] === " " && (i < 2 || n[i - 2] !== " "),
        right =
          i < n.length - 1 &&
          n[i + 1] === " " &&
          (i + 2 === n.length || n[i + 2] !== " ");
      html += left && right ? " / " : '<span class="errorSlash">/</span>';
    });
    const s = text.trim();
    return (
      html +
      (s
        ? `<span class="${s === ca || s === es ? "match" : "nomatch"}">${esc(s)}</span>`
        : "")
    );
  };
  const officialNameOk = (t) => {
    if (mode !== "official") return true;
    const p = parts(value(t)),
      n = (t.name || "").trim(),
      ca = (t["name:ca"] || "").trim(),
      es = (t["name:es"] || "").trim(),
      first = p[0];
    return !!(
      p.length &&
      n &&
      ((first === ca && n === ca) || (first === es && n === es))
    );
  };
  const category = (t) => {
    const s = value(t);
    if (!s) return "cP";
    if (slashCount(s) > 1) return "cM";
    if (badSep(s)) return "cO";
    if (!t["name:ca"] || !t["name:es"]) return "cB";
    const p = parts(s),
      ca = t["name:ca"].trim(),
      es = t["name:es"].trim();
    if (p.length > 1 && p.every((x) => x === p[0])) return "cD";
    if (!(p.includes(ca) && p.includes(es))) return "cP";
    const first = p[0] === ca ? "ca" : p[0] === es ? "es" : "";
    return !first || (mode === "official" && !officialNameOk(t))
      ? "cP"
      : first === "ca"
        ? "cY"
        : "cR";
  };
  const queryObject = (e) => {
    const t = e.tags || {};
    return renderTemplate(config.overpass?.objectQueries?.[mode], {
      timeout: timeoutSeconds(),
      officialName: oq(t.official_name),
      name: oq(t.name),
      ca: oq(t["name:ca"]),
      es: oq(t["name:es"])
    });
  };
  const link = (href, label, cls, key, val) =>
    cls
      ? `<a href="#" class="${cls}" data-${key}="${val}">${label}</a>`
      : `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
  const popupHtml = (e) => {
    const t = e.tags || {},
      title = esc(
        (mode === "official"
          ? t.official_name || t.name
          : t.name || t.official_name) || ""
      ),
      rows = Object.entries(t)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([k, v]) =>
            `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`
        )
        .join(""),
      raw = queryObject(e),
      q = encodeURIComponent(raw);
    return `<div class="pop"><div class="pt">${title}</div><div class="ptags">${rows}</div><div class="pact">${link(`https://www.osm.org/${e.type}/${e.id}`, "👁️ Veure")}${link(`https://www.osm.org/edit?${e.type}=${e.id}`, "✏️ Editar")}${link("#", "🧩 JOSM", "josmOne", "o", `${e.type}${e.id}`)}${link("#", "🧩 JOSM tot", "josmAll", "q", q)}${link(`https://overpass-turbo.eu/?Q=${encodeURIComponent(raw)}&R&c`, "🧪 Overpass")}</div></div>`;
  };
  const josm = (o) => fetch(`http://127.0.0.1:8111/load_object?objects=${o}`);
  const josmAll = (q) =>
    fetch(
      `http://127.0.0.1:8111/import?url=${encodeURIComponent((opUrl || op[0]) + "?data=" + q)}`
    );
  const makeLegend = () => {
    const root = document.createElement("div"),
      pane = document.createElement("div"),
      filters = $("filters");
    root.className = "maplibregl-ctrl legendCtl";
    pane.className = "legendPane";
    root.appendChild(pane);
    filters.classList.add("legendItems");
    filters.style.display = "flex";
    $$("#filters label").forEach((l) => {
      const input = l.querySelector("input"),
        dot = l.querySelector(".dot"),
        count = l.querySelector('span[id^="count"]'),
        text = [...l.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        label =
          l.querySelector(".ltxt") ||
          Object.assign(document.createElement("span"), { className: "ltxt" });
      [...l.childNodes]
        .filter((n) => n.nodeType === 3)
        .forEach((n) => n.remove());
      label.textContent = text;
      [input, dot, label, count]
        .filter(Boolean)
        .forEach((x) => l.appendChild(x));
    });
    pane.appendChild(filters);
    ["mousedown", "dblclick", "wheel"].forEach((type) =>
      root.addEventListener(
        type,
        (e) => e.stopPropagation(),
        type === "wheel" ? { passive: true } : undefined
      )
    );
    return root;
  };
  class LegendControl {
    onAdd() {
      return (this._container = makeLegend());
    }
    onRemove() {
      this._container?.remove();
      this._container = null;
    }
  }
  const setEmpty = (box, on) => {
    const msg = box.querySelector(".emptyMsg"),
      list = box.querySelector("ul");
    if (msg) msg.style.display = on ? "block" : "none";
    if (list) list.style.display = on ? "none" : "block";
  };
  const closePopup = () => {
    popup?.remove();
    popup = null;
  };
  const clear = () => {
    if (!boot) return;
    m.getSource(SRC)?.setData({ type: "FeatureCollection", features: [] });
    records.clear();
    $$("#list ul,#missingList ul").forEach((u) => (u.innerHTML = ""));
    [$("list"), $("missingList")].forEach((x) => setEmpty(x, false));
    closePopup();
  };
  const cacheHash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  };
  const cacheRequest = (tm, q) =>
    new Request(
      `${location.origin}${location.pathname}?overpass-cache=${encodeURIComponent(`${tm}-${cacheHash(q)}`)}`
    );
  const cacheGet = async (tm, q) => {
    if (!("caches" in window)) throw Error("Cache Storage no està disponible");
    const ttl = Math.max(0, Number(config.overpass?.cacheSeconds) || 60);
    if (!ttl) return null;
    const cache = await caches.open(
      config.overpass?.cacheName || "cv-multivalue-overpass-v1"
    );
    const request = cacheRequest(tm, q);
    const response = await cache.match(request);
    if (!response) return null;
    const payload = await response.json();
    const age = Date.now() - Number(payload.timestamp || 0);
    if (!payload.data || age >= ttl * 1000) {
      await cache.delete(request);
      return null;
    }
    return { data: payload.data, ageSeconds: Math.floor(age / 1000) };
  };
  const cacheSet = async (tm, q, data) => {
    if (!("caches" in window)) throw Error("Cache Storage no està disponible");
    const cache = await caches.open(
      config.overpass?.cacheName || "cv-multivalue-overpass-v1"
    );
    await cache.put(
      cacheRequest(tm, q),
      new Response(JSON.stringify({ timestamp: Date.now(), data }), {
        headers: { "Content-Type": "application/json" }
      })
    );
  };
  const overpassFetch = async (url, q, ms, signal) => {
    const ctrl = new AbortController(),
      abort = () => ctrl.abort(),
      timeout = setTimeout(() => ctrl.abort(), ms);
    if (signal?.aborted) ctrl.abort();
    else signal?.addEventListener("abort", abort, { once: true });
    try {
      const r = await fetch(url + "?data=" + encodeURIComponent(q), {
        signal: ctrl.signal
      });
      if (!r.ok) throw Error("HTTP " + r.status);
      return await r.json();
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  };
  const overpass = async (q, signal) => {
    if (!op.length) throw Error("No hi ha instàncies d'Overpass");
    let last;
    for (let k = 0; k < op.length; k++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const i = (opIndex + k) % op.length,
        url = op[i],
        stop = timer(timeoutSeconds());
      showOverlay("Consultant Overpass…", `→ ${i + 1}/${op.length} ${url}`);
      try {
        const data = await overpassFetch(
          url,
          q,
          timeoutSeconds() * 1000,
          signal
        );
        stop();
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        opIndex = i;
        opUrl = url;
        try {
          localStorage.setItem("opI", opIndex);
        } catch (e) {}
        showOverlay(null, `✓ OK ${url}`);
        return data;
      } catch (e) {
        stop();
        if (signal.aborted) throw e;
        last = e;
        showOverlay(
          null,
          `✖ Error ${url} · ${e?.name === "AbortError" ? "temps excedit" : e?.message || e}`
        );
        showOverlay(null, "↪ Passant a la següent instància…");
      }
    }
    throw last || Error("Overpass: totes les instàncies han fallat");
  };
  const overpassCached = async (tm, q, signal) => {
    try {
      const cached = await cacheGet(tm, q);
      if (cached) {
        showOverlay(
          "Memòria cau",
          `✓ Dades locals de fa ${cached.ageSeconds}s · no es consulta Overpass`
        );
        return cached.data;
      }
    } catch (e) {
      showOverlay(null, `⚠ Memòria cau: ${e?.message || e}`);
    }
    const data = await overpass(q, signal);
    try {
      await cacheSet(tm, q, data);
    } catch (e) {
      showOverlay(null, `⚠ No s'ha pogut guardar la memòria cau: ${e?.message || e}`);
    }
    return data;
  };
  const withMode = (next, fn) => {
    const prev = mode;
    mode = next;
    const out = fn();
    mode = prev;
    return out;
  };
  const testerRun = (tm, base, name, ca, es) => {
    const t = { "name:ca": ca || "", "name:es": es || "" };
    if (tm === "official") {
      t.official_name = base || "";
      t.name = name || "";
    } else t.name = base || "";
    return withMode(tm, () => {
      const s = value(t),
        sl = slashCount(s),
        bad = badSep(s),
        caT = t["name:ca"].trim(),
        esT = t["name:es"].trim(),
        missing = !caT || !esT,
        p = parts(s),
        includes = !!(s && caT && esT && p.includes(caT) && p.includes(esT)),
        dup = !!(
          s &&
          !bad &&
          sl <= 1 &&
          caT &&
          esT &&
          p.length > 1 &&
          p.every((x) => x === p[0])
        ),
        exp = tm !== "official" || officialNameOk(t),
        key = category(t);
      return {
        key,
        preview: s ? formatBase(s, caT || "🚫", esT || "🚫") : "🚫",
        log: [
          `baseKey=${baseKey()}`,
          `base="${s}"`,
          `slashes=${sl}${sl > 1 ? " → ERROR(cyan)" : ""}`,
          `badSep="_/_"=${bad ? 1 : 0}${bad ? " → ERROR(orange)" : ""}`,
          `name:ca="${caT}"`,
          `name:es="${esT}"`,
          `missing(:ca/:es)=${missing ? 1 : 0}${missing ? " → ERROR(brown)" : ""}`,
          `dup(parts)= ${dup ? 1 : 0}${dup ? " → ERROR(pink)" : ""}`,
          `includes(ca,es)=${includes ? 1 : 0}${!missing && !bad && !dup && sl <= 1 && s && !includes ? " → ERROR(purple)" : ""}`,
          tm === "official"
            ? `expNameOk=${exp ? 1 : 0}${!exp ? " → ERROR(purple)" : ""}`
            : 0,
          `group=${CAT[key].label}`
        ]
          .filter(Boolean)
          .join("\n")
      };
    });
  };
  const paintTester = (tm) => {
    const f = TEST[tm],
      r = testerRun(
        tm,
        $(f.base).value,
        f.name ? $(f.name).value : "",
        $(f.ca).value,
        $(f.es).value
      );
    $(f.badge).innerHTML =
      `<i style="background:${CAT[r.key].test}"></i>${esc(CAT[r.key].label)}`;
    $(f.prev).innerHTML = r.preview;
    $(f.log).textContent = r.log;
  };
  const initTester = () => {
    Object.entries(TEST).forEach(([tm, f]) => {
      const s = samples?.[tm] || {};
      Object.entries(f)
        .filter(([k]) => ["base", "name", "ca", "es"].includes(k))
        .forEach(([k, id]) => {
          $(id).value = s[k] || "";
          $(id).addEventListener("input", () => paintTester(tm));
        });
      paintTester(tm);
    });
    $("testerBox").addEventListener("click", (e) => {
      const b = e.target.closest(".tTab");
      if (!b) return;
      const tm = b.dataset.tm;
      $$("#testerBox .tTab").forEach((x) => {
        const on = x.dataset.tm === tm;
        x.classList.toggle("on", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      $$("#testerBox .tPane").forEach((x) =>
        x.classList.toggle("on", x.dataset.tp === tm)
      );
      paintTester(tm);
    });
  };
  const setLayer = (k, on) => {
    const id = layer(k);
    if (m?.getLayer(id))
      m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  const openRecord = (o, lngLat) => {
    if (!o) return;
    const c = coords(o);
    if (!validCoord(c)) return;
    closePopup();
    const p = new maplibregl.Popup({
      maxWidth: "460px",
      closeButton: true,
      closeOnClick: true
    })
      .setLngLat(lngLat || [c.x, c.y])
      .setHTML(popupHtml(o))
      .addTo(m);
    popup = p;
    p.on("close", () => {
      if (popup === p) popup = null;
    });
  };
  const addLayers = () => {
    m.addSource(SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
    Object.entries(CAT).forEach(([k, c]) => {
      const id = layer(k);
      m.addLayer({
        id,
        type: "circle",
        source: SRC,
        filter: ["==", ["get", "key"], k],
        layout: { visibility: $(c.toggle).checked ? "visible" : "none" },
        paint: {
          "circle-radius": 6,
          "circle-color": c.color,
          "circle-stroke-color": "#111",
          "circle-stroke-width": 1.25,
          "circle-opacity": 0.85
        }
      });
      m.on("click", id, (e) => {
        const o = records.get(e.features?.[0]?.properties.uid);
        if (o) openRecord(o, e.lngLat);
      });
      m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
      $(c.toggle).onchange = () => setLayer(k, $(c.toggle).checked);
    });
  };
  const collapseAttribution = () => {
    const el = m?.getContainer().querySelector(".maplibregl-ctrl-attrib");
    if (!el) return;
    el.open = false;
    el.removeAttribute("open");
    el.classList.remove("maplibregl-compact-show");
  };
  const localizeMapLabels = () => {
    const language = config.map?.language || "ca";
    const sourceLayers = new Set(config.map?.localizableSourceLayers || []);
    (m.getStyle()?.layers || []).forEach((l) => {
      const field = l.layout?.["text-field"];
      if (
        l.type !== "symbol" ||
        !field ||
        !sourceLayers.has(l["source-layer"]) ||
        !JSON.stringify(field).includes("name")
      )
        return;
      try {
        m.setLayoutProperty(l.id, "text-field", [
          "coalesce",
          ["get", `name:${language}`],
          ["get", "name"]
        ]);
      } catch (e) {}
    });
  };
  const webgl2Available = () => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch (e) {
      return false;
    }
  };
  const bindUI = () => {
    const toggleData = (id, key) => {
      $(id).onclick = () => {
        const app = $("app");
        if (app.dataset[key] === "1") delete app.dataset[key];
        else app.dataset[key] = "1";
      };
    };
    toggleData("infoIcon", "ex");
    toggleData("testIcon", "test");
    $("exceptionsClose").onclick = () => delete $("app").dataset.ex;
    $("testerClose").onclick = () => delete $("app").dataset.test;
    $("exceptionsModal").onclick = (e) => {
      if (e.target === $("exceptionsModal")) delete $("app").dataset.ex;
    };
    $("testerModal").onclick = (e) => {
      if (e.target === $("testerModal")) delete $("app").dataset.test;
    };
    $("ovClose").onclick = () => {
      cancelOverlayTimer();
      $("overlay").style.display = "none";
    };
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        delete $("app").dataset.test;
        delete $("app").dataset.ex;
        closePopup();
      }
    });
    $("modeBar").addEventListener("click", (e) => {
      const l = e.target.closest(".modeOpt"),
        i = l?.querySelector("input");
      if (l && boot && mode && i?.value === mode) load();
    });
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t.classList?.contains("josmAll")) {
        e.preventDefault();
        josmAll(t.dataset.q);
      } else if (t.classList?.contains("josmOne")) {
        e.preventDefault();
        josm(t.dataset.o);
      }
    });
    document.addEventListener("change", (e) => {
      if (e.target?.name !== "mode") return;
      mode = e.target.value;
      modeUI();
      boot ? load() : init();
    });
  };
  const init = () => {
    if (m) return;
    if (!webgl2Available()) {
      showOverlay(
        "Error",
        "WebGL2 no està disponible en este navegador o dispositiu.",
        true
      );
      return;
    }
    try {
      m = new maplibregl.Map({
        container: "map",
        minZoom: Number(config.map?.minZoom) || 5,
        maxZoom: Number(config.map?.maxZoom) || 19,
        center: config.map?.center || [-0.4, 38.3],
        zoom: Number(config.map?.zoom) || 8,
        attributionControl: false,
        style: config.map?.styleUrl || "https://tiles.openfreemap.org/styles/dark"
      });
    } catch (e) {
      m = null;
      showOverlay("Error", `MapLibre/WebGL2: ${e?.message || e}`, true);
      return;
    }
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-left"
    );
    const attribution = new maplibregl.AttributionControl({ compact: true });
    m.addControl(attribution, "bottom-right");
    collapseAttribution();
    queueMicrotask(collapseAttribution);
    requestAnimationFrame(collapseAttribution);
    m.addControl(new LegendControl(), "top-right");
    m.on("load", () => {
      collapseAttribution();
      localizeMapLabels();
      addLayers();
      boot = true;
      load();
    });
    m.once("idle", collapseAttribution);
  };
  const load = async () => {
    if (!mode || !boot) return;
    const run = ++loadSeq;
    loadCtrl?.abort();
    const ctrl = new AbortController();
    loadCtrl = ctrl;
    clear();
    const count = Object.fromEntries(Object.keys(CAT).map((k) => [k, 0]));
    showOverlay(
      "Preparant…",
      `Mode: ${mode === "official" ? "official_name multivalor" : "name multivalor"}`,
      true
    );
    try {
      const q = makeQuery(mode);
      if (!q) throw Error(`No hi ha consulta Overpass configurada per a ${mode}`);
      const { elements = [] } = await overpassCached(mode, q, ctrl.signal);
      if (run !== loadSeq || ctrl.signal.aborted) return;
      const blocked = exceptions(),
        arr = elements.filter((o) => {
          const s = value(o?.tags || {}).trim();
          return s && !blocked.includes(s);
        }),
        features = [],
        bounds = new maplibregl.LngLatBounds();
      arr.forEach((o) => {
        const c = coords(o);
        if (!validCoord(c)) return;
        const key = category(o.tags || {}),
          id = uid(o);
        records.set(id, o);
        count[key]++;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [c.x, c.y] },
          properties: { uid: id, key }
        });
        bounds.extend([c.x, c.y]);
      });
      if (run !== loadSeq || ctrl.signal.aborted) return;
      m.getSource(SRC).setData({ type: "FeatureCollection", features });
      const errors = arr.filter((o) => {
        const t = o.tags || {},
          s = value(t);
        if (!t["name:ca"] || !t["name:es"]) return false;
        if (!s || slashCount(s) > 1 || badSep(s)) return true;
        const p = parts(s),
          ca = t["name:ca"].trim(),
          es = t["name:es"].trim();
        return (
          (p.length > 1 && p.every((x) => x === p[0])) ||
          !(p.includes(ca) && p.includes(es)) ||
          (mode === "official" && !officialNameOk(t))
        );
      });
      fill(errors, false);
      fill(
        arr.filter((o) => !o.tags["name:ca"] || !o.tags["name:es"]),
        true
      );
      Object.entries(CAT).forEach(
        ([k, c]) => ($(c.count).textContent = `(${count[k]}) `)
      );
      if (features.length) m.fitBounds(bounds, { padding: 40 });
      showOverlay("Completat.");
      hideOverlay();
    } catch (e) {
      if (run !== loadSeq || ctrl.signal.aborted) return;
      showOverlay("Error", `Error: ${e?.message || e}`);
    } finally {
      if (loadCtrl === ctrl) loadCtrl = null;
    }
  };
  const fill = (arr, missing) => {
    arr.sort((a, b) =>
      value(a?.tags || {}).localeCompare(value(b?.tags || {}))
    );
    const box = $(missing ? "missingList" : "list"),
      ul = box.querySelector("ul");
    ul.innerHTML = "";
    setEmpty(box, !arr.length);
    arr.forEach((o) => {
      const t = o.tags || {},
        ca = t["name:ca"]?.trim() || "🚫",
        es = t["name:es"]?.trim() || "🚫",
        s = value(t),
        p = s && parts(s),
        name = (t.name || "").trim() || "🚫",
        nameOk = mode !== "official" || officialNameOk(t),
        li = document.createElement("li"),
        base = s ? formatBase(s, ca, es) : "🚫";
      li.innerHTML = missing
        ? `<span class="colBase">${base}</span><span class="colName ${nameOk ? "match" : "nomatch"}">${esc(name)}</span><span>${esc(ca)}</span><span>${esc(es)}</span>`
        : `<span class="colBase">${base}</span><span class="colName ${nameOk ? "match" : "nomatch"}">${esc(name)}</span><span class="${p?.includes(ca) ? "match" : "nomatch"}">${esc(ca)}</span><span class="${p?.includes(es) ? "match" : "nomatch"}">${esc(es)}</span>`;
      li.onclick = () => {
        const c = coords(o);
        if (!validCoord(c)) return;
        m.jumpTo({ center: [c.x, c.y], zoom: m.getMaxZoom() });
        openRecord(o, [c.x, c.y]);
      };
      ul.appendChild(li);
    });
  };
  const start = () => {
    ex.name = config.exceptions?.name || [];
    ex.official = config.exceptions?.official || [];
    op = config.overpass?.instances || [];
    samples = config.testerSamples || null;
    try {
      const i = parseInt(localStorage.getItem("opI") || 0, 10);
      if (Number.isFinite(i)) opIndex = Math.max(0, Math.min(op.length - 1, i));
    } catch (e) {}
    opUrl = op[opIndex] || op[0] || "";
    modeUI();
    initTester();
    bindUI();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})().catch((e) => {
  const overlay = document.getElementById("overlay"),
    title = document.getElementById("ovTitle"),
    log = document.getElementById("ovLog");
  if (overlay) overlay.style.display = "flex";
  if (title) title.textContent = "Error";
  if (log) log.textContent = `MapLibre: ${e?.message || e}`;
});
