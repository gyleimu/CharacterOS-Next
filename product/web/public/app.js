/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — framework-free browser client.
 *
 * This file holds PRESENTATION state only (draft input, the session message
 * list, the last fetched views, stage progress, connection state). It is never
 * authoritative for Memory, Belief, Personality, Relationship, Affect, canonical
 * Time, subject identity or canonical revisions: every value comes from the
 * local backend, and every mutation is a backend request followed by a re-fetch.
 *
 * Nothing about the subject is written to localStorage/sessionStorage/IndexedDB.
 */

const state = {
  subjectName: "Subject",
  messages: [],
  stages: new Map(),
  stageOrder: [],
  sending: false
};

const el = {
  providerDot: document.getElementById("provider-dot"),
  providerText: document.getElementById("provider-text"),
  banner: document.getElementById("connection-banner"),
  avatar: document.getElementById("avatar"),
  name: document.getElementById("subject-name"),
  id: document.getElementById("subject-id"),
  status: document.getElementById("subject-status"),
  affect: document.getElementById("fact-affect"),
  time: document.getElementById("fact-time"),
  episodes: document.getElementById("fact-episodes"),
  stateBody: document.getElementById("state-body"),
  messages: document.getElementById("messages"),
  stages: document.getElementById("stages"),
  composer: document.getElementById("composer"),
  input: document.getElementById("input"),
  send: document.getElementById("send"),
  life: document.getElementById("life")
};

async function api(path, options) {
  const response = await fetch(path, options);
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || body === null || body.ok !== true) {
    const message =
      body && typeof body.message === "string"
        ? body.message
        : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return body;
}

function setProvider(ready, label) {
  el.providerDot.className = `dot ${ready ? "dot-ok" : "dot-bad"}`;
  el.providerText.textContent = label;
}

function showBanner(text) {
  if (text === null) {
    el.banner.classList.add("banner-hidden");
    el.banner.textContent = "";
    return;
  }
  el.banner.textContent = text;
  el.banner.classList.remove("banner-hidden");
}

function renderIdentity(bootstrap) {
  const identity = bootstrap.identity;
  state.subjectName = identity.display_name.trim().length > 0 ? identity.display_name : identity.subject_id;
  el.name.textContent = state.subjectName;
  el.id.textContent = identity.subject_id;
  el.avatar.textContent = state.subjectName.slice(0, 1).toUpperCase();
  const statusLabel =
    bootstrap.status === "RESTORED"
      ? "RESTORED — same subject"
      : bootstrap.created_this_start
        ? "NEW — created"
        : "NEW — no lived history yet";
  el.status.textContent = statusLabel;
  el.affect.textContent = `valence ${fmt(bootstrap.affect.valence)}, activation ${fmt(bootstrap.affect.activation)}`;
  el.time.textContent = `${bootstrap.logical_time} canonical ticks`;
  el.episodes.textContent = String(bootstrap.recent_memory.total_episode_count);
  setProvider(bootstrap.provider.ready, `Provider: ${bootstrap.provider.ready ? "READY" : "unavailable"} · ${bootstrap.provider.model}`);
}

function fmt(value) {
  return typeof value === "number" ? value.toFixed(2) : String(value);
}

