import { setupServer } from 'msw/node';

// docs/decision.md ADR-019 — msw was a devDependency with zero uses until
// stores/__tests__/topup-store.test.ts; this is the shared server every AI-route
// mock test imports, following the standard msw/node setup pattern (listen in
// beforeAll, resetHandlers in afterEach, close in afterAll — see that test file).
export const server = setupServer();
