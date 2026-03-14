const HIVE_API = "https://short-seas-win.loca.lt";
let currentSessionId = null;

// UI Elements
const terminal = document.getElementById("terminal-output");
const statusIndicator = document.getElementById("connection-status");
const walletAddress = document.getElementById("wallet-address");
const btnEvaluate = document.getElementById("start-evaluation");
const btnChat = document.getElementById("btn-send-chat");
const inputBorrower = document.getElementById("borrower-id");
const inputAmount = document.getElementById("loan-amount");
const inputChat = document.getElementById("chat-input");
const progressBar = document.getElementById("goal-progress-bar");
const progressStatus = document.getElementById("goal-status");
const poolBalanceDisplay = document.getElementById("pool-balance");
const activeLoansDisplay = document.getElementById("active-loans");
const txLog = document.getElementById("tx-log");

/**
 * Append a line to the terminal UI
 */
function log(text, type = "system") {
  const line = document.createElement("div");
  line.className = `line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Initialize connection to Hive and find/create Sentinel session
 */
async function init() {
  log("Contacting Hive Neural Network...");
  try {
    // 1. Check health
    const health = await fetch(`${HIVE_API}/api/health`).then((r) => r.json());
    if (health.status === "ok") {
      log("Hive Backend Online.", "success");
      statusIndicator.classList.add("online");
    }

    // 2. Discover if Sentinel is already running
    const discover = await fetch(`${HIVE_API}/api/sessions`).then((r) =>
      r.json(),
    );
    const sentinelSession = discover.sessions.find(
      (s) => s.worker_name === "Finance Sentinel",
    );

    if (sentinelSession) {
      currentSessionId = sentinelSession.session_id;
      log(`Reconnected to active session: ${currentSessionId}`);
    } else {
      log(
        "No active session found. Initializing new Finance Sentinel context...",
      );
      await startNewSession();
    }

    // 3. Start polling for updates
    startPolling();

    // 4. Get Agent Identity/Address
    fetchAddress();
  } catch (err) {
    log(`Connection Failed: ${err.message}`, "danger");
    console.error(err);
  }
}

async function startNewSession() {
  try {
    const resp = await fetch(`${HIVE_API}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_path:
          "/home/mk_lateef/Desktop/OSS/hive/core/framework/agents/finance_sentinel",
      }),
    }).then((r) => r.json());

    if (resp.session_id) {
      currentSessionId = resp.session_id;
      log(`Sentinel Session Created: ${currentSessionId}`, "success");
    }
  } catch (err) {
    log("Failed to create session. Is the path correct?", "danger");
  }
}

async function fetchAddress() {
  walletAddress.textContent = "0xSent...nel (WDK Active)";
}

async function startPolling() {
  // Poll messages every 2s
  setInterval(async () => {
    if (!currentSessionId) return;
    try {
      const msgs = await fetch(
        `${HIVE_API}/api/sessions/${currentSessionId}/queen-messages`,
      ).then((r) => r.json());
      updateTerminal(msgs.messages);
    } catch (e) {
      console.warn("Message polling error", e);
    }
  }, 2000);

  // Poll goals and stats every 5s
  setInterval(async () => {
    if (!currentSessionId) return;
    try {
      const progress = await fetch(
        `${HIVE_API}/api/sessions/${currentSessionId}/goal-progress`,
      ).then((r) => r.json());
      if (progress && progress.total_weight > 0) {
        const percent = Math.min(
          100,
          (progress.accomplished_weight / progress.total_weight) * 100,
        );
        progressBar.style.width = `${percent}%`;
        progressStatus.textContent = `Goal Completion: ${Math.round(percent)}%`;
      }

      // Update mock metrics based on agent thoughts
      // In a real app, these would come from the agent's memory or tools
    } catch (e) {
      console.warn("Stats polling error", e);
    }
  }, 5000);
}

let lastMessageSeq = 0;
function updateTerminal(messages) {
  if (!messages) return;
  messages.forEach((m) => {
    if (m.seq > lastMessageSeq) {
      lastMessageSeq = m.seq;
      if (m.role === "assistant") {
        const type = m.content.toLowerCase().includes("approved")
          ? "success"
          : "thought";
        log(m.content, type);

        // If it looks like a transaction, add to log
        if (m.content.includes("Hash:")) {
          addTransactionLog(m.content);
        }
      } else if (m.role === "user") {
        log(`User: ${m.content}`, "action");
      }
    }
  });
}

function addTransactionLog(text) {
  const hashMatch = text.match(/Hash: (0x[a-fA-F0-9]+)/);
  if (!hashMatch) return;

  const hash = hashMatch[1];
  const txItem = document.createElement("div");
  txItem.className = "tx-item";
  txItem.innerHTML = `
        <span class="address">Tx: ${hash.substring(0, 10)}...</span>
        <span class="amount">Lent: 50 USD₮</span>
    `;
  txLog.prepend(txItem);
}

btnEvaluate.addEventListener("click", async () => {
  const borrower = inputBorrower.value;
  const amount = inputAmount.value;

  if (!borrower || !amount) {
    log("Error: Missing borrower ID or amount.", "danger");
    return;
  }

  log(
    `Dispatching Loan Evaluation: ${amount} USD₮ to ${borrower}...`,
    "action",
  );

  try {
    const resp = await fetch(
      `${HIVE_API}/api/sessions/${currentSessionId}/trigger`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_point_id: "start",
          input_data: {
            borrower_identity: borrower,
            requested_amount: amount,
          },
        }),
      },
    ).then((r) => r.json());

    if (resp.execution_id) {
      log(`Sentinel working on Execution: ${resp.execution_id}`, "success");
    } else if (resp.error) {
      log(`Evaluation Refused: ${resp.error}`, "danger");
    }
  } catch (err) {
    log(`Execution Error: ${err.message}`, "danger");
  }
});

btnChat.addEventListener("click", async () => {
  const msg = inputChat.value;
  if (!msg) return;

  inputChat.value = "";
  log(msg, "action");

  try {
    await fetch(`${HIVE_API}/api/sessions/${currentSessionId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
  } catch (err) {
    log(`Chat Error: ${err.message}`, "danger");
  }
});

inputChat.addEventListener("keypress", (e) => {
  if (e.key === "Enter") btnChat.click();
});

// Run Init
init();