function renderState(stateView) {
  const state_ = stateView.state;
  const groups = [];

  groups.push([
    "Affect",
    [
      ["valence", fmt(state_.affect.valence)],
      ["activation", fmt(state_.affect.activation)]
    ]
  ]);
  groups.push([
    "Regulation",
    [
      ["energy", fmt(state_.regulation.energy)],
      ["stress", fmt(state_.regulation.stress)],
      ["arousal", fmt(state_.regulation.arousal)],
      ["fatigue", fmt(state_.regulation.fatigue)]
    ]
  ]);
  groups.push([
    "Personality",
    state_.personality.length === 0
      ? null
      : state_.personality.map((d) => [d.dimension_id, fmt(d.value)])
  ]);
  groups.push([
    "Beliefs",
    state_.beliefs.length === 0
      ? null
      : state_.beliefs.map((b) => [b.proposition_label, `endorsement ${fmt(b.credence)}`])
  ]);
  groups.push([
    "Relationships",
    state_.relationships.length === 0
      ? null
      : state_.relationships.flatMap((r) =>
          r.dimensions.length === 0
            ? [[r.counterpart_ref, "ABSENT"]]
            : r.dimensions.map((d) => [`${r.counterpart_ref} · ${d.dimension_id}`, fmt(d.value)])
        )
  ]);

  el.stateBody.textContent = "";
  for (const [title, rows] of groups) {
    const group = document.createElement("div");
    group.className = "state-group";
    const heading = document.createElement("h4");
    heading.textContent = title;
    group.appendChild(heading);
    if (rows === null) {
      const absent = document.createElement("div");
      absent.className = "absent";
      absent.textContent = "ABSENT";
      group.appendChild(absent);
    } else {
      for (const [label, value] of rows) {
        const row = document.createElement("div");
        row.className = "state-row";
        const dt = document.createElement("span");
        dt.textContent = label;
        const dd = document.createElement("span");
        dd.textContent = value;
        row.append(dt, dd);
        group.appendChild(row);
      }
    }
    el.stateBody.appendChild(group);
  }
  el.time.textContent = `${state_.logical_time} canonical ticks`;
}

function renderLife(memory) {
  el.life.textContent = "";
  const total = memory.total_episode_count;
  if (total === 0) {
    const empty = document.createElement("p");
    empty.className = "absent";
    empty.textContent = "No lived episodes yet. Say something to begin this subject's life.";
    el.life.appendChild(empty);
    el.episodes.textContent = "0";
    return;
  }
  el.episodes.textContent = String(total);
  const header = document.createElement("p");
  header.className = "note";
  header.textContent =
    total > memory.displayed_count
      ? `Showing the ${memory.displayed_count} most recent of ${total} lived episodes.`
      : `${total} lived episode${total === 1 ? "" : "s"}.`;
  el.life.appendChild(header);

  for (const entry of memory.entries) {
    const box = document.createElement("div");
    box.className = "life-entry";
    const kind = document.createElement("div");
    kind.className = "life-kind";
    const body = document.createElement("div");
    body.className = "life-text";
    const meta = document.createElement("div");
    meta.className = "life-meta";

    if (entry.kind === "OBSERVATION") {
      kind.textContent = "EXTERNAL OBSERVATION";
      body.textContent = entry.scene;
    } else {
      kind.textContent = "CONVERSATION";
      const said = document.createElement("div");
      said.className = "life-quote";
      said.textContent = `${state.subjectName} said: “${entry.delivered_behavior_text}”`;
      const replied = document.createElement("div");
      replied.textContent = `You replied: “${entry.outcome_reply_text}”`;
      body.append(said, replied);
    }
    meta.textContent = `occurred at canonical tick ${entry.occurrence_logical_time}`;
    box.append(kind, body, meta);
    el.life.appendChild(box);
  }
}

function renderMessages() {
  el.messages.textContent = "";
  for (const message of state.messages) {
    const box = document.createElement("div");
    box.className = `msg ${message.role === "user" ? "msg-user" : "msg-subject"}`;
    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = message.role === "user" ? "You" : state.subjectName;
    const text = document.createElement("span");
    text.textContent = message.text;
    box.append(label, text);
    el.messages.appendChild(box);
  }
  el.messages.scrollTop = el.messages.scrollHeight;
}

function renderFailure(turn) {
  const failure = turn.failure;
  const box = document.createElement("div");
  box.className = "failure";
  const heading = document.createElement("h3");
  heading.textContent = `The turn failed during ${failure && failure.stage ? failure.stage : "an unknown stage"}`;
  const list = document.createElement("dl");
  const rows = [
    ["Persistence", failure ? failure.persistence : "UNKNOWN"],
    ["Reason", failure ? failure.category : "UNKNOWN"],
    ["Suggested action", failure ? failure.suggested_action : "Relaunch from durable state."],
    ["Pending lifecycle work", failure ? String(failure.pending_lifecycle_work) : "unknown"]
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  }
  box.append(heading, list);
  el.messages.appendChild(box);
  el.messages.scrollTop = el.messages.scrollHeight;
}

