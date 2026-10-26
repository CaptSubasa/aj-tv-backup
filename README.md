# AJ TV Backup

Build and finish a full-stack mobile-first IPTV web app named NusaPlay IPTV for an Indonesian user who does not want to install tools locally. Main goal: read the same public M3U/M3U8 playlist URL used in OTT Navigator, including short URL redirects when the final target is an accessible M3U playlist. Build a secure server-side playlist fetch endpoint (validate http/https only, block localhost/private IP targets, restrict redirects and response size, clear Indonesian errors) so browser CORS does not block playlist fetch. Parse #EXTM3U and #EXTINF entries, show channels with logos, category/group and country, search and filters. Provide multiple playlist sources with add/edit/delete/select and browser persistence; import local M3U file. Internal video player using HLS.js when supported, play/stop, previous/next, and selectable HLS quality levels when available. Responsive polished premium dark UI, Indonesian language, works on Android and laptop. Explain when the provided link is not a direct M3U or uses a proprietary authenticated provider. Do not bypass DRM, paywalls or authentication. Implement a real working app, not a static mockup. After building, verify preview and prepare it for publication.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/08e693de-3b5f-4749-8034-e47cc5d7dfa5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
