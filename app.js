const IS_JA = document.documentElement.lang === "ja";
const UI_TEXT = IS_JA ? {
  invalidJson: "ツール引数はJSONオブジェクトで指定してください",
  recipient: "宛先は公開デモのエージェントから選択してください",
  purpose: "このデモでは利用できない目的です",
  capability: "宛先エージェントがこの目的を提供していません",
  expiry: "expires_in_minutesは5〜1440の整数で指定してください",
  reads: "max_readsは1、2、5のいずれかで指定してください",
  validated: "検証済み",
  agentResult: "エージェント結果",
  checkInput: "入力を確認",
  fallback: "ブラウザプレビューモード · WebMCP未検出",
  registered: (count) => `${count}個のWebMCPツールを登録済み`,
  needsAttention: (message) => `WebMCPの登録に注意が必要です: ${message}`,
  boundaryText: "公開ブラウザ面はポリシーメタデータを検証します。リレーは暗号文と配送メタデータを転送します。隔離された鍵を使って復号できるのは、認可済みのエージェントランタイムだけです。このデモは実際の暗号文を作成せず、秘密情報も受け取りません。",
  listAgents: "公開デモのエージェントIDと提供目的です。合成IDのみを返します。",
  envelope: "宛先、目的、有効期限、読み取り回数、転送ポリシーを検証し、安全なプレビューを返します。平文、秘密情報、秘密鍵は受け取りも送信もしません。",
  modelBoundary: "モデルは秘密鍵を受け取りません",
  runtimeBoundary: "復号できるのは認可済みランタイムだけです",
} : {
  invalidJson: "tool arguments must be a JSON object",
  recipient: "recipient must be one of the public demo agents",
  purpose: "purpose is not available in this demo",
  capability: "recipient does not advertise this purpose",
  expiry: "expires_in_minutes must be an integer between 5 and 1440",
  reads: "max_reads must be 1, 2, or 5",
  validated: "VALIDATED",
  agentResult: "AGENT RESULT",
  checkInput: "CHECK INPUT",
  fallback: "Browser preview mode · WebMCP not detected",
  registered: (count) => `${count} WebMCP tools registered`,
  needsAttention: (message) => `WebMCP registration needs attention: ${message}`,
  boundaryText: "The public browser surface validates policy metadata. The relay routes ciphertext and delivery metadata. An authorized agent runtime alone may use its isolated key to decrypt. This demo creates no real ciphertext and accepts no secrets.",
  listAgents: "List the public demo agent identities and advertised purposes. This returns synthetic identities only.",
  envelope: "Validate a recipient, purpose, expiry, read limit, and forwarding policy, then return a safe preview. Never accept or transmit plaintext, secrets, or private keys.",
  modelBoundary: "never receives a private key",
  runtimeBoundary: "only place where decryption may occur",
};

const DEMO_AGENTS = [
  { id: "agent://demo/accounting", label: IS_JA ? "会計エージェント" : "Accounting Agent", capabilities: ["tax-filing", "budget-review"] },
  { id: "agent://demo/legal", label: IS_JA ? "法務エージェント" : "Legal Agent", capabilities: ["contract-review", "policy-check"] },
  { id: "agent://demo/travel", label: IS_JA ? "旅行エージェント" : "Travel Agent", capabilities: ["travel-booking", "itinerary-planning"] },
];

const PURPOSES = new Set(["tax-filing", "contract-review", "travel-booking"]);
const MAX_TTL_MINUTES = 24 * 60;

const result = (text, structuredContent) => ({
  content: [{ type: "text", text }],
  structuredContent,
});

function normalizePolicy(input = {}) {
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      throw new Error(UI_TEXT.invalidJson);
    }
  }
  const recipient = String(input.recipient || "");
  const purpose = String(input.purpose || "");
  const expiresInMinutes = Number(input.expires_in_minutes ?? 30);
  const maxReads = Number(input.max_reads ?? 1);
  const allowForwarding = Boolean(input.allow_forwarding ?? false);
  const knownAgent = DEMO_AGENTS.find((agent) => agent.id === recipient);

  if (!knownAgent) throw new Error(UI_TEXT.recipient);
  if (!PURPOSES.has(purpose)) throw new Error(UI_TEXT.purpose);
  if (!knownAgent.capabilities.includes(purpose)) throw new Error(UI_TEXT.capability);
  if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 5 || expiresInMinutes > MAX_TTL_MINUTES) {
    throw new Error(UI_TEXT.expiry);
  }
  if (![1, 2, 5].includes(maxReads)) throw new Error(UI_TEXT.reads);

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000).toISOString();
  return {
    plan_id: `demo-plan-${crypto.randomUUID().slice(0, 8)}`,
    sender: "agent://demo/main",
    recipient,
    purpose,
    expires_in_minutes: expiresInMinutes,
    expires_at: expiresAt,
    max_reads: maxReads,
    allow_forwarding: allowForwarding,
    transport: "HPKE envelope via protected relay",
    plaintext_exposed_to_relay: false,
    private_key_exposed_to_model: false,
    status: "preview-only",
  };
}

