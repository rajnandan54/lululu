const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function getYouTubeId(url) {
  if (url.hostname === 'youtu.be') return url.pathname.slice(1);
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)) return null;
  if (url.searchParams.has('v')) return url.searchParams.get('v');
  const [, type, id] = url.pathname.split('/');
  return ['embed', 'shorts', 'live'].includes(type) ? id : null;
}

function buildYouTube(id, autoplay) {
  const params = new URLSearchParams({
    rel: '0',
    playsinline: '1',
    ...(autoplay && {
      autoplay: '1', mute: '1', loop: '1', playlist: id,
    }),
  });
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
  iframe.title = 'YouTube video';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  return iframe;
}

function buildVideo(src, autoplay, poster) {
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'metadata';
  if (poster) video.poster = poster;
  if (autoplay) {
    // muted must be set as a property and attribute for autoplay to be allowed
    video.muted = true;
    video.setAttribute('muted', '');
    video.autoplay = true;
    video.loop = true;
  } else {
    video.controls = true;
  }
  const source = document.createElement('source');
  source.src = src;
  source.type = `video/${src.split('?')[0].split('.').pop() === 'webm' ? 'webm' : 'mp4'}`;
  video.append(source);
  return video;
}

export default function decorate(block) {
  const link = block.querySelector('a[href]');
  if (!link) return;
  const url = new URL(link.href, window.location.href);
  const poster = block.querySelector('picture img')?.currentSrc
    || block.querySelector('picture img')?.src;
  const autoplay = !block.classList.contains('no-autoplay') && !prefersReducedMotion.matches;
  const youTubeId = getYouTubeId(url);

  const load = () => {
    const player = youTubeId
      ? buildYouTube(youTubeId, autoplay)
      : buildVideo(url.href, autoplay, poster);
    block.classList.toggle('video-youtube', !!youTubeId);
    block.replaceChildren(player);
    if (player.tagName === 'VIDEO' && autoplay) player.play().catch(() => { player.controls = true; });
  };

  // defer loading the player until the block is near the viewport
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      load();
    }
  }, { rootMargin: '200px' });
  observer.observe(block);
}
