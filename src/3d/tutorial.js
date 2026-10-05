(() => {
  const root = document.getElementById('dig-tutorial');
  const image = document.getElementById('tutorial-image');
  const english = document.getElementById('tutorial-en');
  const chinese = document.getElementById('tutorial-zh');
  const page = document.getElementById('tutorial-page');
  const status = document.getElementById('tutorial-status');
  const next = document.getElementById('tutorial-next');
  const slides = [
    { en: "Shovel: Dig large areas. Don't use on fragile fossils.", zh: '铲子：大面积挖土。不要用于脆弱的化石。' },
    { en: 'Brush: Sweep away loose dirt. Not for hard rock.', zh: '刷子：扫除松散泥土。不能清理坚硬岩石。' },
    { en: 'Bamboo Stick: Carefully remove hard rock around fossils.', zh: '竹签：小心清理化石周围的坚硬岩石。' },
    { en: 'Be patient, my friend. Enjoy the excavation!', zh: '耐心一点，我的朋友。享受你的挖掘吧！' },
  ];
  let index = 0;
  let active = false;

  function markLoaded() {
    next.disabled = false;
    status.textContent = '';
  }

  function update() {
    const slide = slides[index];
    image.src = `assets/tutorial/${index + 1}.webp`;
    image.alt = `Excavation tutorial illustration ${index + 1}`;
    english.textContent = slide.en;
    chinese.textContent = slide.zh;
    page.textContent = `${String(index + 1).padStart(2, '0')} / 04`;
    next.setAttribute('aria-label', index === slides.length - 1 ? 'Enter excavation site' : 'Next tutorial page');
    next.title = index === slides.length - 1 ? 'Enter excavation site' : 'Next tutorial page';
    next.disabled = true;
    status.textContent = 'Loading illustration…';
    if (image.complete && image.naturalWidth > 0) markLoaded();
  }

  image.addEventListener('load', markLoaded);
  image.addEventListener('error', () => {
    next.disabled = true;
    status.textContent = 'Unable to load illustration. Please reload.';
  });
  function advance() {
    if (next.disabled) return;
    if (index < slides.length - 1) {
      index += 1;
      update();
      return;
    }
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    active = false;
  }
  next.addEventListener('click', event => { event.stopPropagation(); advance(); });
  root.addEventListener('click', event => {
    if (event.target.closest('#tutorial-next')) return;
    advance();
  });
  update();
  window.__digTutorial = {
    get active() { return active; },
    show() {
      index = 0;
      active = true;
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
      update();
      next.focus({ preventScroll: true });
    },
  };
})();
