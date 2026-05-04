import { searchProject } from "./search.js";

function topFolders(project) {
  const folders = new Map();
  for (const file of project.files) {
    const folder = file.path.includes("/") ? file.path.split("/")[0] : "root";
    folders.set(folder, (folders.get(folder) || 0) + 1);
  }
  return [...folders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function findFiles(project, patterns) {
  return project.files
    .filter((file) => patterns.some((pattern) => file.path.toLowerCase().includes(pattern)))
    .slice(0, 12)
    .map((file) => file.path);
}

function extractResponsibilities(project) {
  const responsibilities = [];
  const checks = [
    ["Routing and UI screens", ["app/", "pages/", "routes/", "views/"]],
    ["Reusable frontend components", ["components/", "ui/"]],
    ["API and backend handlers", ["api/", "server/", "controllers/", "routes/"]],
    ["Data models and persistence", ["models/", "schema", "database", "db/"]],
    ["Configuration and environment", ["config", ".env", "package.json"]],
    ["Documentation", ["readme", "docs/"]],
    ["Tests and quality checks", ["test", "spec", "__tests__"]],
  ];

  for (const [label, patterns] of checks) {
    const files = findFiles(project, patterns);
    if (files.length) responsibilities.push({ label, files });
  }

  return responsibilities;
}

function snippet(chunk) {
  return chunk.text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 5)
    .join("\n")
    .slice(0, 600);
}

export function answerQuestion(project, question) {
  const hits = searchProject(project, question, 6);
  const files = [...new Set(hits.map((hit) => hit.path))].slice(0, 5);
  const lower = question.toLowerCase();
  const focus =
    lower.includes("auth") ? "authentication and user access flow" :
    lower.includes("api") ? "backend/API behavior" :
    lower.includes("bug") || lower.includes("risk") ? "risk-prone implementation areas" :
    lower.includes("architecture") ? "high-level architecture" :
    "the requested codebase area";

  const answer = [
    `I found the strongest signals for ${focus} in ${files.length ? files.join(", ") : "the indexed files"}.`,
    files.length
      ? "Start with the highest-ranked citations below, then follow imports or route calls from those files."
      : "The query did not match strongly, so try naming a feature, file, folder, API route, or error message.",
    hits.length
      ? "Based on the retrieved context, the implementation appears to be organized around these responsibilities: " +
        extractResponsibilities(project).slice(0, 4).map((item) => item.label).join(", ") + "."
      : "",
  ].filter(Boolean).join(" ");

  return {
    answer,
    citations: hits.map((hit) => ({
      path: hit.path,
      lines: `${hit.startLine}-${hit.endLine}`,
      score: Number(hit.score.toFixed(2)),
      snippet: snippet(hit),
    })),
  };
}

export function buildArchitecture(project) {
  const folders = topFolders(project);
  const responsibilities = extractResponsibilities(project);
  const nodes = folders.map(([folder, count]) => ({
    id: folder,
    label: folder,
    weight: count,
    role:
      folder.includes("server") || folder.includes("api")
        ? "Backend/API"
        : folder.includes("public") || folder.includes("src")
          ? "Frontend/UI"
          : folder.includes("docs")
            ? "Documentation"
            : "Project module",
  }));

  const edges = nodes.slice(1).map((node) => ({
    from: nodes[0]?.id || "root",
    to: node.id,
    label: "belongs to repo",
  }));

  return {
    overview: `${project.name} contains ${project.summary.totalFiles} indexed files across ${folders.length} major areas. The stack signals are ${project.summary.stack.join(", ") || "mixed source files"}.`,
    nodes,
    edges,
    responsibilities,
  };
}

export function buildDocs(project) {
  const packageFile = project.files.find((file) => file.path.endsWith("package.json"));
  const readme = project.files.find((file) => file.path.toLowerCase().includes("readme"));
  const scripts = [];

  if (packageFile) {
    try {
      const parsed = JSON.parse(packageFile.content);
      for (const [name, command] of Object.entries(parsed.scripts || {})) {
        scripts.push({ name, command });
      }
    } catch {
      // Ignore invalid package metadata.
    }
  }

  return {
    title: `${project.name} Documentation Draft`,
    summary: readme
      ? readme.content.split(/\r?\n/).filter(Boolean).slice(0, 5).join(" ")
      : `${project.name} is an indexed software repository with ${project.summary.totalFiles} source files and ${project.summary.totalLines} lines of code.`,
    stack: project.summary.stack,
    scripts,
    setup: [
      "Clone the repository.",
      "Install dependencies listed in the project manifest.",
      "Create environment variables from the example file if present.",
      "Run the development script and open the local URL.",
    ],
    importantFiles: project.files.slice(0, 12).map((file) => file.path),
  };
}

export function buildRiskReport(project) {
  const risks = [];
  const secretPattern = /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{6,}/i;
  const markerPattern = /\b(todo|fixme|hack|temporary)\b|debugger\b/i;
  const broadCatchPattern = /catch\s*\([^)]*\)\s*{\s*}/i;

  for (const file of project.files) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (secretPattern.test(line)) {
        risks.push({
          priority: "High",
          type: "Secret exposure",
          path: file.path,
          line: index + 1,
          detail: "Potential credential-like value found in source.",
        });
      } else if (broadCatchPattern.test(line)) {
        risks.push({
          priority: "Medium",
          type: "Silent failure",
          path: file.path,
          line: index + 1,
          detail: "Empty catch block can hide production errors.",
        });
      } else if (
        !file.path.toLowerCase().endsWith(".md") &&
        !line.includes("markerPattern") &&
        !line.includes("TODO/debug") &&
        markerPattern.test(line)
      ) {
        risks.push({
          priority: "Low",
          type: "Maintainability marker",
          path: file.path,
          line: index + 1,
          detail: "TODO/debug-style marker should be reviewed before release.",
        });
      }
    });
  }

  return {
    score: Math.max(55, 96 - risks.length * 6),
    risks: risks.slice(0, 20),
    recommendation:
      risks.length > 0
        ? "Review high-priority findings first, then convert TODO/debug markers into tracked tasks."
        : "No obvious risky markers were detected in indexed files.",
  };
}

export function buildPlan(project, feature) {
  const query = feature || "new feature";
  const hits = searchProject(project, query, 8);
  const files = [...new Set(hits.map((hit) => hit.path))].slice(0, 6);

  return {
    feature: query,
    summary: `Implementation plan for "${query}" using the most relevant files in ${project.name}.`,
    filesToInspect: files,
    steps: [
      "Confirm the existing flow by reading the cited files and their imports.",
      "Add or update the data contract/API behavior first.",
      "Implement the user-facing UI or integration layer.",
      "Add validation, empty states, and error handling.",
      "Run the relevant manual flow and document any follow-up risks.",
    ],
    risks: [
      "Feature may touch shared modules, so avoid changing unrelated behavior.",
      "If the query matched broad files, inspect route boundaries before editing.",
      "Add regression checks around API responses and user-visible states.",
    ],
    citations: hits.map((hit) => ({
      path: hit.path,
      lines: `${hit.startLine}-${hit.endLine}`,
      score: Number(hit.score.toFixed(2)),
    })),
  };
}
