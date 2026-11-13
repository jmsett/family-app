import { createApp } from './app.js';
const app = createApp(process.env.DB_PATH);
const port = Number(process.env.PORT ?? 3001);
const host = process.env.CONTAINER_LOCAL_ONLY === '1' ? '0.0.0.0' : '127.0.0.1';
await app.listen({ port, host });
console.log(`Family Manager local prototype: http://localhost:${port}`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
