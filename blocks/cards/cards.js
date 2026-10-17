import { createOptimizedPicture } from '../../scripts/aem.js';
import { getYouTubeId, buildYouTube } from '../../scripts/video.js';

/**
 * Returns the YouTube ID if the cell contains only a YouTube link.
 * @param {Element} cell
 */
function getCellYouTubeId(cell) {
  const links = cell.querySelectorAll('a[href]');
  if (links.length !== 1 || cell.querySelector('picture')) return null;
  const [link] = links;
  if (cell.textContent.trim() !== link.textContent.trim()) return null;
  try {
    return getYouTubeId(new URL(link.href));
  } catch {
    return null;
  }
}

/**
 * Shows a lightweight thumbnail that swaps in the player on click.
 */
function buildYouTubeFacade(id, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cards-video-play';
  button.setAttribute('aria-label', `Play video${title ? `: ${title}` : ''}`);
  const img = document.createElement('img');
  img.src = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  img.alt = '';
  img.loading = 'lazy';
  button.append(img);
  button.addEventListener('click', () => {
    button.replaceWith(buildYouTube(id, { autoplay: true, muted: false, title }));
  }, { once: true });
  return button;
}

function decorateVideoCell(cell, id, autoplay) {
  const title = cell.closest('li')
    ?.querySelector('.cards-card-body :is(h1, h2, h3, h4, h5, h6, strong)')
    ?.textContent.trim();
  cell.className = 'cards-card-image cards-card-video';
  if (!autoplay) {
    cell.replaceChildren(buildYouTubeFacade(id, title));
    return;
  }
  cell.textContent = '';
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    cell.replaceChildren(buildYouTube(id, { autoplay: true, title }));
  }, { rootMargin: '200px' });
  observer.observe(cell);
}

export default function decorate(block) {
  const autoplay = block.classList.contains('autoplay')
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videoCells = [];
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      const youTubeId = getCellYouTubeId(div);
      if (youTubeId) videoCells.push([div, youTubeId]);
      else if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.replaceChildren(ul);
  videoCells.forEach(([cell, id]) => decorateVideoCell(cell, id, autoplay));
}
