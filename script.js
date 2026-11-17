import { validate } from "./validation.js";
(async () => {
  const loadOpenLayers = async () => {
    if (window.ol?.layer?.WebGLVector) return window.ol;
    for (const url of ["https://cdn.jsdelivr.net/npm/ol@10.11.0/dist/ol.js", "https://unpkg.com/ol@10.11.0/dist/ol.js"]) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = url;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        if (window.ol?.layer?.WebGLVector) return window.ol;
      } catch (e) {}
    }
    throw Error("No s'ha pogut carregar OpenLayers");
  };
  const ol = await loadOpenLayers();
  const config = window.APP_CONFIG || {};
  let m,
    popup,
    popupElement,
    popupContent,
    vectorSource,
    vectorLayer,
    mode = "",
    boot = false,
    loadSeq = 0,
    loadCtrl = null,
    overlayTimer = 0,
    cooldownTicker = 0;
  const cooldownUntil = { name: 0, official: 0 };
  const $ = (id) => document.getElementById(id);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const records = new Map();
  const CAT = Object.fromEntries([
    ["cY", "yellow", "#f6e35b", "PredLingCA", "Yellow"],
    ["cR", "red", "#ff5959", "PredLingES", "Red"],
    ["cP", "#8e44ad", "#b07bd6", "NoCoincident", "Purple"],
    ["cB", "#8b4513", "#c16e2a", "Falta :ca/:es", "Brown"],
    ["cO", "#FFD580", "#ffd08a", "Separador no estàndard", "Orange"],
    ["cM", "#4dd0e1", "#4dd0e1", "Més d'un separador", "Cyan"],
    ["cD", "#ff5bd6", "#ff5bd6", "Duplicat", "Pink"]
  ].map(([key, color, test, label, name]) => [key, {
    color, test, label, count: `count${name}`, toggle: `toggle${name}`
  }]));
  const testId = (tm, key) => `t_${tm === "official" ? "off" : "name"}_${key}`;
  const baseKey = () => (mode === "official" ? "official_name" : "name");
  const value = (t) => t?.[baseKey()] || "";
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
  const renderTemplate = (template, values) =>
    `${template || ""}`.replace(/\{(\w+)\}/g, (_, key) => `${values[key] ?? ""}`);
  const timeoutSeconds = () =>
    Math.max(1, Number(config.overpass?.timeoutSeconds) || 35);
  const makeQuery = (tm) => config.postpass?.queries?.[tm] || "";
  const postpassTimeout = () =>
    Math.max(1, Number(config.postpass?.timeoutSeconds) || 120);
  const postpassETA = () =>
    Math.max(1, Number(config.postpass?.etaSeconds) || 35);
  const cacheTTL = () =>
    Math.max(0, Number(config.postpass?.cacheSeconds) || 180);
  const exceptions = () => config.exceptions?.[mode] || [];
  const coords = (o) => {
    const c = o?.center || o || {};
    return { x: Number(c.lon), y: Number(c.lat) };
  };
  const validCoord = (c) => Number.isFinite(c.x) && Number.isFinite(c.y);
  const uid = (o) => `${o.type}/${o.id}`;
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
    const deadline = Date.now() + seconds * 1000;
    let id = 0;
    const paint = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      $("ovTitle").textContent = remaining
        ? `Carregant... ${remaining}s`
        : "Esperant resposta de Postpass…";
      if (!remaining && id) clearInterval(id);
    };
    paint();
    id = setInterval(paint, 1000);
    return () => clearInterval(id);
  };
  const cooldownRemaining = (tm) =>
    Math.max(0, Math.ceil((cooldownUntil[tm] - Date.now()) / 1000));
  const refreshCooldownUI = () => {
    $$("#modeBar .modeOpt").forEach((label) => {
      const tm = label.querySelector("input").value,
        remaining = cooldownRemaining(tm),
        badge = label.querySelector(".cooldownTime");
      label.classList.toggle("cooling", remaining > 0);
      if (mode === tm)
        label.querySelector("span").firstChild.textContent = `${remaining ? "En memòria cau" : "Tornar a processar"} · ${tm === "official" ? "official_name" : "name"}`;
      if (remaining) {
        label.style.setProperty(
          "--cooldown-progress",
          Math.min(1, (cooldownUntil[tm] - Date.now()) / (cacheTTL() * 1000))
        );
        badge.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
        label.title = `Dades en memòria cau · ${remaining}s per a tornar a consultar Postpass`;
      } else {
        badge.textContent = "";
        label.style.removeProperty("--cooldown-progress");
        label.removeAttribute("title");
      }
    });
    if (!cooldownRemaining("name") && !cooldownRemaining("official") && cooldownTicker) {
      clearInterval(cooldownTicker);
      cooldownTicker = 0;
    }
  };
  const setCooldown = (tm, expiresAt) => {
    cooldownUntil[tm] = Math.max(cooldownUntil[tm], expiresAt);
    if (!cooldownTicker) cooldownTicker = setInterval(refreshCooldownUI, 1000);
    refreshCooldownUI();
  };
  const modeUI = () => {
    $("app").dataset.mode = mode || "await";
    $$(".hKey").forEach((x) => (x.textContent = baseKey()));
    if (mode)
      $("exceptionsBody").innerHTML = `<h2>Excepcions · ${esc(baseKey())} multivalor</h2><ul>${exceptions().map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    $("modeHint").style.display = mode ? "none" : "block";
    $$("#modeBar .modeOpt").forEach((l) => {
      const i = l.querySelector("input"),
        s = l.querySelector("span"),
        k = i.value === "official" ? "official_name" : "name";
      const title = !mode ? `Mode ${k} multivalor` : `${i.value === mode ? "Tornar a processar" : "Canviar a"} · ${k}`;
      s.innerHTML = `${title}<small class="cooldownTime" aria-hidden="true"></small>`;
    });
    refreshCooldownUI();
  };
  const formatMultivalue = (s) => `${s ?? ""}`.split(/ \/ |;/).map(esc).join("<br>");
  const formatBase = (result, ca, es) => {
    const piece = (text) => {
      const s = text.trim();
      return s ? `<span class="${s === ca || s === es ? "match" : "nomatch"}">${esc(s)}</span>` : "";
    };
    let html = "", from = 0;
    for (const { index, char, valid } of result.separators) {
      html += piece(result.base.slice(from, index)) + (valid ? "<br>" : `<span class="errorSlash">${esc(char)}</span>`);
      from = index + 1;
    }
    return html + piece(result.base.slice(from));
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
      title = esc(t[baseKey()] || t.name || t.official_name || ""),
      rows = Object.entries(t)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([k, v]) =>
            `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`
        )
        .join(""),
      raw = queryObject(e);
    return `<div class="pop"><div class="pt">${title}</div><div class="ptags">${rows}</div><div class="pact">${link(`https://www.osm.org/${e.type}/${e.id}`, "👁️ Veure")}${link(`https://www.osm.org/edit?${e.type}=${e.id}`, "✏️ Editar")}${link("#", "🧩 JOSM", "josmOne", "o", `${e.type}${e.id}`)}${link("#", "🧩 JOSM tot", "josmAll", "id", uid(e))}${link(`https://overpass-turbo.eu/?Q=${encodeURIComponent(raw)}&R&c`, "🧪 Overpass")}</div></div>`;
  };
  const josm = (o) => fetch(`http://127.0.0.1:8111/load_object?objects=${o}`);
  const josmAll = (key) => {
    const chosen = records.get(key);
    if (!chosen) return;
    const tags = mode === "official" ? ["official_name", "name", "name:ca", "name:es"] : ["name", "name:ca", "name:es"];
    const objects = [...records.values()]
      .filter((o) => tags.every((tag) => o.tags?.[tag] === chosen.tags?.[tag]))
      .map((o) => `${o.type}${o.id}`)
      .join(",");
    return josm(objects);
  };
  const makeLegend = () => {
    const root = document.createElement("div"),
      pane = document.createElement("div"),
      filters = $("filters");
    root.className = "ol-unselectable ol-control legendCtl";
    pane.className = "legendPane";
    const toggle = document.createElement("button");
    Object.assign(toggle, { type: "button", className: "legendToggle", textContent: "Capes" });
    toggle.setAttribute("aria-controls", "filters");
    toggle.setAttribute("aria-expanded", "false");
    toggle.onclick = () => {
      const open = root.classList.toggle("expanded");
      toggle.setAttribute("aria-expanded", String(open));
    };
    window.matchMedia("(max-width: 700px), (max-height: 520px) and (max-width: 960px)").addEventListener("change", () => {
      root.classList.remove("expanded");
      toggle.setAttribute("aria-expanded", "false");
    });
    root.append(toggle, pane);
    filters.classList.add("legendItems");
    filters.style.display = "flex";
    $$("#filters label").forEach((l) => {
      const input = l.querySelector("input"),
        dot = l.querySelector(".dot"),
        count = l.querySelector('span[id^="count"]'),
        textNodes = [...l.childNodes].filter((n) => n.nodeType === 3),
        text = textNodes.map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim(),
        label = l.querySelector(".ltxt") || Object.assign(document.createElement("span"), { className: "ltxt" });
      textNodes.forEach((n) => n.remove());
      label.textContent = text;
      [input, dot, label, count]
        .filter(Boolean)
        .forEach((x) => l.appendChild(x));
    });
    pane.appendChild(filters);
    ["pointerdown", "mousedown", "dblclick", "wheel"].forEach((type) =>
      root.addEventListener(
        type,
        (e) => e.stopPropagation(),
        type === "wheel" ? { passive: true } : undefined
      )
    );
    return root;
  };
  const setEmpty = (box, on) => {
    const msg = box.querySelector(".emptyMsg"), list = box.querySelector("ul");
    if (msg) msg.style.display = on ? "block" : "none";
    if (list) list.style.display = on ? "none" : "block";
  };
  const closePopup = () => {
    popup?.setPosition(undefined);
    if (popupElement) popupElement.hidden = true;
  };
  const clear = () => {
    if (!boot) return;
    vectorSource?.clear(true);
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
      `${location.origin}${location.pathname}?postpass-cache=${encodeURIComponent(`${tm}-${cacheHash(q)}`)}`
    );
  const openCache = () => {
    if (!("caches" in window)) throw Error("Cache Storage no està disponible");
    return caches.open(config.postpass?.cacheName || "cv-multivalue-postpass-v1");
  };
  const cacheGet = async (tm, q) => {
    const ttl = cacheTTL();
    if (!ttl) return null;
    const cache = await openCache();
    const request = cacheRequest(tm, q);
    const response = await cache.match(request);
    if (!response) return null;
    const payload = await response.json();
    const age = Date.now() - Number(payload.timestamp || 0);
    if (!payload.data || age >= ttl * 1000) {
      await cache.delete(request);
      return null;
    }
    return { data: payload.data, ageSeconds: Math.floor(age / 1000), expiresAt: Number(payload.timestamp) + ttl * 1000 };
  };
  const cacheSet = async (tm, q, data) => {
    const cache = await openCache();
    const timestamp = Date.now();
    await cache.put(
      cacheRequest(tm, q),
      new Response(JSON.stringify({ timestamp, data }), {
        headers: { "Content-Type": "application/json" }
      })
    );
    return timestamp + cacheTTL() * 1000;
  };
  const postpassFetch = async (q, signal) => {
    const ctrl = new AbortController(),
      abort = () => ctrl.abort(),
      timeout = setTimeout(abort, postpassTimeout() * 1000);
    if (signal?.aborted) ctrl.abort();
    else signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetch(config.postpass.endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: q }),
        signal: ctrl.signal
      });
      if (!response.ok) {
        const message = await response.text();
        throw Error(`Postpass HTTP ${response.status}: ${message.slice(0, 250)}`);
      }
      const data = await response.json();
      if (data?.type !== "FeatureCollection" || !Array.isArray(data.features))
        throw Error("Postpass: resposta GeoJSON no vàlida");
      const elements = data.features.map((feature) => {
        const p = feature.properties || {},
          c = feature.geometry?.coordinates,
          type = { N: "node", W: "way", R: "relation" }[p.osm_type];
        const id = Number(p.osm_id);
        if (!type || !Number.isSafeInteger(id) || id <= 0 || feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2)
          throw Error("Postpass: element sense identificador o geometria vàlids");
        const lon = Number(c[0]),
          lat = Number(c[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || !p.tags || typeof p.tags !== "object" || Array.isArray(p.tags))
          throw Error("Postpass: element sense coordenades o etiquetes vàlides");
        return { type, id, tags: p.tags, lon, lat };
      });
      return { elements };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  };
  const postpassCached = async (tm, q, signal) => {
    try {
      const cached = await cacheGet(tm, q);
      if (cached) {
        setCooldown(tm, cached.expiresAt);
        showOverlay(
          "Memòria cau",
          `✓ Dades locals de fa ${cached.ageSeconds}s · no es consulta Postpass`
        );
        return cached.data;
      }
    } catch (e) {
      showOverlay(null, `⚠ Memòria cau: ${e?.message || e}`);
    }
    const stop = timer(postpassETA());
    showOverlay("Consultant Postpass…", `→ ${config.postpass.endpoint}`);
    let data;
    try {
      data = await postpassFetch(q, signal);
      showOverlay(null, "✓ OK Postpass");
    } finally {
      stop();
    }
    try {
      setCooldown(tm, await cacheSet(tm, q, data));
    } catch (e) {
      showOverlay(null, `⚠ No s'ha pogut guardar la memòria cau: ${e?.message || e}`);
    }
    return data;
  };
  const testerRun = (tm, base, name, ca, es) => {
    const tags = { "name:ca": ca || "", "name:es": es || "" };
    if (tm === "official") {
      tags.official_name = base || "";
      tags.name = name || "";
    } else tags.name = base || "";
    const result = validate(tags, tm);
    const { base: s, ca: caT, es: esT, separatorCount: sl, badSep: bad, missingTags: missing, duplicate: dup, includes, officialNameOk: exp, key } = result;
    return {
      key,
      preview: s ? formatBase(result, caT || "🚫", esT || "🚫") : "🚫",
      log: [
        `baseKey=${tm === "official" ? "official_name" : "name"}`,
        `base="${s}"`,
        `separators=${sl}${sl > 1 ? " → ERROR(cyan)" : ""}`,
        `badSep=${bad ? 1 : 0}${bad ? " → ERROR(orange)" : ""}`,
        `name:ca="${caT}"`,
        `name:es="${esT}"`,
        `missing(:ca/:es)=${missing ? 1 : 0}${missing ? " → ERROR(brown)" : ""}`,
        `dup(parts)= ${dup ? 1 : 0}${dup ? " → ERROR(pink)" : ""}`,
        `includes(ca,es)=${includes ? 1 : 0}${!missing && !bad && !dup && sl <= 1 && s && !includes ? " → ERROR(purple)" : ""}`,
        tm === "official"
          ? `expNameOk=${exp ? 1 : 0}${!exp ? " → ERROR(purple)" : ""}`
          : 0,
        `group=${CAT[key].label}`
      ].filter(Boolean).join("\n")
    };
  };
  const paintTester = (tm) => {
    const field = (key) => $(testId(tm, key)),
      r = testerRun(tm, field("base").value, tm === "official" ? field("name").value : "", field("ca").value, field("es").value);
    field("badge").innerHTML = `<i style="background:${CAT[r.key].test}"></i>${esc(CAT[r.key].label)}`;
    field("prev").innerHTML = r.preview;
    field("log").textContent = r.log;
  };
  const initTester = () => {
    ["name", "official"].forEach((tm) => {
      const sample = config.testerSamples?.[tm] || {};
      ["base", ...(tm === "official" ? ["name"] : []), "ca", "es"].forEach((key) => {
        const input = $(testId(tm, key));
        input.value = sample[key] || "";
        input.addEventListener("input", () => paintTester(tm));
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
    vectorLayer?.updateStyleVariables({ [`show${k}`]: on ? 1 : 0 });
    if (!on) closePopup();
  };
  const openRecord = (o, fromMap = false) => {
    if (!o) return;
    const c = coords(o);
    if (!validCoord(c) || !popup) return;
    popupContent.innerHTML = popupHtml(o);
    popup.setPositioning(fromMap ? "bottom-center" : "center-center");
    popup.setOffset(fromMap ? [0, -12] : [0, 0]);
    popupElement.style.maxHeight = fromMap ? "" : `${Math.min(420, Math.max(100, m.getTargetElement().clientHeight - 24))}px`;
    popupElement.hidden = false;
    popup.setPosition(ol.proj.fromLonLat([c.x, c.y]));
    if (fromMap) popup.panIntoView({ animation: { duration: 180 }, margin: 16 });
  };
  const addLayers = () => {
    vectorSource = new ol.source.Vector({ wrapX: false });
    const variables = Object.fromEntries(Object.keys(CAT).map((k) => [`show${k}`, $(CAT[k].toggle).checked ? 1 : 0]));
    const styles = Object.entries(CAT).map(([k, c]) => ({
      filter: ["all", ["==", ["get", "key"], k], ["==", ["var", `show${k}`], 1]],
      style: {
        "circle-radius": 6,
        "circle-fill-color": c.color,
        "circle-stroke-color": "#111111",
        "circle-stroke-width": 1.25,
        "circle-opacity": 0.85
      }
    }));
    vectorLayer = new ol.layer.WebGLVector({ source: vectorSource, variables, style: styles });
    m.addLayer(vectorLayer);
    Object.entries(CAT).forEach(([k, c]) => {
      $(c.toggle).onchange = () => setLayer(k, $(c.toggle).checked);
    });
    m.on("singleclick", (event) => {
      const feature = m.forEachFeatureAtPixel(event.pixel, (f, lyr) => lyr === vectorLayer ? f : null, { hitTolerance: 3 });
      const key = feature?.get("key");
      if (!key || !$(CAT[key]?.toggle).checked) {
        closePopup();
        return;
      }
      const o = records.get(feature.get("uid"));
      if (o) openRecord(o, true);
      else closePopup();
    });
    m.on("pointermove", (event) => {
      if (event.dragging) return;
      m.getTargetElement().style.cursor = m.hasFeatureAtPixel(event.pixel, { layerFilter: (lyr) => lyr === vectorLayer }) ? "pointer" : "";
    });
  };
  const addPopup = () => {
    popupElement = document.createElement("div");
    popupElement.className = "cv-ol-popup";
    popupElement.hidden = true;
    const close = document.createElement("button");
    close.className = "cv-ol-close";
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Tancar popup");
    popupContent = document.createElement("div");
    popupContent.className = "cv-ol-content";
    popupElement.append(close, popupContent);
    close.onclick = closePopup;
    popup = new ol.Overlay({ element: popupElement, offset: [0, -12], positioning: "bottom-center", autoPan: false });
    m.addOverlay(popup);
  };
  const webgl2Available = () => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch (e) {
      return false;
    }
  };
  const bindUI = () => {
    [["ex", "infoIcon", "exceptionsClose", "exceptionsModal"], ["test", "testIcon", "testerClose", "testerModal"]].forEach(([key, icon, close, modal]) => {
      $(icon).onclick = () => {
        const data = $("app").dataset;
        if (data[key] === "1") delete data[key];
        else data[key] = "1";
      };
      $(close).onclick = () => delete $("app").dataset[key];
      $(modal).onclick = (e) => {
        if (e.target === $(modal)) delete $("app").dataset[key];
      };
    });
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
      const i = e.target;
      if (i.matches?.('input[name="mode"]') && boot && mode && i.value === mode && !cooldownRemaining(mode))
        load();
    });
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t.classList?.contains("josmAll")) {
        e.preventDefault();
        josmAll(t.dataset.id);
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
      showOverlay("Error", "WebGL2 no està disponible en este navegador o dispositiu.", true);
      return;
    }
    try {
      m = new ol.Map({
        target: "map",
        layers: [new ol.layer.Tile({ className: "dark-base-layer", source: new ol.source.OSM({ referrerPolicy: "strict-origin-when-cross-origin" }) })],
        view: new ol.View({
          center: ol.proj.fromLonLat(config.map?.center || [-0.4, 38.3]),
          zoom: Number(config.map?.zoom) || 8,
          minZoom: Number(config.map?.minZoom) || 5,
          maxZoom: Number(config.map?.maxZoom) || 19
        })
      });
      m.addControl(new ol.control.Control({ element: makeLegend() }));
      addLayers();
      addPopup();
      boot = true;
      requestAnimationFrame(() => m.updateSize());
      load();
    } catch (e) {
      m?.setTarget(undefined);
      m = null;
      boot = false;
      showOverlay("Error", `OpenLayers/WebGL2: ${e?.message || e}`, true);
    }
  };
  const load = async () => {
    if (!mode || !boot) return;
    const run = ++loadSeq;
    loadCtrl?.abort();
    const ctrl = new AbortController();
    loadCtrl = ctrl;
    clear();
    const count = Object.fromEntries(Object.keys(CAT).map((k) => [k, 0]));
    showOverlay("Preparant…", `Mode: ${baseKey()} multivalor`, true);
    try {
      const q = makeQuery(mode);
      if (!q) throw Error(`No hi ha consulta Postpass configurada per a ${mode}`);
      const { elements = [] } = await postpassCached(mode, q, ctrl.signal);
      if (run !== loadSeq || ctrl.signal.aborted) return;
      const blocked = exceptions(),
        reviews = elements.filter((o) => {
          const s = value(o?.tags || {}).trim();
          return s && !blocked.includes(s);
        }).map((o) => ({ record: o, result: validate(o.tags || {}, mode) })),
        features = [];
      reviews.forEach(({ record: o, result }) => {
        const c = coords(o);
        if (!validCoord(c)) return;
        const key = result.key,
          id = uid(o);
        records.set(id, o);
        count[key]++;
        features.push(new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([c.x, c.y])),
          uid: id,
          key
        }));
      });
      if (run !== loadSeq || ctrl.signal.aborted) return;
      vectorSource.addFeatures(features);
      fill(reviews.filter(({ result }) => result.listError), false);
      fill(reviews.filter(({ result }) => result.missingTags), true);
      Object.entries(CAT).forEach(
        ([k, c]) => ($(c.count).textContent = `(${count[k]}) `)
      );
      if (features.length) m.getView().fit(vectorSource.getExtent(), { padding: [40, 40, 40, 40], maxZoom: 17 });
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
    arr.sort((a, b) => a.result.base.localeCompare(b.result.base));
    const box = $(missing ? "missingList" : "list"),
      ul = box.querySelector("ul");
    ul.innerHTML = "";
    setEmpty(box, !arr.length);
    arr.forEach(({ record: o, result }) => {
      const t = o.tags || {},
        ca = t["name:ca"]?.trim() || "🚫",
        es = t["name:es"]?.trim() || "🚫",
        name = (t.name || "").trim() || "🚫",
        li = document.createElement("li"),
        base = result.base ? formatBase(result, ca, es) : "🚫";
      const languageCell = (text) => `<span${missing ? "" : ` class="${result.parts?.includes(text) ? "match" : "nomatch"}"`}>${formatMultivalue(text)}</span>`;
      li.innerHTML = `<span class="colBase">${base}</span><span class="colName ${result.officialNameOk ? "match" : "nomatch"}">${formatMultivalue(name)}</span>${languageCell(ca)}${languageCell(es)}`;
      li.onclick = () => {
        const c = coords(o);
        if (!validCoord(c)) return;
        closePopup();
        const view = m.getView();
        view.cancelAnimations();
        view.setZoom(view.getMaxZoom());
        view.setCenter(ol.proj.fromLonLat([c.x, c.y]));
        openRecord(o);
      };
      ul.appendChild(li);
    });
  };
  const restoreCooldowns = async () => {
    await Promise.all(["name", "official"].map(async (tm) => {
      try {
        const cached = await cacheGet(tm, makeQuery(tm));
        if (cached) setCooldown(tm, cached.expiresAt);
      } catch (e) {}
    }));
  };
  const start = () => {
    modeUI();
    restoreCooldowns();
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
  if (log) log.textContent = `OpenLayers: ${e?.message || e}`;
});
