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
  subjectId: null,
  messages: [],
  stages: new Map(),
  stageOrder: [],
  sending: false,
  subjects: [],
  evolution: null,
  devDetails: false
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
  life: document.getElementById("life"),
  lifeEvolution: document.getElementById("life-evolution"),
  subjectsList: document.getElementById("subjects-list"),
  newSubjectForm: document.getElementById("new-subject-form"),
  newSubjectName: document.getElementById("new-subject-name"),
  devDetails: document.getElementById("dev-details"),
  micToggle: document.getElementById("mic-toggle"),
  micLabel: document.getElementById("mic-label"),
  micStop: document.getElementById("mic-stop"),
  speechStop: document.getElementById("speech-stop"),
  voiceState: document.getElementById("voice-state"),
  voiceNote: document.getElementById("voice-note")
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
  state.subjectId = identity.subject_id;
  el.name.textContent = state.subjectName;
  state.bootstrapRevision = bootstrap.revisions ? bootstrap.revisions.state_revision : null;
  el.id.textContent = state.devDetails
    ? `${identity.subject_id} · revision ${state.bootstrapRevision ?? "?"}`
    : "";
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
    box.className = `msg ${message.role === "user" ? "msg-user" : message.role === "note" ? "msg-note" : "msg-subject"}`;
    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent =
      message.role === "user"
        ? message.mode === "voice"
          ? "You (voice)"
          : "You"
        : message.role === "note"
          ? "Session"
          : state.subjectName;
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
    STAGE_REUSED: "REUSED",
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
  const [bootstrap, stateView, life, subjects] = await Promise.all([
    api("/api/bootstrap"),
    api("/api/state"),
    api("/api/life"),
    api("/api/subjects")
  ]);
  renderIdentity(bootstrap.bootstrap);
  renderState(stateView.view);
  state.evolution = life.life.evolution ?? null;
  renderSubjects(subjects.subjects);
  renderLife(life.life.recent_memory);
  renderEvolution(state.evolution);
}

/** Conversation history: from the subject's durable operational log (a VIEW). */
async function refreshTranscript() {
  try {
    const body = await api("/api/transcript?limit=50");
    const messages = [];
    for (const turn of body.turns) {
      if (typeof turn.user_text === "string" && turn.user_text.length > 0) {
        messages.push({ role: "user", text: turn.user_text, mode: turn.input_mode === "voice" ? "voice" : "typed" });
      }
      if (turn.status === "COMPLETE" && typeof turn.subject_text === "string" && turn.subject_text.length > 0) {
        messages.push({ role: "subject", text: turn.subject_text });
      } else if (turn.status !== "COMPLETE") {
        messages.push({
          role: "note",
          text: `This turn ended ${turn.status}; nothing about the subject was changed by it.`
        });
      }
    }
    state.messages = messages;
    renderMessages();
  } catch {
    // A transcript read failure never blocks the product: state/life still render.
  }
}

function renderSubjects(subjects) {
  state.subjects = subjects;
  el.subjectsList.textContent = "";
  for (const subject of subjects) {
    const row = document.createElement("div");
    row.className = subject.active ? "subject-row active" : "subject-row";
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "subject-name";
    name.textContent = subject.display_name || subject.subject_id;
    const meta = document.createElement("div");
    meta.className = "subject-meta";
    meta.textContent = `${subject.active ? "open" : "stored"} · ${subject.durable_state.toLowerCase()}`;
    text.append(name, meta);
    row.appendChild(text);
    if (!subject.active) {
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.addEventListener("click", () => void openSubject(subject.subject_id));
      row.appendChild(openButton);
    }
    el.subjectsList.appendChild(row);
  }
}

async function openSubject(subjectId) {
  try {
    await api("/api/subjects/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject_id: subjectId })
    });
    state.messages = [];
    await refreshAll();
  } catch (error) {
    showBanner(error instanceof Error ? error.message : "The subject could not be opened.");
  }
}

