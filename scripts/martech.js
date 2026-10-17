import { loadScript } from './aem.js';
import { getUser, identityMapFor } from './user.js';

const ALLOY_SRC = 'https://cdn1.adoberesources.net/alloy/2.24.0/alloy.min.js';

export default async function initMartech() {
  // alloy base code: queues commands until the library loads
  if (!window.alloy) {
    // eslint-disable-next-line no-underscore-dangle
    (window.__alloyNS = window.__alloyNS || []).push('alloy');
    window.alloy = (...args) => new Promise((resolve, reject) => {
      window.alloy.q.push([resolve, reject, args]);
    });
    window.alloy.q = [];
  }

  window.alloy('configure', {
    datastreamId: 'a0231907-6318-45a4-82ca-0f520b89dafe',
    orgId: 'E71EADC8584130D00A495EBD@AdobeOrg',
    prehidingStyle: '.personalization-container { opacity: 0 !important }',
  });

  // injected <script> (not import()) — alloy is a classic script, and strict-dynamic trusts it
  await loadScript(ALLOY_SRC);

  const user = getUser();
  await window.alloy('sendEvent', {
    renderDecisions: true, // applies Target VEC decisions
    xdm: {
      eventType: 'web.webpagedetails.pageViews',
      web: { webPageDetails: { name: document.title, pageViews: { value: 1 } } },
      ...(user && { identityMap: identityMapFor(user) }),
    },
  });
}