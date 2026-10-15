<div align="center">
  <img src="logo.png" alt="Logotip de Comunitat Valenciana Multivalue ca / es" width="195">

  <h1>Comunitat Valenciana Multivalue ca / es</h1>

  <p>Visor per revisar noms multivalor en català i castellà a OpenStreetMap.</p>

  <p>
    <a href="https://atarom.github.io/ComunitatValencianaMultivalueOSM/">
      <strong>Obrir l'aplicació ↗</strong>
    </a>
  </p>
</div>

---

Permet analitzar els camps `name`, `official_name`, `name:ca` i `name:es` d'elements d'OpenStreetMap a la Comunitat Valenciana, detectar possibles incoherències i localitzar els elements sobre el mapa per revisar-los o editar-los.

## Tecnologies i dades

- [OpenLayers](https://openlayers.org/) — visualització WebGL dels elements, filtres i interacció cartogràfica.
- [OpenStreetMap](https://www.openstreetmap.org/) — mapa base en estil fosc, sense clau API.
- [Postpass](https://postpass.geofabrik.de/) — consultes SQL dels elements d’OpenStreetMap que s’han de revisar.
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) — recuperació dels elements complets per a JOSM i revisió a Overpass Turbo.
- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) — dades cartogràfiques disponibles sota llicència ODbL.
