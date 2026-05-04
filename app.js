const state = {
  projects: [],
  activeProject: null,
  activeProjectDetail: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setLoading(message) {
  toast(message);
}

function renderStats(project) {
  const stats = $("#stats");
  if (!project) {
    stats.innerHTML = "";
    return;
  }

  stats.innerHTML = `
    <div class="stat"><strong>${project.summary.totalFiles}</strong><span>files</span></div>
    <div class="stat"><strong>${project.summary.totalLines}</strong><span>lines</span></div>
    <div class="stat"><strong>${project.summary.languages.length}</strong><span>types</span></div>
  `;
}

function renderProjects() {
  const list = $("#projectList");
  if (!state.projects.length) {
    list.innerHTML = `<div class="project-meta">Run the instant demo or upload a ZIP to begin.</div>`;
    return;
  }

  list.innerHTML = state.projects
    .map(
      (project) => `
      <button class="project-item ${state.activeProject === project.id ? "active" : ""}" data-project="${project.id}">
        <div class="project-name">${project.name}</div>
        <div class="project-meta">${project.source} · ${project.summary.totalFiles} files</div>
      </button>
    `,
    )
    .join("");

  $$(".project-item").forEach((button) => {
    button.addEventListener("click", () => selectProject(button.dataset.project));
  });
}

function renderProjectHeader(project) {
  $("#projectTitle").textContent = project ? project.name : "No project indexed yet";
  renderStats(project);
}

async function refreshProjects() {
  const data = await api("/api/projects");
  state.projects = data.projects;
  if (!state.activeProject && state.projects[0]) {
    await selectProject(state.projects[0].id);
  }
  renderProjects();
}

async function selectProject(id) {
  const data = await api(`/api/projects/${id}`);
  state.activeProject = id;
  state.activeProjectDetail = data.project;
  renderProjects();
  renderProjectHeader(data.project);
  await Promise.all([loadArchitecture(), loadDocs(), loadRisks()]);
}

async function runSelfScan() {
  setLoading("Indexing RepoKosha AI itself...");
  const data = await api("/api/projects/scan-self", { method: "POST" });
  state.activeProject = data.project.id;
  await refreshProjects();
  await selectProject(data.project.id);
  toast("RepoKosha AI indexed successfully.");
}

function ensureProject() {
  if (!state.activeProject) {
    toast("Index a project first.");
    return false;
  }
  return true;
}

function addMessage(text, type = "assistant") {
  const messages = $("#messages");
  const div = document.createElement("div");
  div.className = type === "user" ? "user-message" : "assistant-message";
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function renderCitations(citations = []) {
  const list = $("#citations");
  if (!citations.length) {
    list.innerHTML = `<div class="project-meta">No citations yet.</div>`;
    return;
  }

  list.innerHTML = citations
    .map(
      (citation) => `
      <article class="citation-card">
        <code>${citation.path}:${citation.lines}</code>
        <div class="project-meta">relevance ${citation.score}</div>
        ${citation.snippet ? `<pre>${escapeHtml(citation.snippet)}</pre>` : ""}
      </article>
    `,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function askQuestion(question) {
  if (!ensureProject()) return;
  addMessage(question, "user");
  const data = await api(`/api/projects/${state.activeProject}/chat`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
  addMessage(data.answer);
  renderCitations(data.citations);
}

async function loadArchitecture() {
  if (!state.activeProject) return;
  const data = await api(`/api/projects/${state.activeProject}/architecture`);
  $("#architectureOutput").innerHTML = `
    <article class="insight-card">
      <h3>System Overview</h3>
      <p>${data.overview}</p>
    </article>
    <article class="insight-card">
      <h3>Module Map</h3>
      <div class="node-grid">
        ${data.nodes
          .map(
            (node) => `
            <div class="node">
              <strong>${node.label}</strong>
              <div class="project-meta">${node.role} · ${node.weight} files</div>
            </div>
          `,
          )
          .join("")}
      </div>
    </article>
    <article class="insight-card">
      <h3>Responsibilities</h3>
      ${data.responsibilities
        .map((item) => `<p><strong>${item.label}</strong><br><code>${item.files.slice(0, 4).join(", ")}</code></p>`)
        .join("")}
    </article>
  `;
}

async function loadDocs() {
  if (!state.activeProject) return;
  const data = await api(`/api/projects/${state.activeProject}/docs`);
  $("#docsOutput").innerHTML = `
    <h3>${data.title}</h3>
    <p>${data.summary}</p>
    <h4>Stack Signals</h4>
    <div class="pill-row">${(data.stack.length ? data.stack : ["Source code"]).map((item) => `<span class="pill">${item}</span>`).join("")}</div>
    <h4>Setup Flow</h4>
    <ol>${data.setup.map((step) => `<li>${step}</li>`).join("")}</ol>
    <h4>Scripts</h4>
    ${
      data.scripts.length
        ? data.scripts.map((script) => `<p><code>${script.name}</code> ${script.command}</p>`).join("")
        : "<p>No package scripts detected.</p>"
    }
    <h4>Important Files</h4>
    <p><code>${data.importantFiles.join(", ")}</code></p>
  `;
}

async function loadRisks() {
  if (!state.activeProject) return;
  const data = await api(`/api/projects/${state.activeProject}/risks`);
  $("#risksOutput").innerHTML = `
    <article class="risk-card">
      <h3>Repository Health Score: ${data.score}/100</h3>
      <p>${data.recommendation}</p>
    </article>
    ${
      data.risks.length
        ? data.risks
            .map(
              (risk) => `
          <article class="risk-card">
            <h3>${risk.priority} · ${risk.type}</h3>
            <p>${risk.detail}</p>
            <code>${risk.path}:${risk.line}</code>
          </article>
        `,
            )
            .join("")
        : `<article class="risk-card"><h3>No obvious risky markers</h3><p>The indexed source does not contain common credential, task-marker, breakpoint, or silent-catch patterns.</p></article>`
    }
  `;
}

async function generatePlan(feature) {
  if (!ensureProject()) return;
  const data = await api(`/api/projects/${state.activeProject}/plan`, {
    method: "POST",
    body: JSON.stringify({ feature }),
  });

  $("#planOutput").innerHTML = `
    <article class="insight-card">
      <h3>${data.summary}</h3>
      <p><strong>Files to inspect</strong></p>
      <p><code>${data.filesToInspect.join(", ") || "No strong file matches found"}</code></p>
      <p><strong>Steps</strong></p>
      <ol>${data.steps.map((step) => `<li>${step}</li>`).join("")}</ol>
      <p><strong>Risks</strong></p>
      <ol>${data.risks.map((risk) => `<li>${risk}</li>`).join("")}</ol>
    </article>
  `;
}

function bindTabs() {
  $$(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-tab").forEach((tab) => tab.classList.remove("active"));
      $$(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.view}View`).classList.add("active");
    });
  });
}

function bindEvents() {
  $("#selfScanBtn").addEventListener("click", runSelfScan);
  $("#quickDemoBtn").addEventListener("click", runSelfScan);
  $("#refreshProjects").addEventListener("click", refreshProjects);

  $("#zipInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading("Uploading and indexing ZIP...");
    const response = await fetch("/api/projects/upload-zip", {
      method: "POST",
      headers: {
        "content-type": "application/zip",
        "x-project-name": file.name.replace(/\.zip$/i, ""),
      },
      body: await file.arrayBuffer(),
    });
    const data = await response.json();
    if (!response.ok) {
      toast(data.error || "ZIP indexing failed.");
      return;
    }
    state.activeProject = data.project.id;
    await refreshProjects();
    await selectProject(data.project.id);
    toast("ZIP indexed successfully.");
  });

  $("#githubForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = $("#githubUrl").value.trim();
    if (!url) return;
    setLoading("Importing GitHub repository...");
    try {
      const data = await api("/api/projects/github", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      await refreshProjects();
      await selectProject(data.project.id);
      toast("GitHub repo imported.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = $("#questionInput").value.trim();
    if (!question) return;
    $("#questionInput").value = "";
    await askQuestion(question);
  });

  $("#planForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const feature = $("#featureInput").value.trim();
    if (!feature) return;
    await generatePlan(feature);
  });
}

bindTabs();
bindEvents();
refreshProjects().catch((error) => toast(error.message));
