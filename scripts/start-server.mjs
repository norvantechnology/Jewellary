import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
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

  const child = spawn(process.execPath, [standaloneServer], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: process.env.PORT ?? "3000",
      HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
    },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const child = spawn("npx", ["next", "start"], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}
