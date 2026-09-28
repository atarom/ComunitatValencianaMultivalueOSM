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

- [MapLibre GL JS](https://maplibre.org/) renderització interactiva del mapa.
- [OpenFreeMap](https://openfreemap.org/) — mapa base vectorial, amb etiquetes que prioritzen `name:ca` i utilitzen `name` com a alternativa.
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) — consulta dels elements d'OpenStreetMap que s'han de revisar.
- © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) — dades cartogràfiques disponibles sota llicència ODbL.
