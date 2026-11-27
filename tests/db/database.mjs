// Banco de TESTE descartável: aplica o shim do Supabase e as migrações reais.
//  - com DATABASE_URL (ex.: CI), cria um banco temporário nesse servidor;
//  - sem ela, sobe um cluster PostgreSQL próprio numa pasta temporária, em
//    outra porta, e apaga tudo ao final (não toca em instalações existentes).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = fileURLToPath(new URL("../..", import.meta.url));

function findBin() {
  const candidates = [
    process.env.PG_BIN,
    "/usr/local/opt/postgresql@17/bin",
    "/opt/homebrew/opt/postgresql@17/bin",
    "/usr/lib/postgresql/17/bin",
    "",
  ].filter((path) => path !== undefined);
  return candidates.find((path) => path === "" || existsSync(join(path, "initdb")));
}

const freePort = () =>
  new Promise((resolve) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

async function startCluster() {
  const bin = findBin();
  const tool = (name) => (bin ? join(bin, name) : name);
  const folder = mkdtempSync(join(tmpdir(), "dominacao-pg-"));
  const data = join(folder, "data");
  const port = await freePort();
  const env = { ...process.env, LC_ALL: "C" };
  try {
    execFileSync(tool("initdb"), ["-D", data, "-U", "postgres", "-A", "trust", "-E", "UTF8"], { stdio: "pipe", env });
  } catch (error) {
    rmSync(folder, { recursive: true, force: true });
    throw new Error(`PostgreSQL não encontrado ou initdb falhou (instale o PostgreSQL 17 ou defina DATABASE_URL).\n${error.message}`);
  }
  execFileSync(
    tool("pg_ctl"),
    ["-D", data, "-w", "-l", join(folder, "log.txt"), "-o", `-p ${port} -c listen_addresses=127.0.0.1 -k ""`, "start"],
    { stdio: "pipe", env },
  );
  return {
    url: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    stop() {
      execFileSync(tool("pg_ctl"), ["-D", data, "-m", "immediate", "stop"], { stdio: "pipe", env });
      rmSync(folder, { recursive: true, force: true });
    },
  };
}

export async function createTestDatabase() {
  const cluster = process.env.DATABASE_URL ? null : await startCluster();
  const adminUrl = process.env.DATABASE_URL ?? cluster.url;
  const name = `dc_test_${randomBytes(5).toString("hex")}`;

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const setup = new pg.Client({ connectionString: url.href });
  await setup.connect();
  await setup.query(readFileSync(join(root, "supabase/tests/supabase-shim.sql"), "utf8"));
  const migrations = join(root, "supabase/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    await setup.query(readFileSync(join(migrations, file), "utf8"));
  }
  await setup.end();

  const pool = new pg.Pool({ connectionString: url.href, max: 24 });

  return {
    url: url.href,
    pool,
    async close() {
      await pool.end();
      if (cluster) return cluster.stop();
      const cleanup = new pg.Client({ connectionString: adminUrl });
      await cleanup.connect();
      await cleanup.query(`drop database ${name} with (force)`);
      await cleanup.end();
    },
  };
}

/** Executa uma consulta como o Supabase faria: papel `authenticated` + claims do JWT. */
export async function runAs(pool, userId, sql, params = [], role = "authenticated") {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role === "anon" ? "anon" : "authenticated"}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role, is_anonymous: true } : { role }),
    ]);
    const result = await client.query(sql, params);
    await client.query("commit");
    return result.rows;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
