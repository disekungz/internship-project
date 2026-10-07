const { mkdir, readFile, readdir, rename, unlink, writeFile } = require('node:fs/promises');
const path = require('node:path');

// Cache directory located at Backend root (.server-cache)
const cacheDirectory = path.join(__dirname, '../.server-cache');
const legacyCacheDirectory = path.join(__dirname, '../routes/10.17.87.244/smart/smart/productionstatus/.server-cache');

const reads = new Map();
const writes = new Map();

const safeName = (key) => key.replace(/[^a-zA-Z0-9._-]/g, '_');
const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function renameWithRetry(temporary, target) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rename(temporary, target);
      return;
    } catch (error) {
      const canRetry = ['EPERM', 'EACCES', 'EBUSY'].includes(error.code);
      if (!canRetry || attempt === 3) throw error;
      await wait(50 * (attempt + 1));
    }
  }
}

function readPersistentCache(key) {
  if (reads.has(key)) return reads.get(key);
  const primaryPath = path.join(cacheDirectory, `${safeName(key)}.json`);
  const legacyPath = path.join(legacyCacheDirectory, `${safeName(key)}.json`);

  const read = readFile(primaryPath, 'utf8')
    .catch((err) => {
      if (err.code === 'ENOENT') {
        return readFile(legacyPath, 'utf8');
      }
      throw err;
    })
    .then(value => JSON.parse(value))
    .catch(error => {
      if (error.code !== 'ENOENT') console.error(`[cache] Unable to read ${key}:`, error.message);
      return null;
    });
  reads.set(key, read);
  return read;
}

function writePersistentCache(key, value) {
  const previousWrite = writes.get(key) || Promise.resolve();
  const write = previousWrite.catch(() => undefined).then(async () => {
    await mkdir(cacheDirectory, { recursive: true });
    const target = path.join(cacheDirectory, `${safeName(key)}.json`);
    const temporary = `${target}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(temporary, JSON.stringify(value));
    await renameWithRetry(temporary, target);
    reads.set(key, Promise.resolve(value));
  });
  writes.set(key, write);
  return write.finally(() => {
    if (writes.get(key) === write) writes.delete(key);
  });
}

async function removePersistentCache(key) {
  await writes.get(key)?.catch(() => undefined);
  reads.delete(key);
  try {
    await unlink(path.join(cacheDirectory, `${safeName(key)}.json`));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await unlink(path.join(legacyCacheDirectory, `${safeName(key)}.json`));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function removePersistentCachePattern(pattern) {
  if (!pattern) return;
  const safePattern = safeName(pattern);
  for (const dir of [cacheDirectory, legacyCacheDirectory]) {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (file.includes(safePattern) || file.includes(pattern)) {
          reads.delete(file.replace(/\.json$/, ''));
          await unlink(path.join(dir, file)).catch(() => {});
        }
      }
    } catch {}
  }
}

module.exports = {
  readPersistentCache,
  writePersistentCache,
  removePersistentCache,
  removePersistentCachePattern,
};
