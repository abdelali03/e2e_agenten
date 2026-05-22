const form = document.querySelector("#goalForm");
const results = document.querySelector("#results");
const runButton = document.querySelector("#runButton");
const statusPill = document.querySelector("#statusPill");
const logConsole = document.querySelector("#logConsole");
const activeAgent = document.querySelector("#activeAgent");
const agentStrip = document.querySelector("#agentStrip");
const modeInput = document.querySelector("#mode");
const modeLabel = document.querySelector("#modeLabel");
const modeGrid = document.querySelector("#modeGrid");

const metricEvents = document.querySelector("#metricEvents");
const metricAgents = document.querySelector("#metricAgents");
const metricWarnings = document.querySelector("#metricWarnings");
const metricErrors = document.querySelector("#metricErrors");

const modeNames = {
  adaptive: "Deterministic Multi-Agent",
  "all-llm-mcp": "Single-Agent Playwright MCP",
  "mcp-multi-agent": "Multi-Agent MCP + LangGraph",
};

const logEvents = [];
const agentState = new Map();

connectLogs();
bindModeCards();
updateMetrics();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    mode: valueOf("mode"),
    goal: valueOf("goal"),
    url: valueOf("url"),
    context: valueOf("context"),
    testData: {},
  };

  setRunning(true);
  clearLogs();
  renderLoading(payload.mode);

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "Test run failed");
    }

    renderResult(body, payload.mode);
    setStatus(body.status);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
    setStatus("failed");
  } finally {
    setRunning(false);
  }
});

function bindModeCards() {
  modeGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".mode-card");
    if (!card) return;

    const mode = card.dataset.mode;
    modeInput.value = mode;
    modeLabel.value = modeNames[mode] || mode;

    document
      .querySelectorAll(".mode-card")
      .forEach((item) => item.classList.toggle("active", item === card));
  });
}

