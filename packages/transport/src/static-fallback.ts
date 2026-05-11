export const FALLBACK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sysko Observe</title>
  <style>
    body { font: 14px system-ui, sans-serif; margin: 0; padding: 24px; background: #0b0f17; color: #e6edf3; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    .status { color: #8b949e; font-size: 12px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    tr.new { background: #1f2a3a; transition: background 1.2s ease-out; }
    .method { color: #79c0ff; }
    .status-2xx { color: #56d364; }
    .status-3xx { color: #d2a8ff; }
    .status-4xx { color: #e3b341; }
    .status-5xx { color: #f85149; }
  </style>
</head>
<body>
  <h1>sysko observe</h1>
  <div class="status" id="status">connecting…</div>
  <table>
    <thead><tr><th>method</th><th>path</th><th>status</th><th>duration</th></tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <script>
    const rows = document.getElementById("rows");
    const status = document.getElementById("status");
    const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/_sysko/ws");
    function statusClass(code) {
      if (code >= 500) return "status-5xx";
      if (code >= 400) return "status-4xx";
      if (code >= 300) return "status-3xx";
      if (code >= 200) return "status-2xx";
      return "";
    }
    function render(span) {
      const tr = document.createElement("tr");
      tr.className = "new";
      const m = span.attributes["http.method"] ?? "";
      const p = span.attributes["http.path"] ?? "";
      const c = span.attributes["http.status_code"] ?? 0;
      tr.innerHTML =
        '<td class="method">' + m + '</td>' +
        '<td>' + p + '</td>' +
        '<td class="' + statusClass(c) + '">' + c + '</td>' +
        '<td>' + span.duration.toFixed(1) + ' ms</td>';
      rows.prepend(tr);
      setTimeout(() => tr.classList.remove("new"), 1200);
    }
    ws.onopen = () => { status.textContent = "connected"; };
    ws.onclose = () => { status.textContent = "disconnected"; };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "history") msg.spans.forEach(render);
      else if (msg.type === "span") render(msg.span);
    };
  </script>
</body>
</html>`;
