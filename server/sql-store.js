/* SQL Server persistence adapter. It stores the MVP document atomically in
   AppSettings while the normalized tables in database/schema.sql remain
   available for reporting and later expansion. */
import sql from 'mssql';
import { normalizeState } from './defaults.js';

const clone = (value) => structuredClone(value);

export class SqlStore {
  constructor(config) {
    this.config = {
      server: config.server,
      database: config.database,
      user: config.user,
      password: config.password,
      options: { encrypt: Boolean(config.encrypt), trustServerCertificate: !config.encrypt }
    };
    this.pool = null;
    this.state = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    this.pool = await sql.connect(this.config);
    const result = await this.pool.request()
      .input('key', sql.NVarChar(128), 'mvp_state')
      .query('SELECT value_json FROM dbo.AppSettings WHERE [key] = @key');
    this.state = normalizeState(result.recordset[0] ? JSON.parse(result.recordset[0].value_json) : null);
    if (!result.recordset[0]) await this.#write();
    return this.getState();
  }

  getState() { return clone(this.state); }

  async mutate(mutator) {
    const job = this.writeQueue.then(async () => {
      const next = normalizeState(this.state);
      await mutator(next);
      next.meta.updatedAt = new Date().toISOString();
      this.state = next;
      await this.#write();
      return this.getState();
    });
    this.writeQueue = job.catch(() => undefined);
    return job;
  }

  async #write() {
    await this.pool.request()
      .input('key', sql.NVarChar(128), 'mvp_state')
      .input('value', sql.NVarChar(sql.MAX), JSON.stringify(this.state))
      .query(`MERGE dbo.AppSettings WITH (HOLDLOCK) AS target
              USING (SELECT @key AS [key], @value AS value_json) AS source
              ON target.[key] = source.[key]
              WHEN MATCHED THEN UPDATE SET value_json = source.value_json, updated_at = SYSUTCDATETIME()
              WHEN NOT MATCHED THEN INSERT ([key], value_json) VALUES (source.[key], source.value_json);`);
  }

  async close() { await this.pool?.close(); }
}