function renderPlan(plan, source = "ui") {
  const preview = document.querySelector("#json-preview");
  const empty = document.querySelector("#preview-empty");
  const badge = document.querySelector("#preview-badge");
  preview.textContent = JSON.stringify(plan, null, 2);
  preview.classList.remove("hidden");
  empty.classList.add("hidden");
  badge.textContent = source === "agent" ? UI_TEXT.agentResult : UI_TEXT.validated;
  badge.classList.add("active");
  if (source === "agent") {
    document.querySelector("#recipient").value = plan.recipient;
    document.querySelector("#purpose").value = plan.purpose;
    document.querySelector("#expires").value = String(plan.expires_in_minutes);
    document.querySelector("#max-reads").value = String(plan.max_reads);
    document.querySelector("#allow-forwarding").checked = plan.allow_forwarding;
  }
}

function formPolicy() {
  return {
    recipient: document.querySelector("#recipient").value,
    purpose: document.querySelector("#purpose").value,
    expires_in_minutes: Number(document.querySelector("#expires").value),
    max_reads: Number(document.querySelector("#max-reads").value),
    allow_forwarding: document.querySelector("#allow-forwarding").checked,
  };
}

const TOOL_DEFINITIONS = [
  {
    name: "inspect_security_boundary",
    description: IS_JA ? "ポリシーで制御されたエージェント間引き渡しについて、ブラウザ、リレー、モデル、認可済みランタイムから見える範囲を説明します。秘密情報や秘密鍵は返しません。" : "Explain which parts of a policy-bound agent handoff are visible to the browser, relay, model, and authorized runtime. Never return a secret or private key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      return result(UI_TEXT.boundaryText, {
        browser: "policy metadata and redacted preview",
        relay: "ciphertext and delivery metadata only",
        model: UI_TEXT.modelBoundary,
        authorized_runtime: UI_TEXT.runtimeBoundary,
      });
    },
  },
  {
    name: "list_demo_agents",
    description: UI_TEXT.listAgents,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      return result(JSON.stringify(DEMO_AGENTS), { agents: DEMO_AGENTS });
    },
  },
  {
    name: "create_policy_bound_envelope",
    description: UI_TEXT.envelope,
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string", enum: DEMO_AGENTS.map((agent) => agent.id) },
        purpose: { type: "string", enum: [...PURPOSES] },
        expires_in_minutes: { type: "integer", minimum: 5, maximum: MAX_TTL_MINUTES },
        max_reads: { type: "integer", enum: [1, 2, 5] },
        allow_forwarding: { type: "boolean" },
      },
      required: ["recipient", "purpose"],
      additionalProperties: false,
    },
    async execute(input) {
      const plan = normalizePolicy(input);
      renderPlan(plan, "agent");
      return result(JSON.stringify(plan), plan);
    },
  },
];

async function registerTools() {
  const status = document.querySelector("#mcp-status");
  const statusText = document.querySelector("#mcp-status-text");
  const modelContext = document.modelContext;

  if (!modelContext || typeof modelContext.registerTool !== "function") {
    status.classList.add("fallback");
    statusText.textContent = UI_TEXT.fallback;
    return;
  }

  try {
    for (const tool of TOOL_DEFINITIONS) await modelContext.registerTool(tool);
    const registered = typeof modelContext.getTools === "function" ? await modelContext.getTools() : TOOL_DEFINITIONS;
    status.classList.add("ready");
    statusText.textContent = UI_TEXT.registered(registered.length);
  } catch (error) {
    status.classList.add("fallback");
    statusText.textContent = UI_TEXT.needsAttention(error.message);
  }
}

document.querySelector("#policy-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    renderPlan(normalizePolicy(formPolicy()));
  } catch (error) {
    const badge = document.querySelector("#preview-badge");
    badge.textContent = UI_TEXT.checkInput;
    badge.classList.remove("active");
    window.alert(error.message);
  }
});

registerTools();
