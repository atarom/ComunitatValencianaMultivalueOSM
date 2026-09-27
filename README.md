<p align="center">
  <img src="logo.png" alt="Logotip de Comunitat Valenciana Multivalue ca / es" width="195">
</p>

<h1 align="center">Comunitat Valenciana Multivalue ca / es</h1>

Visor web per revisar noms multivalor en català i castellà d'elements d'OpenStreetMap a la Comunitat Valenciana. Permet analitzar els camps `name`, `official_name`, `name:ca` i `name:es`, localitzar possibles incoherències i obrir els elements per revisar-los o editar-los.

## Web

[Obrir l'aplicació a GitHub Pages](https://atarom.github.io/ComunitatValencianaMultivalueOSM/)

## Dependències

- [MapLibre GL JS](https://maplibre.org/) 6.11.1 per al mapa interactiu.
- [OpenFreeMap](https://openfreemap.org/) per al mapa base vectorial, amb etiquetes que prioritzen `name:ca` i utilitzen `name` com a alternativa.
- [OpenStreetMap](https://www.openstreetmap.org/) com a font de dades cartogràfiques.
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) per consultar els elements d'OpenStreetMap que s'han de revisar.
