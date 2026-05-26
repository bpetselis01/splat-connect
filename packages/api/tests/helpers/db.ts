import pg from 'pg'

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres',
})

export async function withRollback(
  fn: (client: pg.PoolClient) => Promise<void>
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await fn(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

export async function closePool(): Promise<void> {
  await pool.end()
}
