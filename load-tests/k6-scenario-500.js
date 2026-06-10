/** k6 — escenario 500 VUs lectura mixta */
export { default } from './k6-read-api.js';
export const options = {
  scenarios: {
    beta_500: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 500 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};
