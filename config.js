window.APP_CONFIG = {
  postpass: {
    endpoint: "https://postpass.geofabrik.de/api/interpreter",
    timeoutSeconds: 120,
    etaSeconds: 35,
    cacheSeconds: 180,
    cacheName: "cv-multivalue-postpass-v1",
    queries: {
      name: `WITH region AS (
SELECT geom
FROM postpass_polygon
WHERE osm_type = 'R' AND osm_id = 349043
)
SELECT DISTINCT ON (e.osm_type, e.osm_id)
e.osm_type, e.osm_id, e.tags, ST_Centroid(ST_Envelope(e.geom)) AS geom
FROM postpass_pointlinepolygon e
JOIN region r ON e.geom && r.geom AND ST_Intersects(e.geom, r.geom)
WHERE e.geom && ST_MakeEnvelope(-2.5, 37, 2, 42, 4326)
AND (e.tags->>'name' LIKE '%/%' OR e.tags->>'name' LIKE '%;%')
AND (
e.tags ? 'leisure'
OR (
e.tags ? 'highway'
AND NOT (e.tags ? 'name:left')
AND NOT (e.tags ? 'name:right')
AND NOT (e.tags ? 'public_transport')
)
)
ORDER BY e.osm_type, e.osm_id`,
      official: `WITH region AS (
SELECT geom
FROM postpass_polygon
WHERE osm_type = 'R' AND osm_id = 349043
)
SELECT DISTINCT ON (e.osm_type, e.osm_id)
e.osm_type, e.osm_id, e.tags, ST_Centroid(ST_Envelope(e.geom)) AS geom
FROM postpass_pointlinepolygon e
JOIN region r ON e.geom && r.geom AND ST_Intersects(e.geom, r.geom)
WHERE e.geom && ST_MakeEnvelope(-2.5, 37, 2, 42, 4326)
AND (e.tags->>'official_name' LIKE '%/%' OR e.tags->>'official_name' LIKE '%;%')
AND (
e.tags ? 'leisure'
OR (
e.tags ? 'highway'
AND NOT (e.tags ? 'name:left')
AND NOT (e.tags ? 'name:right')
AND NOT (e.tags ? 'public_transport')
)
)
ORDER BY e.osm_type, e.osm_id`
    }
  },
  overpass: {
    timeoutSeconds: 35,
    instance: "https://overpass-api.de/api/interpreter",
    objectQueries: {
      name: '[out:xml][timeout:{timeout}];nwr["name"="{name}"]["name:ca"="{ca}"]["name:es"="{es}"];(._;>;);out meta;',
      official: '[out:xml][timeout:{timeout}];nwr["official_name"="{officialName}"]["name"="{name}"]["name:ca"="{ca}"]["name:es"="{es}"];(._;>;);out meta;'
    }
  },
  map: {
    center: [-0.4, 38.3],
    zoom: 8,
    minZoom: 5,
    maxZoom: 19
  },
  exceptions: {
    name: [
      "Camp de Futbol/Beisbol Rabassa",
      "carretera La Romana - Monóvar/Pinoso",
      "Carretera La Romana - Monóvar/Pinoso",
      "Circuito de Motocross de Alicante/Alacant-El Cementerio",
      "Studio One / Box Alcazar",
      "Carretera Sagunto/Sagunt a Burgos",
      "Tomás Pardo Vidal / Rugby Club Alzira",
      "C/ Alacant - C/ Sogorb"
    ],
    official: [
      "Carrer Nou / Carrer de les Escoles",
      "Rambla de Méndez Núñez / Rambla de Méndez Núñez",
      "Glorieta Locutor Pepe Mira Galiana / Glorieta Locutor Pepe Mira Galiana"
    ]
  },
  testerSamples: {
    name: {
      base: "Carrer Nou / Calle Nueva",
      ca: "Carrer Nou",
      es: "Calle Nueva"
    },
    official: {
      base: "Carrer Nou / Calle Nueva",
      name: "Carrer Nou",
      ca: "Carrer Nou",
      es: "Calle Nueva"
    }
  }
};