/**
 * Stage chips are keyed by group + stage + position, because the SAME stage can
 * legitimately appear twice in one turn (this turn's appraisal, then the
 * previous reply's appraisal) and each is a distinct step.
 */
function stageKey(group, stage, index) {
  return `${group ?? "NONE"}:${stage}:${index ?? 0}`;
}

function planStageKeys(event) {
  const plan = event.plan;
  const entries = [];
  plan.reply_stages.forEach((stage, index) => {
    entries.push({ key: stageKey("REPLY", stage, index + 1), label: stage });
  });
  plan.prior_reply_stages.forEach((stage, index) => {
    entries.push({ key: stageKey("PRIOR_REPLY", stage, index + 1), label: `${stage} (previous reply)` });
  });
  const adaptationTotal = plan.adaptation_stages.length + plan.untimed_adaptation_stages.length;
  plan.adaptation_stages.forEach((stage, index) => {
    entries.push({ key: stageKey("ADAPTATION", stage, index + 1), label: `${stage} (${index + 1}/${adaptationTotal})` });
  });
  plan.untimed_adaptation_stages.forEach((stage, index) => {
    entries.push({
      key: stageKey("ADAPTATION", stage, plan.adaptation_stages.length + index + 1),
      label: `${stage} (${plan.adaptation_stages.length + index + 1}/${adaptationTotal} · untimed)`
    });
  });
  return entries;
}

function renderStages() {
  el.stages.textContent = "";
  for (const key of state.stageOrder) {
    const entry = state.stages.get(key);
    const chip = document.createElement("span");
    chip.className = `stage stage-${entry.status.toLowerCase()}`;
    const latency =
      typeof entry.latency_ms === "number" ? ` · ${(entry.latency_ms / 1000).toFixed(1)} s` : "";
    chip.textContent = `${entry.label} · ${entry.status}${latency}`;
    el.stages.appendChild(chip);
  }
}

function onProgress(event) {
  if (event.type === "TURN_PLAN") {
    state.stages.clear();
    state.stageOrder = [];
    for (const { key, label } of planStageKeys(event)) {
      if (state.stages.has(key)) continue;
      state.stages.set(key, { label, status: "PENDING" });
      state.stageOrder.push(key);
    }
    renderStages();
    return;
  }
  if (event.stage === undefined) return;
  const key = stageKey(event.group, event.stage, event.index);
  const existing = state.stages.get(key);
  const label = existing === undefined ? event.stage : existing.label;
  const statusByType = {
    STAGE_RUNNING: "RUNNING",
    STAGE_SUCCEEDED: "DONE",
    STAGE_FAILED: "FAILED",
    STAGE_SKIPPED: "SKIPPED",
    STAGE_REPORTED: event.status === "DISABLED" ? "DISABLED" : event.status === "SKIPPED" ? "SKIPPED" : "DONE"
  };
  const status = statusByType[event.type];
  if (status === undefined) return;
  state.stages.set(key, {
    label,
    status,
    ...(typeof event.latency_ms === "number" ? { latency_ms: event.latency_ms } : {})
  });
  if (!state.stageOrder.includes(key)) state.stageOrder.push(key);
  renderStages();
}

async function refreshViews() {
  const [bootstrap, stateView, memory] = await Promise.all([
    api("/api/bootstrap"),
    api("/api/state"),
    api("/api/memory?limit=10")
  ]);
  renderIdentity(bootstrap.bootstrap);
  renderState(stateView.view);
  renderLife(memory.memory);
}

