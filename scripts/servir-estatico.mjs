// Serve a pasta out/ como o GitHub Pages: subpasta opcional, pasta/index.html,
// redirecionamento para a barra final e 404.html. Só para uso local.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out", import.meta.url));
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const port = Number(process.env.PORT ?? 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

if (!existsSync(root)) {
  console.error("Pasta out/ não existe. Rode `npm run build` antes.");
  process.exit(1);
}

function send(response, status, file) {
  response.writeHead(status, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}

createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);
  const notFound = () => send(response, 404, join(root, "404.html"));

  if (base && path !== base && !path.startsWith(`${base}/`)) return notFound();
  const file = normalize(join(root, path.slice(base.length)));
  if (file !== root && !file.startsWith(root + sep)) return notFound();
  if (!existsSync(file)) return notFound();

  if (statSync(file).isDirectory()) {
    if (!path.endsWith("/")) {
      response.writeHead(301, { location: `${url.pathname}/${url.search}` });
      return response.end();
    }
    const index = join(file, "index.html");
    return existsSync(index) ? send(response, 200, index) : notFound();
  }
  send(response, 200, file);
}).listen(port, "localhost", () => console.log(`Site estático em http://localhost:${port}${base}/`));
