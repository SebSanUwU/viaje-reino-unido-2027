# Viaje a Gran Bretaña, marzo 2027

Static trip page (Spanish): itinerary day by day, route map, budget and booking checklist for London, York and Edinburgh, 1-13 March 2027. Source: private planning notes.

Files: `index.html`, `styles.css`, `app.js`, `data/routes.json` (stops and routes for the map), `img/` (WebP photos plus `credits.json`).

## Run locally

```
python3 -m http.server 8765
```

Then open http://localhost:8765. The map needs the page served over HTTP because it fetches `data/routes.json`.

## Publish

The site is plain static files: serve the folder root from GitHub Pages (branch `main`, path `/`). The page is not indexed (`noindex` meta and `robots.txt`).

## Notes

- Only external resources: Google Fonts, Leaflet 1.9.4 (cdnjs, with SRI) and OpenStreetMap map tiles.
- Photo credits are listed in the page footer and in `img/credits.json`.
