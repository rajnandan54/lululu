import { getYouTubeId, buildYouTube } from '../../scripts/video.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const SIZES = ['small', 'medium', 'large', 'full'];

function buildVideo(src, autoplay, poster, title) {
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'metadata';
  if (title) video.setAttribute('aria-label', title);
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

/**
 * Reads optional two-column `key | value` rows (title, size, ratio).
 */
function readOptions(block) {
  const options = {};
  [...block.children].forEach((row) => {
    if (row.children.length !== 2) return;
    const key = row.children[0].textContent.trim().toLowerCase();
    const value = row.children[1].textContent.trim();
    if (['title', 'size', 'ratio'].includes(key) && !row.querySelector('a, picture')) {
      options[key] = value;
      row.remove();
    }
  });
  return options;
}

function parseRatio(value = '') {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i);
  return match ? `${match[1]} / ${match[2]}` : null;
}

export default function decorate(block) {
  const options = readOptions(block);
  const link = block.querySelector('a[href]');
  if (!link) return;
  const url = new URL(link.href, window.location.href);
  const poster = block.querySelector('picture img')?.currentSrc
    || block.querySelector('picture img')?.src;
  const autoplay = !block.classList.contains('no-autoplay') && !prefersReducedMotion.matches;
  const youTubeId = getYouTubeId(url);
  const { title } = options;

  const size = (options.size || '').toLowerCase();
  if (SIZES.includes(size)) block.classList.add(`video-${size}`);
  const ratio = parseRatio(options.ratio);
  if (ratio) block.style.setProperty('--video-ratio', ratio);

  const frame = document.createElement('div');
  frame.className = 'video-frame';
  const children = [frame];
  if (title) {
    const caption = document.createElement('p');
    caption.className = 'video-title';
    caption.textContent = title;
    children.push(caption);
  }
  block.replaceChildren(...children);

  const load = () => {
    const player = youTubeId
      ? buildYouTube(youTubeId, { autoplay, title })
      : buildVideo(url.href, autoplay, poster, title);
    block.classList.toggle('video-youtube', !!youTubeId);
    frame.replaceChildren(player);
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
