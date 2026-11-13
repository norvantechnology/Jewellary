import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import {
  createGatewayServer,
  loadEnvFileIfNeeded,
  waitForNextHealth,
} from "../src/server/realtime/socket-gateway.mjs";

const root = process.cwd();
loadEnvFileIfNeeded(root);

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

const standaloneDir = path.join(root, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");

if (existsSync(standaloneServer)) {
  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  if (existsSync(staticSrc)) {
    mkdirSync(path.dirname(staticDest), { recursive: true });
    cpSync(staticSrc, staticDest, { recursive: true, force: true });
  }
  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standaloneDir, "public");
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, publicDest, { recursive: true, force: true });
  }
}

const internalPort = Number(process.env.NEXT_INTERNAL_PORT ?? (await getFreeLoopbackPort()));
const gatewayUrl = `http://127.0.0.1:${publicPort}`;
const privateUploadDir = process.env.PRIVATE_UPLOAD_DIR ?? path.join(root, ".private-uploads");

const child = existsSync(standaloneServer)
  ? spawn(process.execPath, [standaloneServer], {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: String(internalPort),
        HOSTNAME: "127.0.0.1",
        REALTIME_GATEWAY_URL: gatewayUrl,
        PRIVATE_UPLOAD_DIR: privateUploadDir,
      },
    })
  : spawn("npx", ["next", "start", "-p", String(internalPort), "-H", "127.0.0.1"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: String(internalPort),
        HOSTNAME: "127.0.0.1",
        REALTIME_GATEWAY_URL: gatewayUrl,
        PRIVATE_UPLOAD_DIR: privateUploadDir,
      },
    });

const gateway = await createGatewayServer({
  nextPort: internalPort,
  authSecret: process.env.BETTER_AUTH_SECRET ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${publicPort}`,
});

await waitForNextHealth(internalPort);

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