function valueOf(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function connectLogs() {
  if (!window.EventSource) {
    appendSystemLog("warn", "Browser", "Live logs are not supported by this browser.");
    return;
  }

  const events = new EventSource("/api/events");

  events.addEventListener("log", (event) => {
    appendLog(JSON.parse(event.data));
  });

  events.onerror = () => {
    appendSystemLog("warn", "Ui", "Live log connection interrupted. Reconnecting...");
  };
}

function clearLogs() {
  logEvents.length = 0;
  agentState.clear();
  logConsole.innerHTML = "";
  activeAgent.textContent = "Startet";
  agentStrip.innerHTML = "";
  updateMetrics();
}

function appendSystemLog(level, context, message) {
  appendLog({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
  });
}

function appendLog(entry) {
  logEvents.push(entry);

  if (logEvents.length > 500) {
    logEvents.shift();
    logConsole.firstElementChild?.remove();
  }

  updateAgents(entry);
  updateMetrics();

  const row = document.createElement("div");
  row.className = `log-row ${entry.level}`;
  row.innerHTML = `
    <span class="log-time">${formatTime(entry.timestamp)}</span>
    <span class="log-context">${escapeHtml(entry.context)}</span>
    <span class="log-level">${escapeHtml(entry.level.toUpperCase())}</span>
    <span class="log-message">${escapeHtml(formatLogMessage(entry))}</span>
  `;
  logConsole.appendChild(row);
  logConsole.scrollTop = logConsole.scrollHeight;
}

function updateAgents(entry) {
  const context = entry.context || "Unknown";
  agentState.set(context, {
    level: entry.level,
    timestamp: entry.timestamp,
    message: entry.message,
  });

  activeAgent.textContent = context;

  agentStrip.innerHTML = Array.from(agentState.entries())
    .slice(-14)
    .map(
      ([name, state]) => `
        <div class="agent-chip ${state.level}">
          <div class="agent-dot"></div>
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(shortMessage(state.message, 84))}</span>
        </div>
      `
    )
    .join("");
}

function updateMetrics() {
  metricEvents.textContent = String(logEvents.length);
  metricAgents.textContent = String(agentState.size);
  metricWarnings.textContent = String(logEvents.filter((e) => e.level === "warn").length);
  metricErrors.textContent = String(logEvents.filter((e) => e.level === "error").length);
}

function formatLogMessage(entry) {
  const meta = entry.meta === undefined ? "" : ` ${safeStringify(entry.meta)}`;
  return `${entry.message}${meta}`;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shortMessage(value, max = 64) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setRunning(isRunning) {
  runButton.disabled = isRunning;
  runButton.textContent = isRunning ? "Agenten laufen..." : "Test starten";

  if (isRunning) {
    statusPill.textContent = "Laeuft";
    statusPill.className = "running";
  }
}

function setStatus(status) {
  statusPill.textContent = statusLabel(status);
  statusPill.className = status;
}

function statusLabel(status) {
  if (status === "passed") return "Bestanden";
  if (status === "blocked") return "Blockiert";
  if (status === "failed") return "Fehlgeschlagen";
  return "Bereit";
}

function renderLoading(mode) {
  results.innerHTML = `
    <div class="run-card loading">
      <div>
        <span class="run-kicker">${escapeHtml(modeNames[mode] || mode)}</span>
        <strong>Agenten arbeiten</strong>
        <p>Browser wird gesteuert. MCP- und LLM-basierte Modi koennen einige Minuten dauern.</p>
      </div>
      <div class="pulse-ring"></div>
    </div>
  `;
}

function renderResult(result, mode) {
  const history = Array.isArray(result.history) ? result.history : [];
  const verification = result.verification;
  const succeeded = history.filter((entry) => entry.success).length;
  const failed = history.length - succeeded;
  const metrics = result.metrics || {};

  results.innerHTML = `
    <div class="summary-card">
      <div class="summary-head">
        <div>
          <span class="run-kicker">${escapeHtml(modeNames[mode] || mode)}</span>
          <strong>${escapeHtml(result.goal || "Goal run")}</strong>
          <p>${escapeHtml(result.finalSummary || result.errorMessage || "Run abgeschlossen.")}</p>
        </div>
        <div class="result-badge ${result.status}">${statusLabel(result.status)}</div>
      </div>

      <div class="run-metrics">
        <div><span>Success</span><strong>${succeeded}</strong></div>
        <div><span>Failed</span><strong>${failed}</strong></div>
        <div><span>Total</span><strong>${history.length}</strong></div>
        <div><span>Tool Calls</span><strong>${metrics.toolCalls ?? "-"}</strong></div>
      </div>

      ${
        verification
          ? `<div class="verification">
              <span>Verification</span>
              <strong>${escapeHtml(verification.confidence)} · complete=${escapeHtml(verification.isComplete)}</strong>
            </div>`
          : ""
      }

      ${renderHistory(history)}
    </div>
  `;
}

function renderHistory(history) {
  if (history.length === 0) {
    return `<div class="empty-state compact"><strong>Keine Schritte aufgezeichnet.</strong></div>`;
  }

  return `
    <ol class="history">
      ${history
        .slice(-18)
        .map((entry, index) => {
          const title =
            entry.instruction ||
            entry.actionPerformed ||
            [entry.phase, entry.agentName, entry.toolName].filter(Boolean).join(" · ") ||
            entry.command?.actionType ||
            "Schritt";
          const detail =
            entry.urlAfter ||
            entry.reasoning ||
            entry.resultText ||
            (entry.arguments ? JSON.stringify(entry.arguments) : "");

          return `
            <li>
              <div class="step-status ${entry.success ? "ok" : "fail"}">${
                entry.success ? "OK" : "FAIL"
              }</div>
              <div class="step-text">
                <strong>${escapeHtml(entry.index || index + 1)}. ${escapeHtml(title)}</strong>
                <span>${escapeHtml(shortMessage(detail || "", 220))}</span>
                ${
                  entry.errorMessage
                    ? `<span class="step-error">${escapeHtml(shortMessage(entry.errorMessage, 220))}</span>`
                    : ""
                }
              </div>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

function renderError(message) {
  results.innerHTML = `
    <div class="summary-card">
      <div class="summary-head">
        <div>
          <span class="run-kicker">Run Error</span>
          <strong>Test konnte nicht gestartet werden.</strong>
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="result-badge failed">Fehlgeschlagen</div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
