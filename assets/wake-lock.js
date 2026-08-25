(() => {
  const button = document.getElementById('wake-lock-button');
  if (!button) return;

  if (!('wakeLock' in navigator)) {
    button.disabled = true;
    button.textContent = 'Keep screen on unavailable';
    return;
  }

  let enabled = false;
  let requestPending = false;
  let wakeLock = null;

  const showActive = (active) => {
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? 'Screen will stay on' : 'Keep screen on';
  };

  const acquire = async () => {
    if (!enabled || document.visibilityState !== 'visible' || wakeLock || requestPending) return;

    requestPending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!enabled || document.visibilityState !== 'visible') {
        await lock.release();
        return;
      }

      wakeLock = lock;
      lock.addEventListener('release', async () => {
        if (wakeLock !== lock) return;
        wakeLock = null;
        showActive(false);
        if (enabled && document.visibilityState === 'visible') await acquire();
      });
      showActive(true);
    } catch (error) {
      enabled = false;
      wakeLock = null;
      showActive(false);
    } finally {
      requestPending = false;
      if (enabled && document.visibilityState === 'visible' && !wakeLock) await acquire();
    }
  };

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (enabled) {
        enabled = false;
        const lock = wakeLock;
        wakeLock = null;
        if (lock) await lock.release();
        showActive(false);
      } else {
        enabled = true;
        await acquire();
      }
    } catch (error) {
      enabled = false;
      wakeLock = null;
      showActive(false);
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (enabled && document.visibilityState === 'visible' && !wakeLock) {
      try {
        await acquire();
      } catch (error) {
        enabled = false;
        showActive(false);
      }
    }
  });
})();
