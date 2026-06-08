import fs from "fs";
import os from "os";
import path from "path";

const dataDir = path.join(os.homedir(), ".agentlogger");
const statePath = path.join(dataDir, "dashboard.json");

export function writeDashboardState({ port, projectId }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const url = `http://localhost:${port}`;
  const trimmedProjectId = projectId?.trim();
  const browserUrl = trimmedProjectId
    ? `${url}/runs?project_id=${encodeURIComponent(trimmedProjectId)}`
    : `${url}/runs`;
  fs.writeFileSync(
    statePath,
    `${JSON.stringify(
      { port, url, browserUrl, projectId: trimmedProjectId, updatedAt: new Date().toISOString() },
      null,
      2
    )}\n`,
    "utf8"
  );
  return browserUrl;
}

export function readDashboardUrl() {
  try {
    const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return typeof data.url === "string" ? data.url : undefined;
  } catch {
    return undefined;
  }
}
