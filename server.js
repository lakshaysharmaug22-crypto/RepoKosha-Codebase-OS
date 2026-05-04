import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { parseZipBuffer } from "./server/lib/zip.js";
import {
  createProjectFromFiles,
  getProject,
  listProjects,
  scanDirectory,
} from "./server/lib/projects.js";
import {
  answerQuestion,
  buildArchitecture,
  buildDocs,
  buildPlan,
  buildRiskReport,
} from "./server/lib/insights.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 8080);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req, 5 * 1024 * 1024);
  return body.length ? JSON.parse(body.toString("utf8")) : {};
}

function getProjectId(pathname) {
  const match = pathname.match(/^\/api\/projects\/([^/]+)/);
  return match?.[1];
}

async function importGithubRepo(url) {
  const match = String(url).match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!match) {
    throw new Error("Enter a valid GitHub repository URL.");
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  const branches = ["main", "master"];
  let lastError;

  for (const branch of branches) {
    const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    try {
      const response = await fetch(archiveUrl, {
        headers: { "user-agent": "RepoKosha-AI" },
      });
      if (!response.ok) {
        lastError = new Error(`GitHub returned ${response.status} for ${branch}.`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const files = parseZipBuffer(buffer);
      return createProjectFromFiles({
        name: `${owner}/${repo}`,
        source: "GitHub URL",
        files,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to import GitHub repository.");
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    const body = await readFile(join(publicDir, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  }
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        name: "RepoKosha AI",
        mode: "local-rag",
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/projects") {
      sendJson(res, 200, { projects: listProjects() });
      return;
    }

    if (req.method === "POST" && pathname === "/api/projects/scan-self") {
      const files = await scanDirectory(__dirname);
      const project = createProjectFromFiles({
        name: "RepoKosha AI Self Demo",
        source: "Self scan",
        files,
      });
      sendJson(res, 201, { project });
      return;
    }

    if (req.method === "POST" && pathname === "/api/projects/upload-zip") {
      const body = await readBody(req, 50 * 1024 * 1024);
      const files = parseZipBuffer(body);
      const project = createProjectFromFiles({
        name: req.headers["x-project-name"] || "Uploaded codebase",
        source: "ZIP upload",
        files,
      });
      sendJson(res, 201, { project });
      return;
    }

    if (req.method === "POST" && pathname === "/api/projects/github") {
      const payload = await readJson(req);
      const project = await importGithubRepo(payload.url);
      sendJson(res, 201, { project });
      return;
    }

    const id = getProjectId(pathname);
    if (id) {
      const project = getProject(id);
      if (!project) {
        sendJson(res, 404, { error: "Project not found" });
        return;
      }

      if (req.method === "GET" && pathname === `/api/projects/${id}`) {
        sendJson(res, 200, { project });
        return;
      }

      if (req.method === "GET" && pathname === `/api/projects/${id}/architecture`) {
        sendJson(res, 200, buildArchitecture(project));
        return;
      }

      if (req.method === "GET" && pathname === `/api/projects/${id}/docs`) {
        sendJson(res, 200, buildDocs(project));
        return;
      }

      if (req.method === "GET" && pathname === `/api/projects/${id}/risks`) {
        sendJson(res, 200, buildRiskReport(project));
        return;
      }

      if (req.method === "POST" && pathname === `/api/projects/${id}/chat`) {
        const payload = await readJson(req);
        sendJson(res, 200, answerQuestion(project, payload.question || ""));
        return;
      }

      if (req.method === "POST" && pathname === `/api/projects/${id}/plan`) {
        const payload = await readJson(req);
        sendJson(res, 200, buildPlan(project, payload.feature || ""));
        return;
      }
    }

    sendJson(res, 404, { error: "Route not found" });
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "Unexpected server error",
    });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.listen(port, () => {
  console.log(`RepoKosha AI running at http://localhost:${port}`);
});
