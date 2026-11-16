# Buddy Radio website

The website for Buddy Radio: AI radio controllers (Overlord GCI, airfield tower and ATIS,
Buddy, and the Paddles Case I landing trainer) for DCS World servers, on SRS, with live
mission data.

A plain static site, no build step:

| Page | File |
|---|---|
| Home | `index.html` |
| Radio guide | `guide.html` |
| Setup | `setup.html` |
| Live map | `map.html` + `assets/map.js` |

## Deploy on Vercel

Import this repository in Vercel and keep the defaults (Framework preset: Other, no build
command, output directory: the repository root). `vercel.json` turns on clean URLs, so
`/guide` serves `guide.html`.

## The live map

`/map` shows a demo mission until it is connected to a Radio Ops PC. Radio Ops serves its
data at `/api/state`; to reach it from this https site it needs an https tunnel
(Cloudflare `cloudflared tunnel --url http://localhost:8080` or `tailscale funnel 8080`)
and, ideally, a `map_key` in `stations.json`. See `/setup#live-map`.

Links of the form `/map?server=https://...&key=...` connect straight away; the browser
then remembers the address.

## Credits

Leaflet (BSD-2-Clause, `assets/leaflet/LEAFLET_LICENSE.txt`), map data © OpenStreetMap
contributors. Fonts: Big Shoulders Display and Public Sans (SIL Open Font License, via
Google Fonts). Not affiliated with Eagle Dynamics or the DCS-SRS project.
