import { networkInterfaces } from "node:os";

export function getLanIp(): string | null {
  const ifaces = networkInterfaces();
  const candidates: string[] = [];
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === "IPv4" && !iface.internal) candidates.push(iface.address);
    }
  }
  candidates.sort((a, b) => priority(a) - priority(b));
  return candidates[0] ?? null;
}

function priority(ip: string): number {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  if (ip.startsWith("172.")) return 2;
  return 9;
}

export function getLanBaseUrl(port: number): string {
  const ip = getLanIp() ?? "localhost";
  return `http://${ip}:${port}`;
}
