window.APP_CONFIG = {
  overpass: {
    timeoutSeconds: 35,
    cacheSeconds: 60,
    cacheName: "cv-multivalue-overpass-v1",
    instances: [
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.private.coffee/api/interpreter"
    ],
    queries: {
      name: '[out:json][timeout:{timeout}][maxsize:128Mi];rel(349043);map_to_area->.sa;(nwr[leisure][name~"/"](area.sa);nwr[highway][!"name:left"][!"name:right"][!public_transport][name~"/"](area.sa););out qt tags center;',
      official: '[out:json][timeout:{timeout}][maxsize:128Mi];rel(349043);map_to_area->.sa;(nwr[leisure][official_name~"/"](area.sa);nwr[highway][!"name:left"][!"name:right"][!public_transport][official_name~"/"](area.sa););out qt tags center;'
    },
    objectQueries: {
      name: '[out:xml][timeout:{timeout}];nwr["name"="{name}"]["name:ca"="{ca}"]["name:es"="{es}"];(._;>;);out meta;',
      official: '[out:xml][timeout:{timeout}];nwr["official_name"="{officialName}"]["name"="{name}"]["name:ca"="{ca}"]["name:es"="{es}"];(._;>;);out meta;'
    }
  },
  map: {
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    language: "ca",
    center: [-0.4, 38.3],
    zoom: 8,
    minZoom: 5,
    maxZoom: 19,
    localizableSourceLayers: [
      "aerodrome_label",
      "mountain_peak",
      "park",
      "place",
      "poi",
      "transportation_name",
      "water_name",
      "waterway"
    ]
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
