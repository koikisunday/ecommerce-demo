import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const webDir = process.cwd()
const projectRoot = path.resolve(webDir, '..')
const prismaDir = path.join(projectRoot, 'prisma')
const smokeDbPath = path.join(prismaDir, 'smoke.db')
const smokeDbJournalPath = path.join(prismaDir, 'smoke.db-journal')
const migrationSqlPath = path.join(prismaDir, 'migrations', '20260219000100_init', 'migration.sql')

const smokeEnv = {
  ...process.env,
  DATABASE_URL: 'file:./smoke.db'
}

function run(command) {
  console.log(`\n> ${command}`)
  execSync(command, { cwd: webDir, env: smokeEnv, stdio: 'inherit' })
}

function removeIfPresent(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true })
  }
}

async function applyMigrationSqlFallback() {
  if (!fs.existsSync(migrationSqlPath)) {
    throw new Error(`Migration SQL not found at ${migrationSqlPath}`)
  }

  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8')
  const statements = migrationSql
    .split(/;\s*\r?\n/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

  const prisma = new PrismaClient()
  try {
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(`${statement};`)
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log(`Applied ${statements.length} SQL statements via fallback`)
}

async function main() {
  process.env.DATABASE_URL = smokeEnv.DATABASE_URL

  removeIfPresent(smokeDbPath)
  removeIfPresent(smokeDbJournalPath)

  try {
    run('npx prisma migrate deploy --schema ../prisma/schema.prisma')
  } catch (error) {
    console.warn('prisma migrate deploy failed in this environment; falling back to checked-in migration SQL.')
    await applyMigrationSqlFallback()
  }

  run('npm run prisma:seed')
  run('npm test -- --runInBand tests/paymentLifecycle.e2e.test.ts tests/checkoutRetry.test.ts tests/adminInventory.test.ts')

  console.log('\nSmoke run completed successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
