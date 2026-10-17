// add functionality that requires user consent here (analytics, martech, etc.)
import initMartech from './martech.js';

initMartech().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Martech failed to initialize', error);
});