async function createSubject(displayName) {
  try {
    await api("/api/subjects/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: displayName })
    });
    state.messages = [];
    await refreshAll();
  } catch (error) {
    showBanner(error instanceof Error ? error.message : "The subject could not be created.");
  }
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
    } else if (turn.status === "DEGRADED") {
      // The subject could not form a reliable reply: nothing about it changed.
      state.messages.push({
        role: "note",
        text: "I could not form a reliable reply to that just now. Nothing about our conversation was changed - please say it again."
      });
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
    ["Data root", config.data_root],
    ["Appraisal exact-input reuse", config.appraisal_exact_input_reuse]
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

function renderDiagnostics(view) {
  drawer.diagnosticsView.textContent = "";
  if (view === null || view === undefined || view.provider === null || view.provider === undefined) {
    drawer.diagnosticsView.appendChild(kvRow("Diagnostics", "unavailable"));
    return;
  }
  const diagnostics = view.provider;
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
  const reuse = view.appraisal_inference;
  if (reuse !== null && reuse !== undefined) {
    const group = document.createElement("div");
    group.className = "kv-group";
    group.appendChild(kvRow("Appraisal inference reuse", reuse.enabled ? "ON" : "OFF (independent inference)"));
    const sub = document.createElement("div");
    sub.className = "kv-sub";
    sub.textContent =
      `semantic invocations ${reuse.semantic_invocations} · real inferences ${reuse.real_inferences} · ` +
      `reuse hits ${reuse.reuse_hits} · misses ${reuse.reuse_misses} · unavailable ${reuse.reuse_unavailable}`;
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
    await refreshAll();
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

/* -------------------------------------------------------------------------- */
/* PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0                            */
/* Read-only presentation of the evolution projection + subject management.    */
/* Every value below comes from the backend; nothing here is authoritative.    */
/* -------------------------------------------------------------------------- */

function renderEvolution(evolution) {
  el.lifeEvolution.textContent = "";
  if (evolution === null || typeof evolution !== "object") return;

  const heading = document.createElement("h3");
  heading.textContent = "Durable changes";
  el.lifeEvolution.appendChild(heading);

  const affects = evolution.durable_effects.affect;
  const beliefs = evolution.durable_effects.belief;
  if (affects.length === 0 && beliefs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "absent";
    empty.textContent = "No state-changing transitions recorded yet.";
    el.lifeEvolution.appendChild(empty);
  }

  for (const transition of affects.slice(0, 3)) {
    const box = document.createElement("div");
    box.className = "transition";
    const main = document.createElement("div");
    main.className = "transition-main";
    const before = transition.valence_before === null ? "start" : transition.valence_before;
    main.textContent = `Affect valence ${before} → ${transition.valence_after}`;
    const meta = document.createElement("div");
    meta.className = "transition-meta";
    meta.textContent = "from a lived event's appraisal";
    const refs = document.createElement("div");
    refs.className = "transition-meta dev-only";
    refs.textContent = `${transition.observation_ref} · ${transition.event_ref} · ${transition.appraisal_ref}`;
    box.append(main, meta, refs);
    el.lifeEvolution.appendChild(box);
  }

  for (const transition of beliefs.slice(0, 3)) {
    const box = document.createElement("div");
    box.className = "transition";
    const main = document.createElement("div");
    main.className = "transition-main";
    const label = transition.proposition_label || transition.proposition_id || "(proposition)";
    const credences =
      transition.prior_credence === null
        ? `formed at ${transition.next_credence === null ? "?" : transition.next_credence}`
        : `${transition.prior_credence} → ${transition.next_credence === null ? "unchanged" : transition.next_credence}`;
    main.textContent = `Belief “${label}” ${credences}`;
    const meta = document.createElement("div");
    meta.className = "transition-meta";
    meta.textContent =
      transition.relation === null
        ? "from lived evidence"
        : `from lived evidence (${transition.relation === "SUPPORTS" ? "supporting" : "contradicting"})`;
    const refs = document.createElement("div");
    refs.className = "transition-meta dev-only";
    refs.textContent = `${transition.workflow_id} · ${transition.proposition_id} · ${transition.evidence_episode_refs.join(", ")}`;
    box.append(main, meta, refs);
    el.lifeEvolution.appendChild(box);
  }

  for (const domain of ["relationship", "personality"]) {
    const attribution = evolution.attribution[domain];
    if (attribution.status !== "UNAVAILABLE") continue;
    const line = document.createElement("p");
    line.className = "absent";
    line.textContent = `${domain}: current value shown, source attribution unavailable`;
    el.lifeEvolution.appendChild(line);
  }

  const visibleHeading = document.createElement("h3");
  visibleHeading.textContent = "Reaching the subject's current thinking";
  el.lifeEvolution.appendChild(visibleHeading);
  const visible = evolution.cognition_visible;
  const summary = document.createElement("p");
  summary.className = "note";
  summary.textContent =
    `${visible.memory_episode_refs.length} remembered episode(s), ` +
    `${visible.belief_proposition_ids.length} belief(s), ` +
    `${visible.relationship_counterpart_refs.length} relationship(s), ` +
    `${visible.personality_dimension_ids.length} personality dimension(s), ` +
    `affect valence ${visible.affect.valence}`;
  el.lifeEvolution.appendChild(summary);
  const visibleRefs = document.createElement("p");
  visibleRefs.className = "note dev-only";
  visibleRefs.textContent = visible.memory_episode_refs.join(", ");
  el.lifeEvolution.appendChild(visibleRefs);
}

/** Refreshes the conversation view (durable log) and the read-only projections. */
async function refreshAll() {
  await refreshViews();
  await refreshTranscript();
  await refreshVoiceStatus();
  await refreshVisionStatus();
}

function applyDevDetails(enabled) {
  state.devDetails = enabled;
  document.body.classList.toggle("dev-details", enabled);
  renderEvolution(state.evolution);
  el.id.textContent = enabled ? `${state.subjectId ?? ""} · revision ${state.bootstrapRevision ?? "?"}` : "";
}

el.newSubjectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = el.newSubjectName.value.trim();
  if (name.length === 0) {
    showBanner("Enter a subject name first.");
    return;
  }
  el.newSubjectName.value = "";
  void createSubject(name);
});

el.devDetails.addEventListener("change", () => {
  applyDevDetails(el.devDetails.checked);
});

/* -------------------------------------------------------------------------- */
/* VOICE MODALITY (PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0)            */
/*                                                                             */
/* Audio is an INPUT/OUTPUT MODALITY only: a recording becomes text, the text   */
/* goes through the SAME /api/voice/turn path a typed message uses (one subject, */
/* one life, one transcript), and the subject's FINAL delivered text is what is  */
/* spoken. Nothing here is authoritative, nothing is persisted, and the          */
/* microphone is armed only by an explicit click.                               */
/* -------------------------------------------------------------------------- */

const voice = {
  available: false,
  ttsAvailable: false,
  state: "idle",
  recorder: null,
  stream: null,
  chunks: [],
  stopped: false,
  utterance: null
};

function setVoiceState(next, note) {
  voice.state = next;
  const classes = {
    idle: "",
    recording: "state-recording",
    processing: "state-processing",
    speaking: "state-speaking",
    error: "state-error"
  };
  el.voiceState.className = `voice-state ${classes[next] ?? ""}`.trim();
  el.voiceState.textContent = next === "processing" ? "transcribing / thinking" : next;
  el.voiceNote.textContent = note ?? "";
  const recording = next === "recording";
  el.micToggle.setAttribute("aria-pressed", recording ? "true" : "false");
  el.micStop.hidden = !recording;
  el.speechStop.hidden = next !== "speaking";
}

function releaseMicrophone() {
  if (voice.stream !== null) {
    for (const track of voice.stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // Releasing an already-ended track is not an error.
      }
    }
    voice.stream = null;
  }
  voice.recorder = null;
  voice.chunks = [];
}

