/** k6 — escenario 250 VUs lectura mixta */
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
export { default } from './k6-read-api.js';
export const options = {
  scenarios: {
    beta_250: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 250 },
        { duration: '2m', target: 250 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};
export function handleSummary(data) {
  return { stdout: textSummary(data, { indent: ' ', enableColors: true }) };
}
