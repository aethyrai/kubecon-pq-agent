import { ensureAllIndices } from './aliases.js';
import { clientFromEnv } from './client.js';

const client = clientFromEnv();
const results = await ensureAllIndices(client);
for (const r of results) {
  console.log(`${r.alias.padEnd(12)} -> ${r.index} ${r.created ? '(created)' : '(exists)'}`);
}
const aliases = await client.cat.aliases({ format: 'json' });
console.log(`aliases: ${aliases.length}`);