function connectEvents() {
  const source = new EventSource("/api/events");
  source.onopen = () => {
    showBanner(null);
    setProvider(true, el.providerText.textContent.replace("connecting…", "READY"));
  };
  source.onmessage = (message) => {
    try {
      onProgress(JSON.parse(message.data));
    } catch {
      // Ignore malformed frames; the backend never sends prompts or user text.
    }
  };
  source.onerror = () => {
    showBanner("Progress stream disconnected — reconnecting. Subject state is unaffected.");
    void refreshViews().catch(() => undefined);
  };
  return source;
}

async function sendMessage(text) {
  if (state.sending) return;
  state.sending = true;
  el.send.disabled = true;
  state.messages.push({ role: "user", text });
  renderMessages();
  try {
    const body = await api("/api/talk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    const turn = body.turn;
    if (turn.status === "COMPLETE" && typeof turn.reply_text === "string") {
      state.messages.push({ role: "subject", text: turn.reply_text });
      renderMessages();
    } else {
      renderFailure(turn);
    }
    await refreshViews();
  } catch (error) {
    showBanner(error instanceof Error ? error.message : "The turn could not be sent.");
    await refreshViews().catch(() => undefined);
  } finally {
    state.sending = false;
    el.send.disabled = false;
    el.input.focus();
  }
}

el.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = el.input.value.trim();
  if (text.length === 0) return;
  el.input.value = "";
  void sendMessage(text);
});

// --- World & settings drawer (secondary; hidden by default) -------------------
// Everything here calls the existing bounded product operations. The drawer is
// never authoritative: after any mutation it re-fetches authoritative views.

const drawer = {
  panel: document.getElementById("drawer"),
  toggle: document.getElementById("drawer-toggle"),
  close: document.getElementById("drawer-close"),
  refresh: document.getElementById("refresh-read-views"),
  observationForm: document.getElementById("observation-form"),
  observationResult: document.getElementById("observation-result"),
  environmentForm: document.getElementById("environment-form"),
  environmentResult: document.getElementById("environment-result"),
  timeForm: document.getElementById("time-form"),
  timeResult: document.getElementById("time-result"),
  configView: document.getElementById("config-view"),
  diagnosticsView: document.getElementById("diagnostics-view"),
  loaded: false
};

function setDrawerOpen(open) {
  drawer.panel.hidden = !open;
  drawer.toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (open && !drawer.loaded) {
    drawer.loaded = true;
    void refreshReadOnlyViews();
  }
}

function setResult(target, tone, text, details) {
  target.textContent = "";
  target.className = `result result-${tone}`;
  const strong = document.createElement("strong");
  strong.textContent = text;
  target.appendChild(strong);
  if (details !== undefined) {
    const summary = document.createElement("details");
    const caption = document.createElement("summary");
    caption.textContent = "Details";
    const body = document.createElement("div");
    body.className = "kv";
    for (const [label, value] of Object.entries(details)) {
      const row = document.createElement("div");
      row.className = "kv-row";
      const key = document.createElement("span");
      key.textContent = label;
      const val = document.createElement("span");
      val.textContent = String(value);
      row.append(key, val);
      body.appendChild(row);
    }
    summary.append(caption, body);
    target.appendChild(summary);
  }
}

async function readProductResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: response.ok && body !== null && body.ok === true, status: response.status, body };
}

function failureMessage(body, status) {
  if (body && typeof body.message === "string") return body.message;
  return `Request failed (${status}).`;
}

async function refreshReadOnlyViews() {
  try {
    const [config, diagnostics] = await Promise.all([api("/api/config"), api("/api/diagnostics")]);
    renderConfig(config.config);
    renderDiagnostics(diagnostics.diagnostics);
  } catch (error) {
    setResult(drawer.configView, "bad", error instanceof Error ? error.message : "Read-only views unavailable.");
  }
}

function kvRow(label, value) {
  const row = document.createElement("div");
  row.className = "kv-row";
  const key = document.createElement("span");
  key.textContent = label;
  const val = document.createElement("span");
  val.textContent = value;
  row.append(key, val);
  return row;
}

