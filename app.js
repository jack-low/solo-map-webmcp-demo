const DEMO_AGENTS = [
  { id: "agent://demo/accounting", label: "Accounting Agent", capabilities: ["tax-filing", "budget-review"] },
  { id: "agent://demo/legal", label: "Legal Agent", capabilities: ["contract-review", "policy-check"] },
  { id: "agent://demo/travel", label: "Travel Agent", capabilities: ["travel-booking", "itinerary-planning"] },
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
      throw new Error("tool arguments must be a JSON object");
    }
  }
  const recipient = String(input.recipient || "");
  const purpose = String(input.purpose || "");
  const expiresInMinutes = Number(input.expires_in_minutes ?? 30);
  const maxReads = Number(input.max_reads ?? 1);
  const allowForwarding = Boolean(input.allow_forwarding ?? false);
  const knownAgent = DEMO_AGENTS.find((agent) => agent.id === recipient);

  if (!knownAgent) throw new Error("recipient must be one of the public demo agents");
  if (!PURPOSES.has(purpose)) throw new Error("purpose is not available in this demo");
  if (!knownAgent.capabilities.includes(purpose)) throw new Error("recipient does not advertise this purpose");
  if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 5 || expiresInMinutes > MAX_TTL_MINUTES) {
    throw new Error("expires_in_minutes must be an integer between 5 and 1440");
  }
  if (![1, 2, 5].includes(maxReads)) throw new Error("max_reads must be 1, 2, or 5");

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
  badge.textContent = source === "agent" ? "AGENT RESULT" : "VALIDATED";
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
    description: "Explain which parts of a policy-bound agent handoff are visible to the browser, relay, model, and authorized runtime. Never return a secret or private key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      return result("The public browser surface validates policy metadata. The relay routes ciphertext and delivery metadata. An authorized agent runtime alone may use its isolated key to decrypt. This demo creates no real ciphertext and accepts no secrets.", {
        browser: "policy metadata and redacted preview",
        relay: "ciphertext and delivery metadata only",
        model: "never receives a private key",
        authorized_runtime: "only place where decryption may occur",
      });
    },
  },
  {
    name: "list_demo_agents",
    description: "List the public demo agent identities and advertised purposes. This returns synthetic identities only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      return result(JSON.stringify(DEMO_AGENTS), { agents: DEMO_AGENTS });
    },
  },
  {
    name: "create_policy_bound_envelope",
    description: "Validate a recipient, purpose, expiry, read limit, and forwarding policy, then return a safe preview. Never accept or transmit plaintext, secrets, or private keys.",
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
    statusText.textContent = "Browser preview mode · WebMCP not detected";
    return;
  }

  try {
    for (const tool of TOOL_DEFINITIONS) await modelContext.registerTool(tool);
    const registered = typeof modelContext.getTools === "function" ? await modelContext.getTools() : TOOL_DEFINITIONS;
    status.classList.add("ready");
    statusText.textContent = `${registered.length} WebMCP tools registered`;
  } catch (error) {
    status.classList.add("fallback");
    statusText.textContent = `WebMCP registration needs attention: ${error.message}`;
  }
}

document.querySelector("#policy-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    renderPlan(normalizePolicy(formPolicy()));
  } catch (error) {
    const badge = document.querySelector("#preview-badge");
    badge.textContent = "CHECK INPUT";
    badge.classList.remove("active");
    window.alert(error.message);
  }
});

registerTools();
