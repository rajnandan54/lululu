/**
 * Extracts a YouTube video ID from a URL, or returns null.
 * @param {URL} url
 */
export function getYouTubeId(url) {
  if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)) return null;
  if (url.searchParams.has('v')) return url.searchParams.get('v');
  const [, type, id] = url.pathname.split('/');
  return ['embed', 'shorts', 'live'].includes(type) ? id : null;
}

/**
 * Builds a privacy-enhanced YouTube iframe. Autoplay without a user click must stay muted.
 * @param {string} id
 * @param {{ autoplay?: boolean, muted?: boolean, loop?: boolean, title?: string }} options
 */
export function buildYouTube(id, {
  autoplay = false, muted = autoplay, loop = autoplay, title,
} = {}) {
  const params = new URLSearchParams({
    rel: '0',
    playsinline: '1',
    ...(autoplay && { autoplay: '1' }),
    ...(muted && { mute: '1' }),
    ...(loop && { loop: '1', playlist: id }),
  });
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
  iframe.title = title || 'YouTube video';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  return iframe;
}
