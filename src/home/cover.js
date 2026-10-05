// Bind before the 3D bundle: the cover button works even while models load.
(() => {
  const cover = document.getElementById('game-cover');
  const start = document.getElementById('cover-start');
  const story = document.getElementById('game-story');
  const pages = [...story.querySelectorAll('.story-image')];
  const next = document.getElementById('story-next');
  const status = document.getElementById('story-status');
  let current = 0;
  const background = [...document.body.children].filter(el => el !== cover && el !== story && el.tagName !== 'SCRIPT');
  background.forEach(el => { el.inert = true; });
  function updatePage() {
    pages.forEach((page, i) => { page.hidden = i !== current; });
    document.getElementById('story-page').textContent = `${String(current + 1).padStart(2, '0')} / 04`;
    const label = current === pages.length - 1 ? 'Begin Investigation' : 'Next';
    next.setAttribute('aria-label', label);
    next.title = label;
    document.getElementById('story-next-label').textContent = label;
    const loaded = pages[current].complete && pages[current].naturalWidth > 0;
    next.disabled = !loaded;
    status.textContent = loaded ? '' : 'Loading illustration…';
  }
  pages.forEach((page, i) => {
    page.addEventListener('load', () => { if (i === current) updatePage(); });
    page.addEventListener('error', () => {
      if (i === current) { status.textContent = 'Unable to load illustration. Please reload.'; next.disabled = true; }
    });
  });
  start.addEventListener('click', () => {
    cover.hidden = true;
    story.hidden = false;
    updatePage();
    next.focus({ preventScroll:true });
  }, { once:true });
  next.addEventListener('click', () => {
    if (current < pages.length - 1) { current++; updatePage(); return; }
    story.hidden = true;
    background.forEach(el => { el.inert = false; });
    document.getElementById('nav-map').focus({ preventScroll:true });
  });
})();