function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // A browser without speech synthesis simply has nothing to cancel.
  }
  if (voice.utterance !== null) voice.utterance = null;
  if (voice.state === "speaking") setVoiceState("idle", "");
}

/** Speaks the FINAL delivered text: server audio when configured, else browser speech. */
async function speakDeliveredText(text) {
  if (typeof text !== "string" || text.length === 0) return;
  setVoiceState("speaking", "");
  if (voice.ttsAvailable) {
    try {
      const body = await api("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      const audio = new Audio(`data:${body.content_type};base64,${body.audio_base64}`);
      audio.addEventListener("ended", () => setVoiceState("idle", ""), { once: true });
      await audio.play();
      return;
    } catch {
      // Fall through to the browser voice: the reply itself is already committed.
    }
  }
  const synth = window.speechSynthesis;
  if (synth === undefined || typeof SpeechSynthesisUtterance !== "function") {
    setVoiceState("idle", "spoken output unavailable in this browser");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  voice.utterance = utterance;
  utterance.addEventListener("end", () => setVoiceState("idle", ""), { once: true });
  utterance.addEventListener("error", () => setVoiceState("idle", "spoken output failed; the reply is above"), {
    once: true
  });
  synth.speak(utterance);
}

async function refreshVoiceStatus() {
  try {
    const body = await api("/api/voice/status");
    voice.available = body.stt.available === true;
    voice.ttsAvailable = body.tts.available === true;
    el.micToggle.disabled = !voice.available;
    el.micLabel.textContent = voice.available ? "Voice" : "Voice unavailable";
    setVoiceState("idle", voice.available ? "" : "voice input needs a configured speech adapter");
  } catch {
    el.micToggle.disabled = true;
    el.micLabel.textContent = "Voice unavailable";
  }
}

async function startRecording() {
  if (!voice.available || voice.state === "recording") return;
  if (typeof navigator.mediaDevices?.getUserMedia !== "function" || typeof MediaRecorder !== "function") {
    setVoiceState("error", "this browser cannot record audio; type instead");
    return;
  }
  try {
    // The microphone is requested ONLY here, on an explicit click.
    voice.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    setVoiceState("error", error instanceof Error ? error.message : "microphone unavailable");
    return;
  }
  voice.chunks = [];
  voice.stopped = false;
  voice.recorder = new MediaRecorder(voice.stream);
  voice.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) voice.chunks.push(event.data);
  });
  voice.recorder.addEventListener("stop", () => {
    void submitRecording();
  });
  voice.recorder.start();
  setVoiceState("recording", "speak, then stop");
}

