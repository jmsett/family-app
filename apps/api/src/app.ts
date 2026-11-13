import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_CATEGORIES,
  projectBudget,
  validateDraft,
  initialDraft,
} from '@family/domain';
import type { BudgetDraft, Workspace } from '@family/shared';
import { openStore, RevisionConflict } from './store.js';

export function createApp(dbPath = 'data/family-manager.sqlite') {
  const app = Fastify({ logger: false, bodyLimit: 16_384 });
  const store = openStore(dbPath);
  app.addHook('onClose', async () => store.close());
  // M0 has no authentication: accept only loopback development hostnames.
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    if (!allowedHosts.has(request.hostname))
      return reply
        .code(403)
        .send({ message: 'This prototype is available on localhost only.' });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const origin = request.headers.origin;
      if (
        origin &&
        ![
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
        ].includes(origin)
      )
        return reply.code(403).send({ message: 'Origin is not allowed.' });
    }
  });
  const workspace = (draft: BudgetDraft): Workspace => ({
    mode: 'local-prototype',
    currency: 'EUR',
    timezone: 'Europe/Busingen',
    draft,
    projection: projectBudget(draft),
    categories: DEFAULT_CATEGORIES,
    recorded: { earmarkedMinor: 0, expensesMinor: 0, payableMinor: 0 },
  });
  app.get('/api/health', async () => ({
    status: 'ok',
    schemaVersion: 1,
    mode: 'local-prototype',
  }));
  app.get<{ Querystring: { month?: string } }>(
    '/api/workspace',
    async (request, reply) => {
      const month =
        request.query.month ??
        new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Europe/Busingen',
          year: 'numeric',
          month: '2-digit',
        }).format(new Date());
      try {
        validateDraft(initialDraft(month));
      } catch {
        return reply.code(400).send({ message: 'Invalid month.' });
      }
      return workspace(store.read(month));
    },
  );
  app.put<{ Body: BudgetDraft }>(
    '/api/budget-draft',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: [
            'month',
            'totalMinor',
            'savingsMinor',
            'memberNames',
            'firstMemberBasisPoints',
            'revision',
          ],
          properties: {
            month: { type: 'string' },
            totalMinor: { type: 'integer' },
            savingsMinor: { type: 'integer' },
            memberNames: {
              type: 'array',
              minItems: 2,
              maxItems: 2,
              items: { type: 'string', minLength: 1, maxLength: 40 },
            },
            firstMemberBasisPoints: { type: 'integer' },
            revision: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return workspace(store.save(request.body));
      } catch (error) {
        if (error instanceof RevisionConflict)
          return reply.code(409).send({ message: error.message });
        if (error instanceof Error && !(error as NodeJS.ErrnoException).code)
          return reply.code(400).send({ message: error.message });
        throw error;
      }
    },
  );
  const webRoot = resolve('apps/web/dist');
  if (existsSync(webRoot)) app.register(fastifyStatic, { root: webRoot });
  return app;
}
