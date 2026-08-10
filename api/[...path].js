// Vercel Edge Function: proxies + edge-caches files from an Internet Archive item.
// Deploy this on Vercel's free Hobby plan (no card required).
//
// Once deployed, e.g. at https://your-project.vercel.app/, requests to:
//   https://your-project.vercel.app/api/video.mp4
// are proxied from:
//   https://archive.org/download/MediaPlayerFiles/video.mp4
// and cached at Vercel's edge for repeat visitors.

export const config = { runtime: "edge" };

const ARCHIVE_ITEM = "MediaPlayerFiles"; // <-- change to your Internet Archive identifier

export default async function handler(request) {
  const url = new URL(request.url);

  // Strip the "/api/" prefix Vercel routes this function under, and use
  // whatever's left as the filename inside the Internet Archive item.
  const filePath = url.pathname
    .replace(/^\/api\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const originURL = `https://archive.org/download/${ARCHIVE_ITEM}/${filePath}`;

  const range = request.headers.get("range");
  const originResponse = await fetch(originURL, {
    headers: {
      ...(range ? { Range: range } : {}),
      // Archive.org's edge rejects bare/bot-like requests missing these —
      // a plain server-side fetch() doesn't send them by default.
      "User-Agent": "Mozilla/5.0 (compatible; MediaVaultProxy/1.0; +https://vercel.com)",
      "Accept": "*/*",
    },
    redirect: "follow",
  });

  const headers = new Headers(originResponse.headers);
  headers.set("Access-Control-Allow-Origin", "*"); // so your GitHub Pages site can load it
  headers.set("Accept-Ranges", "bytes");
  // Cache-Control tells Vercel's edge network to actually cache this response
  // (s-maxage governs the shared/edge cache; max-age governs the visitor's browser)
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");

  if (!originResponse.ok && originResponse.status !== 206) {
    headers.set("X-Proxy-Attempted-URL", originURL); // shows up in browser dev tools -> Network -> Headers if something fails
  }

  return new Response(originResponse.body, {
    status: originResponse.status,
    headers,
  });
}
