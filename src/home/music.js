// Background music shared by the map and excavation pages.
(() => {
  const audio = new Audio('assets/audio/patientdig-bgm.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  const pageVolume = Number(document.body?.dataset.musicVolume);
  audio.volume = Number.isFinite(pageVolume) ? Math.min(1, Math.max(0, pageVolume)) : 0.22;
  let enabled = true;

  function start() {
    if (!enabled) return;
    const play = audio.play();
    if (play?.catch) play.catch(() => {});
  }

  function stop() {
    audio.pause();
  }

  function toggle() {
    enabled = !enabled;
    if (enabled) start(); else stop();
    return enabled;
  }

  window.__patientDigMusic = { audio, start, stop, toggle, get enabled() { return enabled; } };
  document.addEventListener('pointerdown', start, { capture: true });
  document.addEventListener('keydown', start, { capture: true });
})();
