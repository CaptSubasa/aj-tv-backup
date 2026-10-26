<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Playlists are fetched through the /api/playlist server route (URL safety in src/lib/m3u.ts) to avoid browser CORS and block private targets.
- hls.js is imported dynamically inside the Player effect so it never runs during SSR.
- Playback URL classification and error mapping live in the browser-safe playback module; only explicit HLS URLs use hls.js, and HTTPS pages reject HTTP streams without URL rewriting or proxying, to avoid speculative playback and mixed-content requests.
