import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import pg from 'pg'

const { Pool } = pg

// JSON repository with local-file support for development and PostgreSQL
// persistence for hosted deployments. Existing server-data JSON files are
// imported lazily on first read so the school can migrate its current records.
export async function createJsonStore({ dataDir, connectionString = process.env.DATABASE_URL }) {
  const pool = connectionString ? new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000 }) : null
  const localQueues = new Map()
  if (pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schoolid_data (
        record_key text PRIMARY KEY,
        record_value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schoolid_attachments (
        filename text PRIMARY KEY,
        content_type text NOT NULL,
        content bytea NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
  }

  const keyFor = file => relative(dataDir, resolve(file)).split(sep).join('/')

  async function read(file, fallback) {
    if (pool) {
      const key = keyFor(file)
      const result = await pool.query('SELECT record_value FROM schoolid_data WHERE record_key = $1', [key])
      if (result.rowCount) return result.rows[0].record_value
      try {
        const legacyValue = JSON.parse(await readFile(file, 'utf8'))
        await pool.query('INSERT INTO schoolid_data (record_key, record_value) VALUES ($1, $2::jsonb) ON CONFLICT (record_key) DO NOTHING', [key, JSON.stringify(legacyValue)])
        return legacyValue
      } catch (error) {
        if (error.code === 'ENOENT') return fallback
        throw error
      }
    }
    try { return JSON.parse(await readFile(file, 'utf8')) }
    catch (error) {
      if (error.code === 'ENOENT') return fallback
      throw error
    }
  }

  async function write(file, value) {
    if (pool) {
      await pool.query('INSERT INTO schoolid_data (record_key, record_value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (record_key) DO UPDATE SET record_value = EXCLUDED.record_value, updated_at = now()', [keyFor(file), JSON.stringify(value)])
      return
    }
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(value, null, 2))
  }

  async function update(file, fallback, updater) {
    const key = keyFor(file)
    if (pool) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key])
        const result = await client.query('SELECT record_value FROM schoolid_data WHERE record_key = $1 FOR UPDATE', [key])
        let current = result.rowCount ? result.rows[0].record_value : fallback
        if (!result.rowCount) {
          try { current = JSON.parse(await readFile(file, 'utf8')) }
          catch (error) { if (error.code !== 'ENOENT') throw error }
        }
        const value = await updater(current)
        await client.query('INSERT INTO schoolid_data (record_key, record_value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (record_key) DO UPDATE SET record_value = EXCLUDED.record_value, updated_at = now()', [key, JSON.stringify(value)])
        await client.query('COMMIT')
        return value
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally { client.release() }
    }
    const previous = localQueues.get(key) || Promise.resolve()
    let release
    const currentQueue = new Promise(resolve => { release = resolve })
    localQueues.set(key, currentQueue)
    await previous
    try {
      const value = await updater(await read(file, fallback))
      await write(file, value)
      return value
    } finally {
      release()
      if (localQueues.get(key) === currentQueue) localQueues.delete(key)
    }
  }

  async function readAttachment(filename) {
    if (!pool) return null
    const result = await pool.query('SELECT content_type, content FROM schoolid_attachments WHERE filename = $1', [filename])
    return result.rowCount ? result.rows[0] : null
  }

  async function writeAttachment(filename, contentType, bytes, { overwrite = true } = {}) {
    if (!pool) throw new Error('PostgreSQL attachment storage is not configured.')
    const conflictAction = overwrite
      ? 'DO UPDATE SET content_type = EXCLUDED.content_type, content = EXCLUDED.content, updated_at = now()'
      : 'DO NOTHING'
    await pool.query(`INSERT INTO schoolid_attachments (filename, content_type, content) VALUES ($1, $2, $3) ON CONFLICT (filename) ${conflictAction}`, [filename, contentType, bytes])
  }

  return { read, write, update, readAttachment, writeAttachment, pool, databaseConfigured: Boolean(pool), close: () => pool?.end() }
}
