export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function emptyState(reason) {
  return `
    <div class="panel">
      <div class="panel-body" style="padding:32px 22px;text-align:center;">
        <i class="fa-solid fa-circle-info" style="font-size:22px;color:var(--muted);margin-bottom:10px;display:block;"></i>
        <p style="font-size:13px;color:var(--muted);max-width:480px;margin:0 auto;line-height:1.6;">${escapeHtml(reason)}</p>
      </div>
    </div>`;
}
