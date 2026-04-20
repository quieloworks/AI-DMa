import { createServer, type Server as HttpServer } from "node:http";
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
