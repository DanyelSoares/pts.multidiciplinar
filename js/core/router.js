const Router = (() => {
  const screens = new Map();
  const listeners = new Set();
  let activeId = null;

  function register(id, { mount }) {
    screens.set(id, { mount, mounted: false });
  }

  function onChange(callback) {
    listeners.add(callback);
  }

  async function go(id) {
    if (!screens.has(id)) return;

    document.querySelectorAll('.tab-btn[data-target]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.target === id);
    });
    document.querySelectorAll('.screen').forEach((section) => {
      section.classList.toggle('active', section.id === id);
    });

    const entry = screens.get(id);
    if (!entry.mounted) {
      await entry.mount();
      entry.mounted = true;
    }

    activeId = id;
    window.scrollTo(0, 0);
    listeners.forEach((cb) => cb(id));
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn[data-target]').forEach((btn) => {
      btn.addEventListener('click', () => go(btn.dataset.target));
    });
  }

  function current() {
    return activeId;
  }

  function resetAll(excludeIds = []) {
    screens.forEach((entry, id) => {
      if (!excludeIds.includes(id)) entry.mounted = false;
    });
  }

  return { register, go, initTabs, current, resetAll, onChange };
})();

export default Router;