function renderConfig(config) {
  drawer.configView.textContent = "";
  if (config === null || config === undefined) {
    drawer.configView.appendChild(kvRow("Configuration", "unavailable"));
    return;
  }
  const settings = [
    ["Model", config.model],
    ["Endpoint", config.endpoint],
    ["Timeout", config.timeout_ms],
    ["Context window tokens", config.context_window_tokens],
    ["Max output tokens", config.num_predict],
    ["Data root", config.data_root]
  ];
  for (const [label, entry] of settings) {
    const group = document.createElement("div");
    group.className = "kv-group";
    group.appendChild(kvRow(label, entry.value));
    const source = document.createElement("div");
    source.className = "kv-sub";
    source.textContent = `source: ${entry.source} (${entry.origin})`;
    group.appendChild(source);
    drawer.configView.appendChild(group);
  }
  const subject = document.createElement("div");
  subject.className = "kv-group";
  subject.appendChild(kvRow("Subject", `${config.subject.display_name} (${config.subject.subject_id})`));
  const subjectSource = document.createElement("div");
  subjectSource.className = "kv-sub";
  subjectSource.textContent = `source: ${config.subject.identity_source} (${config.subject.identity_origin})`;
  subject.appendChild(subjectSource);
  drawer.configView.appendChild(subject);
  const readOnly = document.createElement("div");
  readOnly.className = "note";
  readOnly.textContent = "Read-only: this drawer never changes configuration.";
  drawer.configView.appendChild(readOnly);
}

function renderDiagnostics(diagnostics) {
  drawer.diagnosticsView.textContent = "";
  if (diagnostics === null || diagnostics === undefined) {
    drawer.diagnosticsView.appendChild(kvRow("Diagnostics", "unavailable"));
    return;
  }
  drawer.diagnosticsView.appendChild(kvRow("Model", diagnostics.model));
  drawer.diagnosticsView.appendChild(kvRow("Configured timeout", `${diagnostics.timeout_ms} ms`));
  for (const record of diagnostics.stages) {
    const group = document.createElement("div");
    group.className = "kv-group";
    const latency = typeof record.latency_ms === "number" ? ` · ${(record.latency_ms / 1000).toFixed(1)} s` : "";
    group.appendChild(kvRow(record.stage, `${record.status}${latency}`));
    const detail = record.category ?? record.detail;
    if (detail !== null && detail !== undefined) {
      const sub = document.createElement("div");
      sub.className = "kv-sub";
      sub.textContent = String(detail);
      group.appendChild(sub);
    }
    drawer.diagnosticsView.appendChild(group);
  }
  if (Array.isArray(diagnostics.samples) && diagnostics.samples.length > 0) {
    const samples = document.createElement("div");
    samples.className = "kv-group";
    samples.appendChild(kvRow("Local samples", "process-local (reset on restart)"));
    for (const sample of diagnostics.samples) {
      const sub = document.createElement("div");
      sub.className = "kv-sub";
      sub.textContent = `${sample.stage}: last ${(sample.last_ms / 1000).toFixed(1)} s (${sample.count})`;
      samples.appendChild(sub);
    }
    drawer.diagnosticsView.appendChild(samples);
  }
  if (diagnostics.last_turn !== null && diagnostics.last_turn !== undefined) {
    const turn = diagnostics.last_turn;
    const group = document.createElement("div");
    group.className = "kv-group";
    group.appendChild(kvRow("Last turn", `${turn.status} · provider ${(turn.provider_ms / 1000).toFixed(1)} s`));
    const sub = document.createElement("div");
    sub.className = "kv-sub";
    sub.textContent =
      `reply ${(turn.reply_ms / 1000).toFixed(1)} s` +
      (turn.prior_reply_ms > 0 ? ` · prior-reply ${(turn.prior_reply_ms / 1000).toFixed(1)} s` : "") +
      ` · adaptation ${(turn.adaptation_ms / 1000).toFixed(1)} s` +
      (turn.skipped.length > 0 ? ` · skipped ${turn.skipped.join(", ")}` : "");
    group.appendChild(sub);
    drawer.diagnosticsView.appendChild(group);
  }
  const note = document.createElement("div");
  note.className = "note";
  note.textContent = "No prompts, user text or Memory content are exposed here.";
  drawer.diagnosticsView.appendChild(note);
}

