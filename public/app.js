const form = document.querySelector("#goalForm");
const results = document.querySelector("#results");
const runButton = document.querySelector("#runButton");
const statusPill = document.querySelector("#statusPill");
const logConsole = document.querySelector("#logConsole");
const activeAgent = document.querySelector("#activeAgent");
const agentStrip = document.querySelector("#agentStrip");
const logEvents = [];
const agentState = new Map();

connectLogs();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    goal: valueOf("goal"),
    url: valueOf("url"),
    context: valueOf("context"),
    testData: {},
  };

  setRunning(true);
  clearLogs();
  renderLoading();

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

    renderResult(body);
    setStatus(body.status);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
    setStatus("failed");
  } finally {
    setRunning(false);
  }
});

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

  if (logEvents.length > 300) {
    logEvents.shift();
    logConsole.firstElementChild?.remove();
  }

  updateAgents(entry);

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
    .slice(-10)
    .map(
      ([name, state]) => `
        <div class="agent-chip ${state.level}">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(shortMessage(state.message))}</span>
        </div>
      `
    )
    .join("");
}

function formatLogMessage(entry) {
  const meta =
    entry.meta === undefined ? "" : ` ${safeStringify(entry.meta)}`;

  return `${entry.message}${meta}`;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shortMessage(value) {
  const text = String(value || "");
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
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
  runButton.textContent = isRunning ? "Test laeuft..." : "Test starten";

  if (isRunning) {
    statusPill.textContent = "Laeuft";
    statusPill.className = "status-pill running";
  }
}

function setStatus(status) {
  statusPill.textContent = statusLabel(status);
  statusPill.className = `status-pill ${status}`;
}

function statusLabel(status) {
  if (status === "passed") return "Bestanden";
  if (status === "blocked") return "Blockiert";
  if (status === "failed") return "Fehlgeschlagen";
  return "Bereit";
}

function renderLoading() {
  results.innerHTML = `
    <div class="empty-state">
      <strong>Der Agent arbeitet.</strong>
      <span>Browser wird gesteuert, der Lauf kann je nach LLM-Antwortzeit einige Minuten dauern.</span>
    </div>
  `;
}

function renderResult(result) {
  const history = Array.isArray(result.history) ? result.history : [];
  const verification = result.verification;
  const succeeded = history.filter((entry) => entry.success).length;

  results.innerHTML = `
    <div class="summary">
      <div class="summary-head">
        <div class="summary-title">
          <strong>${escapeHtml(result.goal || "Goal run")}</strong>
          <span>${succeeded}/${history.length} Aktionen erfolgreich${
            verification
              ? ` · Verifikation: ${verification.confidence}, complete=${verification.isComplete}`
              : ""
          }</span>
        </div>
        <div class="result-badge ${result.status}">${statusLabel(result.status)}</div>
      </div>
      ${
        result.errorMessage
          ? `<p class="error-text">${escapeHtml(result.errorMessage)}</p>`
          : ""
      }
      ${renderHistory(history)}
    </div>
  `;
}

function renderHistory(history) {
  if (history.length === 0) {
    return `<div class="empty-state"><strong>Keine Aktionen aufgezeichnet.</strong></div>`;
  }

  return `
    <ol class="history">
      ${history
        .map(
          (entry) => `
            <li>
              <div class="step-status ${entry.success ? "ok" : "fail"}">${
                entry.success ? "OK" : "FAIL"
              }</div>
              <div class="step-text">
                <strong>${entry.index}. ${escapeHtml(entry.instruction)}</strong>
                <span>${escapeHtml(entry.urlAfter || "")}</span>
                ${
                  entry.errorMessage
                    ? `<span>${escapeHtml(entry.errorMessage)}</span>`
                    : ""
                }
              </div>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function renderError(message) {
  results.innerHTML = `
    <div class="summary">
      <div class="summary-head">
        <div class="summary-title">
          <strong>Test konnte nicht gestartet werden.</strong>
          <span>${escapeHtml(message)}</span>
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
