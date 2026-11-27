// BACKEND LOCAL DE DESENVOLVIMENTO E TESTE — NÃO É O SUPABASE.
//
// Imita o mínimo que o aplicativo usa (entrada anônima, chamadas RPC e canal
// privado do Realtime) sobre um PostgreSQL descartável com as MIGRAÇÕES REAIS,
// de modo que grants, RLS e regras são exercitados de verdade. Os dados somem
// ao encerrar. Escuta somente em localhost e nunca deve ser publicado.
//
//   npm run backend:local
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { WebSocketServer } from "ws";
import { createTestDatabase, runAs } from "../db/database.mjs";

const SECRET = "somente-para-desenvolvimento-local";
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function sign(claims) {
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}`;
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}

function verify(token = "") {
  const [header, payload, signature] = token.split(".");
  if (!signature || createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url") !== signature) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  return claims.exp * 1000 > Date.now() ? claims : null;
}

export const ANON_KEY = sign({ role: "anon", iss: "local", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 });

export async function startBackend({ port = 54321 } = {}) {
  const db = await createTestDatabase();
  const refreshTokens = new Map();
  const stats = { signups: 0, rpc: {} };
  const lose = { name: "dc_command", count: 0 };

  function session(userId) {
    const now = Math.floor(Date.now() / 1000);
    const user = {
      id: userId, aud: "authenticated", role: "authenticated", is_anonymous: true,
      app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
    };
    const refresh = randomBytes(24).toString("hex");
    refreshTokens.set(refresh, userId);
    return {
      access_token: sign({ sub: userId, role: "authenticated", aud: "authenticated", is_anonymous: true, exp: now + 3600 }),
      token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user,
    };
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const reply = (status, body) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(body === undefined ? "" : JSON.stringify(body));
    };
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", request.headers["access-control-request-headers"] ?? "*");
    response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") return reply(204);

    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};

    try {
      if (url.pathname === "/auth/v1/signup") {
        stats.signups += 1;
        return reply(200, session(randomUUID()));
      }
      if (url.pathname === "/auth/v1/token") {
        const userId = refreshTokens.get(body.refresh_token);
        return userId ? reply(200, session(userId)) : reply(400, { code: "refresh_token_not_found", message: "Invalid" });
      }
      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(dc_[a-z_]+)$/);
      if (rpc) {
        const claims = verify((request.headers.authorization ?? "").replace("Bearer ", ""));
        if (!claims) return reply(401, { code: "PGRST301", message: "JWT inválido" });
        stats.rpc[rpc[1]] = (stats.rpc[rpc[1]] ?? 0) + 1;
        const names = Object.keys(body);
        if (!names.every((name) => /^p_[a-z_]+$/.test(name))) return reply(400, { message: "argumentos" });
        const values = names.map((name) => (typeof body[name] === "object" ? JSON.stringify(body[name]) : body[name]));
        const rows = await runAs(
          db.pool, claims.sub,
          `select public.${rpc[1]}(${names.map((name, i) => `${name} => $${i + 1}`).join(", ")}) as r`,
          values, claims.role,
        );
        // Simula a resposta perdida DEPOIS de o banco aplicar o comando.
        if (lose.count > 0 && rpc[1] === lose.name) {
          lose.count -= 1;
          return request.socket.destroy();
        }
        return reply(200, rows[0].r);
      }
      reply(404, { message: "rota não emulada" });
    } catch (error) {
      reply(error.code === "42501" ? 403 : 400, { code: error.code, message: error.message, details: error.detail ?? null });
    }
  });

  // ---------- Realtime (protocolo Phoenix, serializador 2.0.0) ----------
  const sockets = new Set();
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    if (!request.url.startsWith("/realtime/v1/websocket")) return socket.destroy();
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws));
  });

  /** Mesma verificação do Realtime: o usuário consegue LER uma mensagem do tópico? */
  async function mayJoin(claims, topic) {
    const client = await db.pool.connect();
    try {
      await client.query("begin");
      await client.query("insert into realtime.messages (topic, private) values ($1, true)", [topic]);
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true), set_config('realtime.topic', $2, true)",
        [JSON.stringify(claims), topic]);
      const { rows } = await client.query("select 1 from realtime.messages where topic = $1 limit 1", [topic]);
      return rows.length > 0;
    } finally {
      await client.query("rollback");
      client.release();
    }
  }

  wss.on("connection", (ws) => {
    ws.channels = new Map();
    sockets.add(ws);
    ws.on("close", () => sockets.delete(ws));
    ws.on("message", async (data, isBinary) => {
      if (isBinary) return;
      const [joinRef, ref, topic, event, payload] = JSON.parse(data.toString());
      const answer = (status, res = {}) =>
        ws.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status, response: res }]));
      if (event === "phx_join") {
        const claims = verify(payload.access_token);
        const name = topic.replace(/^realtime:/, "");
        if (!payload.config?.private || claims?.role !== "authenticated" || !(await mayJoin(claims, name))) {
          return answer("error", { reason: "Unauthorized" });
        }
        ws.channels.set(name, { topic, joinRef });
        return answer("ok", { postgres_changes: [] });
      }
      if (event === "phx_leave") ws.channels.delete(topic.replace(/^realtime:/, ""));
      if (event !== "access_token") answer("ok");
    });
  });

  const listener = new pg.Client({ connectionString: db.url });
  await listener.connect();
  await listener.query("listen realtime_shim");
  listener.on("notification", (message) => {
    const { topic, event, payload, private: isPrivate } = JSON.parse(message.payload);
    if (!isPrivate) return;
    for (const ws of sockets) {
      const channel = ws.channels.get(topic);
      if (channel) {
        ws.send(JSON.stringify([channel.joinRef, null, channel.topic, "broadcast", { type: "broadcast", event, payload }]));
      }
    }
  });

  await new Promise((resolve) => server.listen(port, "localhost", resolve));

  return {
    url: `http://localhost:${port}`,
    anonKey: ANON_KEY,
    db,
    stats,
    /** Para testes de reconexão. */
    dropSockets() {
      for (const ws of sockets) ws.terminate();
    },
    openChannels: () => [...sockets].reduce((total, ws) => total + ws.channels.size, 0),
    loseNextResponses(count, name = "dc_command") {
      Object.assign(lose, { count, name });
    },
    async stop() {
      for (const ws of sockets) ws.terminate();
      server.closeAllConnections();
      server.close();
      await listener.end();
      await db.close();
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const backend = await startBackend({ port: Number(process.env.PORT ?? 54321) });
  console.log(`
Backend LOCAL de desenvolvimento (não é o Supabase). Dados descartados ao sair.

Em outro terminal:
  NEXT_PUBLIC_SUPABASE_URL=${backend.url} \\
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${backend.anonKey} \\
  npm run dev

Ctrl+C para encerrar.`);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await backend.stop();
      process.exit(0);
    });
  }
}
