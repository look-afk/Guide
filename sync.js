/* Вход через Google (Firebase Auth) и синхронизация данных трекера в Firestore.
   Подключается одной строкой в index.html, после основного скрипта:
   <script src="sync.js"></script> */
(function () {
  const tt = (r, e) => (typeof isEn === 'function' && isEn() ? e : r);
  let fb = null, db = null, user = null, timer = null, ready = null, status = '';

  function norm() {
    S.set = Object.assign({ name: '', photo: '', theme: 'auto', lang: 'ru', ws: 1 }, S.set || {});
    S.chat = S.chat || []; S.tasks = S.tasks || []; S.focus = S.focus || []; S.cf = S.cf || [];
    S.days = S.days || {};
    if (!S.habits || !S.habits.length) S.habits = [{ id: 'p', name: 'Продуктивный день' }];
  }
  function rerender() {
    applyTheme(); applyLang(); renderAv(); renderPlayer(); all(); i18n(document.body);
    if (tab === 'ai') renderAI(); else if (tab === 'focus') renderFocus();
    else if (tab === 'cf') renderCF(); else if (tab === 'set') renderSet();
  }
  function errText(e) {
    const c = (e && e.code) || '';
    if (c === 'auth/unauthorized-domain') return tt('Добавь этот домен в Firebase: Authentication, Settings, Authorized domains.', 'Add this domain in Firebase: Authentication, Settings, Authorized domains.');
    if (c === 'auth/operation-not-allowed') return tt('Включи вход через Google в Firebase: Authentication, Sign-in method.', 'Enable Google sign-in in Firebase: Authentication, Sign-in method.');
    if (c === 'auth/popup-blocked') return tt('Браузер заблокировал окно входа. Разреши всплывающие окна для сайта.', 'The browser blocked the sign-in popup. Allow popups for this site.');
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'permission-denied') return tt('Нет доступа к базе. Проверь правила Firestore.', 'Access denied. Check the Firestore rules.');
    return tt('Ошибка: ', 'Error: ') + (c || (e && e.message) || '');
  }

  async function init() {
    if (ready) return ready;
    ready = (async () => {
      const cfg = await (await fetch('firebase-applet-config.json')).json();
      const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
      const [A, Au, F] = await Promise.all([
        import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')
      ]);
      const app = A.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
      const auth = Au.getAuth(app);
      db = F.getFirestore(app, cfg.firestoreDatabaseId);
      fb = { Au, F, auth };
      Au.onAuthStateChanged(auth, u => { user = u; if (u) pull(); paint(); });
    })();
    return ready;
  }

  async function push() {
    if (!user) return;
    S.ts = S.ts || Date.now();
    const { doc, setDoc } = fb.F;
    await setDoc(doc(db, 'trackers', user.uid), { json: JSON.stringify(S), ts: S.ts });
  }
  async function pull() {
    try {
      status = tt('Синхронизирую…', 'Syncing…'); paint();
      const { doc, getDoc } = fb.F;
      const snap = await getDoc(doc(db, 'trackers', user.uid));
      if (snap.exists() && (snap.data().ts || 0) > (S.ts || 0)) {
        S = JSON.parse(snap.data().json); norm();
        try { localStorage.setItem('moi-dni', JSON.stringify(S)); } catch (e) {}
        if (!S.set.name && user.displayName) S.set.name = user.displayName;
        rerender();
      } else {
        norm();
        if (!S.set.name && user.displayName) S.set.name = user.displayName;
        await push();
      }
      status = tt('Данные синхронизированы', 'Data synced');
    } catch (e) { status = errText(e); }
    paint();
  }
  function pushSoon() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await push(); status = tt('Данные синхронизированы', 'Data synced'); }
      catch (e) { status = errText(e); }
      paint();
    }, 1200);
  }

  function paint() {
    const h = [...document.querySelectorAll('#v-set .sg')].find(x => {
      const t = x.querySelector('h3'); return t && /Аккаунт|Account/.test(t.textContent);
    });
    if (!h) return;
    h.innerHTML = '<h3>' + tt('Аккаунт', 'Account') + '</h3>' + (user
      ? '<p class="nt">' + esc(user.email || user.displayName || '') + '</p><p>' + esc(status) + '</p><div class="bt"><button class="btn" id="gout">' + tt('Выйти', 'Sign out') + '</button></div>'
      : '<p>' + tt('Войди через Google, чтобы данные хранились в облаке и были на всех устройствах.', 'Sign in with Google to keep your data in the cloud on all your devices.') + '</p><button class="btn dark" id="gin">' + tt('Войти через Google', 'Sign in with Google') + '</button><p style="margin-top:10px">' + esc(status) + '</p>');
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('#gin,#gout');
    if (!b) return;
    try {
      await init();
      if (b.id === 'gin') await fb.Au.signInWithPopup(fb.auth, new fb.Au.GoogleAuthProvider());
      else { await fb.Au.signOut(fb.auth); status = ''; }
    } catch (err) { status = errText(err); }
    paint();
  });

  const _save = save;
  save = function () { S.ts = Date.now(); _save(); if (user) pushSoon(); };
  const _rs = renderSet;
  renderSet = function () { _rs(); paint(); };

  init().catch(e => { status = tt('Не удалось загрузить Firebase: ', 'Could not load Firebase: ') + (e && e.message || ''); paint(); });
})();
