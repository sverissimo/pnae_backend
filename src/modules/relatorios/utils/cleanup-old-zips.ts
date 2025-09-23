import * as fsp from 'fs/promises';
import * as path from 'path';

export async function cleanupOldZips(
  dir: string,
  keep: number = 5,
): Promise<void> {
  try {
    const exists = await fsp
      .access(dir)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      return; // nothing to clean up
    }

    const files = await fsp.readdir(dir);

    // only keep .zip files
    const zipFiles = files
      .filter((f) => f.toLowerCase().endsWith('.zip'))
      .map((f) => ({
        name: f,
        fullPath: path.join(dir, f),
      }));

    if (zipFiles.length <= keep) return;

    // sort by modified time (oldest first)
    const withStats = await Promise.all(
      zipFiles.map(async (f) => {
        const stat = await fsp.stat(f.fullPath);
        return { ...f, mtime: stat.mtime.getTime() };
      }),
    );

    withStats.sort((a, b) => a.mtime - b.mtime);

    // delete oldest
    const toDelete = withStats.slice(0, withStats.length - keep);
    for (const f of toDelete) {
      try {
        await fsp.unlink(f.fullPath);
        console.log(`[cleanupOldZips] Deleted old zip: ${f.name}`);
      } catch (err) {
        console.warn(`[cleanupOldZips] Could not delete ${f.name}:`, err);
      }
    }
  } catch (err) {
    console.error(`[cleanupOldZips] Error:`, err);
  }
}