drawer.toggle.addEventListener("click", () => setDrawerOpen(drawer.panel.hidden));
drawer.close.addEventListener("click", () => setDrawerOpen(false));
drawer.refresh.addEventListener("click", () => void refreshReadOnlyViews());

drawer.observationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitObservation();
});

async function submitObservation() {
  const payload = {
    source: document.getElementById("obs-source").value.trim(),
    event: document.getElementById("obs-event").value.trim(),
    entities: document.getElementById("obs-entities").value.trim(),
    scene: document.getElementById("obs-scene").value.trim(),
    task: document.getElementById("obs-task").value.trim()
  };
  const response = await fetch("/api/observation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const { ok, status, body } = await readProductResponse(response);
  if (!ok) {
    setResult(drawer.observationResult, "bad", "Not accepted.", { reason: failureMessage(body, status) });
    return;
  }
  const outcome = body.outcome;
  if (outcome.kind === "FIRST") {
    setResult(drawer.observationResult, "ok", "External observation recorded.", {
      observation_ref: outcome.observation_ref,
      episode_ref: outcome.episode_ref,
      base_revision: outcome.base_revision
    });
  } else if (outcome.kind === "REPLAY") {
    setResult(drawer.observationResult, "warn", "Already recorded — no new lived experience.", {
      observation_ref: outcome.observation_ref,
      base_revision: outcome.base_revision
    });
  } else if (outcome.kind === "CONFLICT") {
    setResult(drawer.observationResult, "bad", "Refused: the same event identity arrived with different content.", {
      detail: outcome.detail
    });
  } else {
    setResult(drawer.observationResult, "bad", "Not accepted.", { detail: outcome.detail });
    return;
  }
  await refreshViews();
}

drawer.environmentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitEnvironment();
});

async function submitEnvironment() {
  const count = Number.parseInt(document.getElementById("env-count").value, 10);
  const response = await fetch("/api/environment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count })
  });
  const { ok, status, body } = await readProductResponse(response);
  if (!ok) {
    setResult(drawer.environmentResult, "bad", "Not accepted.", { reason: failureMessage(body, status) });
    return;
  }
  const run = body.environment;
  setResult(
    drawer.environmentResult,
    run.completed === run.requested ? "ok" : "warn",
    `Environment interaction complete: ${run.completed} of ${run.requested}.`,
    {
      environment: `${run.environment_id} (${run.resolution})`,
      episodes: run.outcomes.map((outcome) => outcome.episode_ref ?? "(none)").join(", "),
      state_revision: run.state_revision,
      repository_revision: run.repository_revision
    }
  );
  await refreshViews();
}

drawer.timeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitTime();
});

async function submitTime() {
  const ticks = Number.parseInt(document.getElementById("time-ticks").value, 10);
  const response = await fetch("/api/time", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticks })
  });
  const { ok, status, body } = await readProductResponse(response);
  if (!ok) {
    setResult(drawer.timeResult, "bad", "Not accepted.", { reason: failureMessage(body, status) });
    return;
  }
  const time = body.time;
  if (time.no_op) {
    setResult(drawer.timeResult, "warn", "NO_OP — canonical time and Affect unchanged.", {
      logical_time: time.logical_time_after
    });
  } else {
    setResult(drawer.timeResult, "ok", `Advanced ${time.ticks} canonical ticks.`, {
      logical_time: `${time.logical_time_before} → ${time.logical_time_after}`,
      valence: `${time.valence_before} → ${time.valence_after}`,
      activation: `${time.activation_before} → ${time.activation_after}`
    });
  }
  await refreshViews();
}

async function main() {
  try {
    await refreshViews();
    connectEvents();
  } catch (error) {
    showBanner(
      `Cannot reach the local CharacterOS backend. Start it with "pnpm web". ${
        error instanceof Error ? `(${error.message})` : ""
      }`
    );
  }
}

void main();
