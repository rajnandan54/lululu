const COOKIE_NAME = 'lululu-consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

let consentedLoaded = false;

function readChoice() {
  const param = new URLSearchParams(window.location.search).get('consent');
  if (param !== null) {
    return ['accept', 'true', '1', 'yes'].includes(param.toLowerCase()) ? 'accept' : 'decline';
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(accept|decline)`));
  return match ? match[1] : null;
}

function storeChoice(choice) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${choice}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function loadConsented() {
  if (consentedLoaded) return;
  consentedLoaded = true;
  import('./consented.js');
}

function onConsentUpdate(choice) {
  const consented = choice === 'accept';
  window.dispatchEvent(new CustomEvent('consent.update', { detail: { consented } }));
  if (consented) {
    loadConsented();
  } else if (typeof window.alloy === 'function') {
    // Web SDK was already running this page view; tell it to stop collecting
    window.alloy('setConsent', {
      consent: [{ standard: 'Adobe', version: '1.0', value: { general: 'out' } }],
    });
  }
}

function showBanner() {
  if (document.querySelector('.consent-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'consent-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-label', 'Cookie consent');

  const text = document.createElement('p');
  text.textContent = 'We use cookies to analyse traffic and personalise your experience. '
    + 'You can accept or decline non-essential cookies.';

  const actions = document.createElement('div');
  actions.className = 'consent-banner-actions';
  [['decline', 'Decline', 'secondary'], ['accept', 'Accept', 'primary']].forEach(([choice, label, style]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ${style}`;
    button.textContent = label;
    button.addEventListener('click', () => {
      storeChoice(choice);
      banner.remove();
      onConsentUpdate(choice);
    });
    actions.append(button);
  });

  banner.append(text, actions);
  document.body.append(banner);
  actions.lastElementChild.focus({ preventScroll: true });
}

// authors can reopen the banner with a link to #cookie-settings
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href$="#cookie-settings"]');
  if (!link) return;
  e.preventDefault();
  showBanner();
});

const choice = readChoice();
if (choice) onConsentUpdate(choice);
else showBanner();
