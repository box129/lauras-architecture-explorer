window.LaurasTheme = (function () {
  const KEY = 'lauras-theme-preference';
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function resolve(preference) {
    if (preference === 'system') return media.matches ? 'dark' : 'light';
    return preference;
  }
  function apply(preference) {
    document.documentElement.setAttribute('data-theme', resolve(preference));
  }
  function read() {
    try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; }
  }
  function write(preference) {
    try { localStorage.setItem(KEY, preference); } catch (e) { /* preview sandbox */ }
    apply(preference);
  }

  apply(read());
  media.addEventListener('change', () => { if (read() === 'system') apply('system'); });
  return { read, write, apply, resolve };
})();
