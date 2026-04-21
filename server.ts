import { createServer, type Server as HttpServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "node:url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { registerSocketHandlers } from "./server/socket";
import { getLanIp } from "./server/network";
import { setIo } from "./server/io-bus";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const desiredPort = Number(process.env.PORT ?? 3000);
const maxAttempts = 15;

async function findFreePort(start: number): Promise<number> {
  const net = await import("node:net");
  for (let p = start; p < start + maxAttempts; p++) {
    const free = await new Promise<boolean>((resolve) => {
      const tester = net.createServer();
      tester.once("error", () => resolve(false));
      tester.once("listening", () => tester.close(() => resolve(true)));
      tester.listen(p, hostname);
    });
    if (free) return p;
  }
  throw new Error(`No encontré puerto libre entre ${start} y ${start + maxAttempts - 1}`);
}

(async () => {
  const port = await findFreePort(desiredPort);
  if (port !== desiredPort) {
    console.warn(`\n  [aviso] el puerto ${desiredPort} está ocupado; usando ${port} en su lugar.`);
  }
  process.env.PORT = String(port);

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  // #region agent log
  {
    const serverDir = join(process.cwd(), ".next", "server");
    const chunkChecks = ["948.js", "682.js", "chunks/948.js", "chunks/682.js"].map((rel) => ({
      rel,
      exists: existsSync(join(serverDir, rel)),
    }));
    let webpackU = "";
    try {
      const wr = readFileSync(join(serverDir, "webpack-runtime.js"), "utf8");
      const m = wr.match(/__webpack_require__\.u\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*\}/);
      webpackU = m ? m[0].replace(/\s+/g, " ").slice(0, 220) : "no_u_match";
    } catch (e) {
      webpackU = `read_fail:${(e as Error).message}`;
    }
    fetch("http://127.0.0.1:7883/ingest/2d1d67f7-0330-43e0-afca-55966689b1f5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b55592" },
      body: JSON.stringify({
        sessionId: "b55592",
        hypothesisId: "H1",
        location: "server.ts:after-prepare",
        message: "next server chunk path probe",
        data: { dev, serverDir, chunkChecks, webpackU, argv0: process.argv[0] },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  const httpServer: HttpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
  });
  registerSocketHandlers(io);
  setIo(io);

  httpServer.listen(port, hostname, () => {
    const ip = getLanIp();
    console.log(`\n  D&D DM listo en http://localhost:${port}`);
    if (ip) console.log(`  LAN:       http://${ip}:${port}`);
    console.log("");
  });
})().catch((err) => {
  console.error("\n  Error al arrancar:", err);
  process.exit(1);
});
