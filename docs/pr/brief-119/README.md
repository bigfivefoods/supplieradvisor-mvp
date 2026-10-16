# Brief 119

Download counts from `GET /catalogues/[id]/download` are Vercel Web Analytics event totals for `catalogue_download`. They are not unique visitors. The server-side `track` call has no visitor identity.

The redirect sends `Cache-Control: no-store`, so a repeat GET runs the route again and can be counted. Unknown ids return `404` with `no-store`. Other methods are the framework `405`.

Screenshots are quantized PNGs of the home Catalogues section, `/catalogues`, and the ConstructionAdvisor® command, at 1280, 768, and 375. `overflow.txt` records that each of those views fit the viewport.

Focus crops, also quantized: `trade-focus-cyan-header.png` is the TradeAdvisor® header with the dark theme on. The header stays cyan and the catalogue control uses a navy ring. `overview-focus-medical.png` and `overview-focus-gym.png` are the gradient headers with a white ring. `fleet-card-768.png` is the FleetAdvisor® card beside CropAdvisor® at 768.
