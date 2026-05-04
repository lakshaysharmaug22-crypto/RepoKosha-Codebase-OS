import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSearchIndex, tokenize } from "./search.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const dataDir = join(rootDir, "data");
const storePath = join(dataDir, "projects.json");

const ignoreDirs = new Set([
  ".git",
  "node_modules",
  "data",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vercel",
]);

const sourceExtensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".html",
  ".css",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".sql",
]);

function ensureStore() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(storePath)) writeFileSync(storePath, JSON.stringify({ projects: [] }, null, 2));
}

function loadStore() {
  ensureStore();
  return JSON.parse(readFileSync(storePath, "utf8"));
}

function saveStore(store) {
  ensureStore();
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function ext(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index).toLowerCase();
}

function isSourceFile(path, size) {
  if (size > 250_000) return false;
  if (path.toLowerCase().includes("package-lock.json")) return false;
  return sourceExtensions.has(ext(path)) || path.toLowerCase().includes("dockerfile");
}

function chunkFile(file) {
  const lines = file.content.split(/\r?\n/);
  const chunks = [];
  const chunkSize = 60;

  for (let start = 0; start < lines.length; start += chunkSize) {
    const slice = lines.slice(start, start + chunkSize);
    chunks.push({
      id: `${file.path}:${start + 1}`,
      path: file.path,
      startLine: start + 1,
      endLine: start + slice.length,
      text: slice.join("\n"),
      tokens: tokenize(`${file.path}\n${slice.join("\n")}`),
    });
  }

  return chunks;
}

function detectStack(files) {
  const paths = files.map((file) => file.path.toLowerCase());
  const text = files.slice(0, 80).map((file) => file.content.slice(0, 1000)).join("\n").toLowerCase();
  const stack = [];

  if (paths.includes("package.json") || text.includes("react")) stack.push("JavaScript/Node.js");
  if (text.includes("react")) stack.push("React");
  if (text.includes("next")) stack.push("Next.js");
  if (paths.some((path) => path.endsWith(".py"))) stack.push("Python");
  if (text.includes("fastapi")) stack.push("FastAPI");
  if (text.includes("express")) stack.push("Express");
  if (paths.some((path) => path.endsWith(".java"))) stack.push("Java");
  if (paths.some((path) => path.includes("dockerfile"))) stack.push("Docker");

  return [...new Set(stack)].slice(0, 8);
}

function summarizeProject(files) {
  const folders = new Set();
  const extensions = new Map();
  for (const file of files) {
    const parts = file.path.split("/");
    if (parts.length > 1) folders.add(parts[0]);
    const fileExt = ext(file.path) || "other";
    extensions.set(fileExt, (extensions.get(fileExt) || 0) + 1);
  }

  return {
    totalFiles: files.length,
    totalLines: files.reduce((sum, file) => sum + file.content.split(/\r?\n/).length, 0),
    folders: [...folders].slice(0, 12),
    languages: [...extensions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
    stack: detectStack(files),
  };
}

export function createProjectFromFiles({ name, source, files }) {
  const cleanedFiles = files
    .filter((file) => file.path && file.content && isSourceFile(file.path, file.size || file.content.length))
    .map((file) => ({
      path: file.path.replace(/\\/g, "/"),
      content: file.content,
      size: file.size || Buffer.byteLength(file.content),
    }))
    .slice(0, 700);

  if (!cleanedFiles.length) {
    throw new Error("No supported source files found.");
  }

  const chunks = cleanedFiles.flatMap(chunkFile);
  const project = {
    id: `repo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    source,
    createdAt: new Date().toISOString(),
    summary: summarizeProject(cleanedFiles),
    files: cleanedFiles,
    chunks,
    searchIndex: buildSearchIndex(chunks),
  };

  const store = loadStore();
  store.projects.unshift(project);
  store.projects = store.projects.slice(0, 8);
  saveStore(store);
  return project;
}

export async function scanDirectory(directory) {
  const files = [];

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoreDirs.has(entry.name)) continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const stats = statSync(fullPath);
      const rel = relative(directory, fullPath).replace(/\\/g, "/");
      if (!isSourceFile(rel, stats.size)) continue;
      files.push({
        path: rel,
        content: readFileSync(fullPath, "utf8"),
        size: stats.size,
      });
    }
  }

  walk(directory);
  return files;
}

export function listProjects() {
  return loadStore().projects.map((project) => ({
    id: project.id,
    name: project.name,
    source: project.source,
    createdAt: project.createdAt,
    summary: project.summary,
  }));
}

export function getProject(id) {
  return loadStore().projects.find((project) => project.id === id);
}
