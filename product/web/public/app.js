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
