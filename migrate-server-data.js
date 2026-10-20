import { readdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createJsonStore } from './serverStorage.js'

const legacyDir = resolve(process.env.LEGACY_DATA_DIR || 'server-data')
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the hosted PostgreSQL connection string before importing records.')

const store = await createJsonStore({ dataDir: legacyDir, connectionString: process.env.DATABASE_URL })
try {
  const recordFiles = [
    'homework.json', 'students.json', 'homework-completions.json', 'rfid-scans.json',
    'attendance.json', 'fees.json', 'settings.json', 'users.json',
  ]
  for (const filename of recordFiles) {
    const path = join(legacyDir, filename)
    const value = await store.read(path, null)
    if (value !== null) console.log(`Imported or retained ${filename}`)
  }

  const attachmentDir = join(legacyDir, 'attachments')
  let files = []
  try { files = await readdir(attachmentDir, { withFileTypes: true }) } catch (error) { if (error.code !== 'ENOENT') throw error }
  for (const entry of files) {
    if (!entry.isFile() || !/^[a-f0-9-]+\.(pdf|png|jpe?g|gif|webp)$/i.test(entry.name)) continue
    const extension = entry.name.split('.').pop().toLowerCase()
    const type = extension === 'pdf' ? 'application/pdf'
      : extension === 'png' ? 'image/png'
        : extension === 'gif' ? 'image/gif'
          : extension === 'webp' ? 'image/webp' : 'image/jpeg'
    await store.writeAttachment(entry.name, type, await readFile(join(attachmentDir, entry.name)), { overwrite: false })
    console.log(`Imported or retained attachment ${entry.name}`)
  }
  console.log('Local SchoolID data import finished. Existing hosted records were kept.')
} finally {
  await store.close()
}
