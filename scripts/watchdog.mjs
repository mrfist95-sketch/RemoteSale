import { spawn } from "node:child_process";
import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.WATCHDOG_HOST || "127.0.0.1";
const HEALTH_PATH = process.env.HEALTH_PATH || "/api/health";
const CHECK_INTERVAL = Number(process.env.WATCHDOG_INTERVAL || 15000);
const MAX_FAILS = Number(process.env.WATCHDOG_MAX_FAILS || 3);
const START_CMD = process.env.WATCHDOG_CMD || "node";
const START_ARGS = (
  process.env.WATCHDOG_ARGS || "node_modules/next/dist/bin/next start -H 0.0.0.0"
).split(" ");

let child = null;
let fails = 0;
let stopping = false;

function log(msg) {
  console.log(`[watchdog ${new Date().toISOString()}] ${msg}`);
}

function startChild() {
  if (stopping) return;
  log(`starting app: ${START_CMD} ${START_ARGS.join(" ")}`);
  child = spawn(START_CMD, START_ARGS, { stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) return;
    log(`app exited (code=${code}, signal=${signal}); restarting in 1s`);
    setTimeout(startChild, 1000);
  });
}

function onFail(reason) {
  fails++;
  log(`health check FAILED (${reason}); fails=${fails}/${MAX_FAILS}`);
  if (fails >= MAX_FAILS) {
    fails = 0;
    log("threshold reached, restarting app");
    if (child) child.kill("SIGKILL");
  }
}

function check() {
  if (stopping || !child) return;
  const req = http.get({ host: HOST, port: PORT, path: HEALTH_PATH, timeout: 5000 }, (res) => {
    res.resume();
    const ok = !!res.statusCode && res.statusCode >= 200 && res.statusCode < 400;
    if (ok) fails = 0;
    else onFail(`status ${res.statusCode}`);
  });
  req.on("timeout", () => {
    req.destroy();
    onFail("timeout");
  });
  req.on("error", (err) => onFail(err.message));
}

function shutdown(sig) {
  stopping = true;
  log(`received ${sig}, stopping`);
  if (child) child.kill(sig);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

log("watchdog started");
startChild();
setInterval(check, CHECK_INTERVAL);
