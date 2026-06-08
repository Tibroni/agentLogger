import net from "net";

export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

/** First free port at or after `startPort` (checks up to 50 ports). */
export async function findAvailablePort(startPort = 3000) {
  const start = Number(startPort) || 3000;
  for (let offset = 0; offset < 50; offset++) {
    const port = start + offset;
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No free port found near ${start}`);
}