function cancelRecording() {
  if (voice.recorder === null) {
    setVoiceState("idle", "");
    return;
  }
  voice.stopped = true;
  try {
    voice.recorder.stop();
  } catch {
    releaseMicrophone();
    setVoiceState("idle", "");
  }
}

async function submitRecording() {
  const chunks = voice.chunks;
  releaseMicrophone();
  if (voice.stopped || chunks.length === 0) {
    setVoiceState("idle", "");
    return;
  }
  setVoiceState("processing", "");
  const blob = new Blob(chunks, { type: chunks[0].type || "audio/webm" });
  const audioBase64 = await blobToBase64(blob);
  let body;
  try {
    body = await api("/api/voice/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audio_base64: audioBase64, content_type: blob.type })
    });
  } catch (error) {
    // Nothing was asked of the subject: no turn, no state change.
    setVoiceState("error", error instanceof Error ? error.message : "the recording could not be sent");
    await refreshAll().catch(() => undefined);
    return;
  }
  if (body.ok !== true) {
    state.messages.push({ role: "note", text: "I could not make out that recording, so nothing was asked." });
    renderMessages();
    setVoiceState("idle", "");
    return;
  }
  state.messages.push({ role: "user", text: body.transcription, mode: "voice" });
  if (body.turn.status === "COMPLETE" && typeof body.turn.reply_text === "string") {
    state.messages.push({ role: "subject", text: body.turn.reply_text });
  } else if (body.turn.status === "DEGRADED") {
    state.messages.push({
      role: "note",
      text: "I could not form a reliable reply to that just now. Nothing about our conversation was changed - please say it again."
    });
  }
  renderMessages();
  await refreshAll();
  // TTS speaks the FINAL delivered text only (or the fixed safe line on degrade).
  await speakDeliveredText(body.speak_text);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("the recording could not be read"));
    reader.readAsDataURL(blob);
  });
}

el.micToggle.addEventListener("click", () => {
  if (voice.state === "recording") cancelRecording();
  else void startRecording();
});
el.micStop.addEventListener("click", () => cancelRecording());
el.speechStop.addEventListener("click", () => stopSpeaking());

/* -------------------------------------------------------------------------- */
/* VISION MODALITY (PERSISTENT_SUBJECT_VISION_PRODUCT_INTEGRATION_V0)          */
/*                                                                             */
/* On-demand camera capture: the camera is opened only by an explicit click,     */
/* exactly ONE frame is captured per click, the frame is sent to the product     */
/* boundary (never stored here or there), and the perception it produces enters  */
/* the subject's normal observation ingress. No continuous video, no identity    */
/* inference, no Affect written from pixels.                                    */
/* -------------------------------------------------------------------------- */

