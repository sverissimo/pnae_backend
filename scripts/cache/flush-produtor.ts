import 'dotenv/config';
import IORedis from 'ioredis';

const PREFIX = 'produtor:v1';

async function main() {
  const ids = process.argv.slice(2);
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new IORedis(url, { maxRetriesPerRequest: null });

  try {
    if (ids.length === 0) {
      let cursor = '0';
      let total = 0;
      do {
        const [next, batch] = await redis.scan(
          cursor,
          'MATCH',
          `${PREFIX}:*`,
          'COUNT',
          500,
        );
        cursor = next;
        if (batch.length) {
          const deleted = await redis.del(...batch);
          total += deleted;
        }
      } while (cursor !== '0');
      console.log(`flushed ${total} keys matching ${PREFIX}:*`);
    } else {
      const keys = ids.map((id) => `${PREFIX}:${id}`);
      const deleted = await redis.del(...keys);
      console.log(`flushed ${deleted}/${keys.length} keys (${PREFIX}:<id>)`);
    }
  } finally {
    await redis.quit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
