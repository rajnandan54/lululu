const STORAGE_KEY = 'lululu-user';

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('user.update', { detail: { user } }));
}

export function clearUser() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('user.update', { detail: { user: null } }));
}

/**
 * Builds an XDM identityMap for a logged-in user (Email namespace).
 * @param {{ email: string }} user
 */
export function identityMapFor(user) {
  if (!user?.email) return undefined;
  return {
    Email: [{ id: user.email.toLowerCase(), authenticatedState: 'authenticated', primary: false }],
  };
}

/**
 * Sends an event to AEP if the Web SDK is present (i.e. the user consented).
 * @param {object} xdm
 */
export function sendXdmEvent(xdm) {
  if (typeof window.alloy !== 'function') return Promise.resolve();
  return window.alloy('sendEvent', { xdm }).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('alloy sendEvent failed', error);
  });
}
