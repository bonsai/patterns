"use strict";

// aw-api（GCP Cloud Run）の URL。デプロイ後に設定する。
// 未設定なら GitHub Actions への手動ディスパッチ案内のみ（配管デモその１）。
const AW_API = null;

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const patternEl = $("pattern");
const pollEl = $("poll");

function setStatus(html) { statusEl.innerHTML = html; }

async function runSelect() {
  const listEl = $("list");
  try {
    const r = await fetch("patterns/index.json", { cache: "no-store" });
    const list = await r.json();
    listEl.innerHTML = list.map((it, i) => {
      const file = `pattern-${it.seed.replace(/[^a-zA-Z0-9_-]/g, "")}-${it.style}.svg`;
      return `<div><img src="patterns/${encodeURIComponent(file)}" alt="${it.seed}" title="${it.seed} / ${it.style} @ ${it.created_at}" /><div style="font-size:10px;color:#64748b">${i + 1}. ${it.seed}</div></div>`;
    }).join("");
  } catch (e) {
    listEl.innerHTML = "";
  }
}

let timer = null;
function pollTask(id) {
  clearInterval(timer);
  if (!AW_API) return;
  timer = setInterval(async () => {
    try {
      const r = await fetch(`${AW_API}/v1/tasks/${id}`, { cache: "no-store" });
      const t = await r.json();
      setStatus(`task ${id}: ${t.status}`);
      if (t.status === "completed" || t.status === "failed") {
        clearInterval(timer);
        patternEl.src = `patterns/latest.svg?${Date.now()}`;
        setStatus(`${t.status} — URL 更新 → 再描画`);
        runSelect();
      }
    } catch (e) { setStatus("poll error"); }
  }, 5000);
}

async function generate() {
  const style = $("style").value;
  const seedVal = $("seed").value.trim();
  const auto = !seedVal;

  if (!AW_API) {
    setStatus("aw-api 未接続 → 手動: gh workflow run pattern-gen --repo bonsai/patterns -f style=" + style);
    return;
  }

  try {
    setStatus("task 送信中…");
    const r = await fetch(`${AW_API}/v1/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: "pattern-gen",
        owner_repo: "bonsai/patterns",
        inputs: { seed: seedVal || String(Math.random() * 1e9 | 0), style, size: 256, auto: String(auto) },
      }),
    });
    const task = await r.json();
    setStatus(`task ${task.id}: queued`);
    if (pollEl.checked) pollTask(task.id);
  } catch (e) {
    setStatus("aw-api エラー: " + e.message);
  }
}

$("gen").addEventListener("click", generate);
runSelect();

(async () => {
  const awEl = $("aw");
  awEl.textContent = AW_API
    ? "aw-api: " + AW_API
    : "aw-api 未接続。\n設定: この script.js の const AW_API = null; に Cloud Run URL を入れて push。\n配管デモ: gh workflow run pattern-gen --repo bonsai/patterns -f style=waves -f seed=gym";
})();