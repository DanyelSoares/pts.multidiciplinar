import { escapeHtml } from './dom.js';

export function parseTagsInput(text) {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function renderTagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:5px;">${tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}</div>`;
}

export function matchesSearch(item, searchText, nameFields = []) {
  const q = searchText.trim().toLowerCase();
  if (!q) return true;
  const nameMatches = nameFields.some((field) => String(field || '').toLowerCase().includes(q));
  const tagMatches = (item.tags || []).some((t) => t.toLowerCase().includes(q));
  return nameMatches || tagMatches;
}