const vision = {
  available: false,
  stream: null,
  video: document.getElementById("vision-preview")
};

function setVisionState(text, tone) {
  const el_ = document.getElementById("vision-state");
  el_.className = `voice-state ${tone ?? ""}`.trim();
  el_.textContent = text;
}

function releaseCamera() {
  if (vision.stream !== null) {
    for (const track of vision.stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // Releasing an already-ended track is not an error.
      }
    }
    vision.stream = null;
  }
  const video = vision.video;
  if (video !== null && video !== undefined) {
    video.srcObject = null;
    video.hidden = true;
  }
  const toggle = document.getElementById("camera-toggle");
  toggle.setAttribute("aria-pressed", "false");
  toggle.textContent = "Camera off";
  document.getElementById("vision-look").disabled = true;
  setVisionState("idle", "");
}

async function enableCamera() {
  if (!vision.available) {
    setVisionState("unavailable", "state-error");
    return;
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
    setVisionState("camera unsupported", "state-error");
    return;
  }
  try {
    // The camera is opened ONLY here, on an explicit click.
    vision.stream = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (error) {
    setVisionState("permission denied", "state-error");
    document.getElementById("vision-result").textContent =
      error instanceof Error ? error.message : "the camera could not be opened";
    return;
  }
  const video = vision.video;
  video.srcObject = vision.stream;
  video.hidden = false;
  await video.play().catch(() => undefined);
  const toggle = document.getElementById("camera-toggle");
  toggle.setAttribute("aria-pressed", "true");
  toggle.textContent = "Camera ON";
  document.getElementById("vision-look").disabled = false;
  setVisionState("camera on", "");
}

/** Captures exactly ONE frame, sends it, shows the perception. Never stores it. */
async function lookOnce() {
  const video = vision.video;
  if (vision.stream === null || video === null || video === undefined) {
    setVisionState("camera off", "state-error");
    return;
  }
  const resultEl = document.getElementById("vision-result");
  setVisionState("capturing", "state-processing");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (context === null || canvas.width === 0 || canvas.height === 0) {
    setVisionState("capture failed", "state-error");
    resultEl.textContent = "The frame could not be captured; nothing was sent.";
    return;
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (blob === null) {
    setVisionState("capture failed", "state-error");
    resultEl.textContent = "The frame could not be captured; nothing was sent.";
    return;
  }
  const imageBase64 = await blobToBase64(blob);
  setVisionState("perceiving", "state-processing");
  let body;
  try {
    body = await api("/api/vision/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_base64: imageBase64, content_type: "image/jpeg", source_type: "CAMERA" })
    });
  } catch (error) {
    setVisionState("failed", "state-error");
    resultEl.textContent = error instanceof Error ? error.message : "the frame could not be sent";
    return;
  }
  if (body.ok !== true) {
    setVisionState("not perceived", "state-error");
    resultEl.textContent = body.message ?? "This frame was not perceived; the subject saw nothing.";
    return;
  }
  const perception = body.perception;
  const observation = body.observation;
  setVisionState(
    observation?.kind === "REPLAY" ? "already seen" : observation?.kind === "CONFLICT" ? "conflict" : "perceived",
    ""
  );
  resultEl.textContent = `Saw: ${perception.scene}`;
  await refreshAll();
}

async function refreshVisionStatus() {
  try {
    const body = await api("/api/vision/status");
    vision.available = body.vision.available === true;
    const toggle = document.getElementById("camera-toggle");
    toggle.disabled = !vision.available;
    if (!vision.available) {
      setVisionState("unavailable", "");
      document.getElementById("vision-result").textContent =
        "Camera perception needs a configured local vision adapter.";
    }
  } catch {
    vision.available = false;
    document.getElementById("camera-toggle").disabled = true;
    setVisionState("unavailable", "");
  }
}

document.getElementById("camera-toggle").addEventListener("click", () => {
  if (vision.stream === null) void enableCamera();
  else releaseCamera();
});
document.getElementById("vision-look").addEventListener("click", () => void lookOnce());
window.addEventListener("pagehide", () => releaseCamera());
