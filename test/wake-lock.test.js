const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadWakeLock({ deferRequest = 0, deferRelease = 0 } = {}) {
  const listeners = {};
  const documentListeners = {};
  const sentinels = [];
  const attributes = {};
  const button = {
    disabled: false,
    textContent: 'Keep screen on',
    addEventListener(type, callback) { listeners[type] = callback; },
    setAttribute(name, value) { attributes[name] = value; }
  };
  let releases = 0;
  let requests = 0;
  let resolveRequest;
  let resolveRelease;
  const document = {
    visibilityState: 'visible',
    getElementById(id) { return id === 'wake-lock-button' ? button : null; },
    addEventListener(type, callback) { documentListeners[type] = callback; }
  };
  const navigator = {
    wakeLock: {
      async request(type) {
        assert.equal(type, 'screen');
        requests += 1;
        const requestNumber = requests;
        if (requests === deferRequest) {
          await new Promise((resolve) => { resolveRequest = resolve; });
        }
        const sentinelListeners = {};
        const sentinel = {
          listeners: sentinelListeners,
          addEventListener(eventType, callback) { sentinelListeners[eventType] = callback; },
          async release() {
            releases += 1;
            if (requestNumber === deferRelease) {
              await new Promise((resolve) => { resolveRelease = resolve; });
            }
          }
        };
        sentinels.push(sentinel);
        return sentinel;
      }
    }
  };

  const source = fs.readFileSync('assets/wake-lock.js', 'utf8');
  vm.runInNewContext(source, { document, navigator });

  return {
    attributes,
    button,
    click: () => listeners.click(),
    async resumeAfterAutomaticRelease() {
      document.visibilityState = 'hidden';
      sentinels[0].listeners.release();
      document.visibilityState = 'visible';
      await documentListeners.visibilitychange();
    },
    async resumeBeforeDelayedReleaseEvent() {
      document.visibilityState = 'hidden';
      document.visibilityState = 'visible';
      await documentListeners.visibilitychange();
      await sentinels[0].listeners.release();
    },
    beginPendingReacquire() {
      document.visibilityState = 'hidden';
      sentinels[0].listeners.release();
      document.visibilityState = 'visible';
      return documentListeners.visibilitychange();
    },
    fireRelease: (index) => sentinels[index].listeners.release(),
    resolveRequest: () => resolveRequest(),
    resolveRelease: () => resolveRelease(),
    releases: () => releases,
    requests: () => requests
  };
}

test('mobile recipe control requests a screen wake lock', async () => {
  const page = loadWakeLock();

  await page.click();

  assert.equal(page.requests(), 1);
  assert.equal(page.attributes['aria-pressed'], 'true');
  assert.equal(page.button.textContent, 'Screen will stay on');
});

test('active control releases the wake lock when tapped again', async () => {
  const page = loadWakeLock();

  await page.click();
  await page.click();

  assert.equal(page.releases(), 1);
  assert.equal(page.attributes['aria-pressed'], 'false');
  assert.equal(page.button.textContent, 'Keep screen on');
});

test('enabled control reacquires the wake lock when the recipe becomes visible again', async () => {
  const page = loadWakeLock();

  await page.click();
  await page.resumeAfterAutomaticRelease();

  assert.equal(page.requests(), 2);
  assert.equal(page.attributes['aria-pressed'], 'true');
});

test('enabled control reacquires after a delayed release event arrives on a visible recipe', async () => {
  const page = loadWakeLock();

  await page.click();
  await page.resumeBeforeDelayedReleaseEvent();

  assert.equal(page.requests(), 2);
  assert.equal(page.attributes['aria-pressed'], 'true');
});

test('turning the control off during a pending request releases the late lock', async () => {
  const page = loadWakeLock({ deferRequest: 2 });

  await page.click();
  const reacquire = page.beginPendingReacquire();
  await page.click();
  page.resolveRequest();
  await reacquire;

  assert.equal(page.requests(), 2);
  assert.equal(page.releases(), 1);
  assert.equal(page.attributes['aria-pressed'], 'false');
});

test('re-enabling during a delayed late-lock release requests a fresh lock', async () => {
  const page = loadWakeLock({ deferRequest: 2, deferRelease: 2 });

  await page.click();
  const reacquire = page.beginPendingReacquire();
  await page.click();
  page.resolveRequest();
  await new Promise(setImmediate);
  await page.click();
  page.resolveRelease();
  await reacquire;

  assert.equal(page.requests(), 3);
  assert.equal(page.attributes['aria-pressed'], 'true');
});

test('a stale release event cannot clear a newer wake lock', async () => {
  const page = loadWakeLock();

  await page.click();
  await page.click();
  await page.click();
  await page.fireRelease(0);

  assert.equal(page.requests(), 2);
  assert.equal(page.attributes['aria-pressed'], 'true');
  assert.equal(page.button.textContent, 'Screen will stay on');
});

test('every recipe page includes a mobile-only wake lock control', () => {
  const layout = fs.readFileSync('_layouts/recipe.html', 'utf8');
  const styles = fs.readFileSync('assets/main.scss', 'utf8');

  assert.match(layout, /id="wake-lock-button"/);
  assert.match(layout, /assets\/wake-lock\.js/);
  assert.match(styles, /\.wake-lock-control\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /@media\s*\(max-width:\s*960px\)\s*and\s*\(pointer:\s*coarse\)[^{]*\{[\s\S]*\.wake-lock-control\s*\{[^}]*display:\s*block/);
});
