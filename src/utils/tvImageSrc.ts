/**
 * tvImageSrc — the scheme-allow-list guard for every <img> URL that came from
 * the server wire (M-TIZEN-39 / review tizen__secnet MINOR-5).
 *
 * WHY: the local TV components bind `item.posterUrl` / `album.albumArtUrl` /
 * `artist.imageUrl` straight into `:src`. phlix-ui's `resolveImageSrc` only
 * normalizes root-relative paths (it passes ABSOLUTE urls through verbatim,
 * by design); nothing on the client-side path ever asked what SCHEME an art
 * URL is allowed to have. On a `file://` widget origin a server-supplied (or
 * CDN-redirected) `http://` art URL leaks the session-adjacent referrer and
 * downgrades the fetch; a hostile/misconfigured paired server could serve
 * `javascript:`-shaped or unexpected-scheme values into a DOM sink. The
 * trust-model answer is a binding-boundary allow-list, not a CSP hope.
 *
 * THE LAW (pure, string-in/string-out):
 *   - empty/nullish in → '' (the caller's `v-if` placeholder path shows);
 *   - root-relative `/…` → prefixed against the media base via the ui's own
 *     resolver (or verbatim when no base is in effect) — always safe: it can
 *     only reach the paired server the user configured;
 *   - `https:` → pass through (CDN art, the normal case);
 *   - `http:` → pass through ONLY when the URL shares the media base's origin
 *     (plain-HTTP LAN servers are the supported product posture — but a
 *     foreign http host is a downgrade + referrer leak, so it goes);
 *   - everything else — protocol-relative, `data:`, `blob:`, `file:`,
 *     `javascript:`, unparseable garbage — → '' (fail closed; note the
 *     deliberate stricter-than-CSP choice: the widget's img-src permits
 *     data:, this binding layer still refuses it — art arrives from servers,
 *     not inline sources).
 *
 * Zero network: pure string logic (routeManifest.gate request-site scan is
 * structurally unaffected).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { resolveImageSrc } from '@phlix/ui';

export function safeTvImageSrc(url: string | null | undefined, base: string): string {
  if (typeof url !== 'string' || url.trim() === '') return '';

  // Root-relative (single leading slash, never //…): the ui resolver owns the
  // prefixing story; the outcome is by construction same-server.
  if (url.startsWith('/') && !url.startsWith('//')) {
    return resolveImageSrc(base, url);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return ''; // relative garbage, protocol-relative '//host/x', anything not a URL
  }

  if (parsed.protocol === 'https:') return url;
  if (parsed.protocol === 'http:') {
    if (base !== '') {
      try {
        return new URL(base).origin === parsed.origin ? url : '';
      } catch {
        return '';
      }
    }
    return '';
  }
  return '';
}
