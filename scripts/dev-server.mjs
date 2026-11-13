import { spawn } from "node:child_process";
import net from "node:net";
import {
  createGatewayServer,
  loadEnvFileIfNeeded,
} from "../src/server/realtime/socket-gateway.mjs";

loadEnvFileIfNeeded(process.cwd());

const publicPort = Number(process.env.PORT ?? 3000);
const publicHostname = process.env.HOSTNAME ?? "0.0.0.0";

function getFreeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 4000;
      srv.close(() => resolve(port));
    });
  });
}

const internalPort = Number(process.env.NEXT_INTERNAL_PORT ?? (await getFreeLoopbackPort()));
const gatewayUrl = `http://127.0.0.1:${publicPort}`;

const child = spawn(
  "npx",
  ["next", "dev", "--turbopack", "-p", String(internalPort), "-H", "127.0.0.1"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(internalPort),
      HOSTNAME: "127.0.0.1",
      REALTIME_GATEWAY_URL: gatewayUrl,
    },
  },
);

const gateway = await createGatewayServer({
  nextPort: internalPort,
  authSecret: process.env.BETTER_AUTH_SECRET ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${publicPort}`,
});

await new Promise((resolve) => {
  gateway.httpServer.listen(publicPort, publicHostname, resolve);
});

let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await gateway.close().catch(() => {});
  if (!child.killed) {
    child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
child.on("exit", (code) => {
  if (!shuttingDown) {
    void shutdown(code ?? 0);
  }
});
