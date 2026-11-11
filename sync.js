/* Вход через Google (Firebase Auth) и синхронизация данных трекера в Firestore.
   Подключается одной строкой в index.html, после основного скрипта:
   <script src="sync.js"></script> */
(function () {
  const tt = (r, e) => (typeof isEn === 'function' && isEn() ? e : r);
  let fb = null, db = null, storage = null, user = null, timer = null, ready = null, status = '';

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
      // Wait until the initial browser state has loaded before cloud reconciliation.
      if (window.guideReady) await window.guideReady;
      const cfg = await (await fetch('firebase-applet-config.json')).json();
      const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
      const [A, Au, F, St] = await Promise.all([
        import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js'), import(B + 'firebase-storage.js')
      ]);
      const app = A.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId, storageBucket: cfg.storageBucket });
      const auth = Au.getAuth(app);
      db = F.getFirestore(app, cfg.firestoreDatabaseId);
      storage = St.getStorage(app);
      fb = { Au, F, St, auth };
      Au.onAuthStateChanged(auth, u => { user = u; if (u) pull(); paint(); });
    })();
    return ready;
  }

  async function push() {
    if (!user) return;
    S.ts = S.ts || Date.now();
    const { doc, setDoc } = fb.F;
    await setDoc(doc(db, 'trackers', user.uid), { json: JSON.stringify(S), ts: S.ts, key: keyGet() });
  }
  async function pull() {
    try {
      status = tt('Синхронизирую…', 'Syncing…'); paint();
      const { doc, getDoc } = fb.F;
      const snap = await getDoc(doc(db, 'trackers', user.uid));
      const rk = snap.exists() && snap.data().key;
      if (snap.exists() && (snap.data().ts || 0) > (S.ts || 0)) {
        S = JSON.parse(snap.data().json); norm();
        if (rk) keySet(rk);
        try { localStorage.setItem('moi-dni', JSON.stringify(S)); } catch (e) {}
        if (!S.set.name && user.displayName) S.set.name = user.displayName;
        rerender();
      } else {
        if (rk && !keyGet()) keySet(rk);
        norm();
        if (!S.set.name && user.displayName) S.set.name = user.displayName;
        await push();
      }
      status = tt('Данные синхронизированы', 'Data synced');
      trackSync();
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

  const MAXT = 20 * 1024 * 1024;
  let tbusy = false;
  const tmsg = s => { trkMsg = s; if (!s) trkProgress = null; renderPlayer(); };
  const tprogress = (name, percent, label) => {
    trkProgress = { name, percent: Math.max(0, Math.min(100, percent)), label };
    trkMsg = label; renderPlayer();
  };
  const setTrackState = async (id, state, cloud = false) => {
    const local = await idbAll(), item = local.find(x => x.id === id);
    if (item) { item.syncState = state; item.cloud = cloud; await idbPut(item); }
    const track = M.list.find(x => x.id === id);
    if (track) { track.syncState = state; track.cloud = cloud; }
    renderPlayer();
  };
  const storagePath = (id, name) => 'trackers/' + user.uid + '/tracks/' + id + '/' + String(name || 'audio').replace(/[\\\\/]/g, '_');
  async function trackSync() {
    if (!user || tbusy || !storage) return;
    tbusy = true;
    try {
      const { collection, getDocs, doc, setDoc, getDoc } = fb.F;
      const { ref, uploadBytesResumable, getBytes, deleteObject } = fb.St;
      const snap = await getDocs(collection(db, 'trackers', user.uid, 'tracks')), cloud = {};
      snap.forEach(d => { cloud[d.id] = d.data(); });
      const local = await idbAll(), lids = new Set(local.map(o => o.id));

      for (const o of local) {
        if (cloud[o.id] && cloud[o.id].storagePath) {
          if (!o.cloud) await setTrackState(o.id, 'cloud', true);
          continue;
        }
        if (cloud[o.id] && cloud[o.id].n && !cloud[o.id].storagePath) {
          await setTrackState(o.id, 'cloud', true);
          continue;
        }
        if (o.size > MAXT) {
          await setTrackState(o.id, 'error', false);
          tmsg(tt('Файл больше 20 МБ — не загружен', 'File over 20 MB — not uploaded'));
          continue;
        }
        try {
          const path = storagePath(o.id, o.name);
          await setTrackState(o.id, 'uploading', false);
          tprogress(o.name, 0, tt('Подготовка загрузки в облако', 'Preparing cloud upload'));
          const task = uploadBytesResumable(ref(storage, path), o.blob, {
            contentType: o.type || 'audio/mpeg',
            customMetadata: { owner: user.uid, trackId: o.id }
          });
          await new Promise((resolve, reject) => {
            task.on('state_changed', snap => {
              const percent = snap.totalBytes ? snap.bytesTransferred / snap.totalBytes * 100 : 0;
              tprogress(o.name, percent, tt('Загрузка в облако', 'Uploading to cloud'));
            }, reject, resolve);
          });
          await setDoc(doc(db, 'trackers', user.uid, 'tracks', o.id), {
            name: o.name, size: o.size, type: o.type || 'audio/mpeg',
            storagePath: path, ts: o.ts || Date.now()
          });
          await setTrackState(o.id, 'cloud', true);
        } catch (err) {
          await setTrackState(o.id, 'error', false);
          tmsg(errText(err));
        }
      }

      for (const id in cloud) {
        if (lids.has(id)) continue;
        const m = cloud[id];
        try {
          let blob;
          if (m.storagePath) {
            const bytes = await getBytes(ref(storage, m.storagePath), MAXT + 1024);
            blob = new Blob([bytes], { type: m.type || 'audio/mpeg' });
          } else if (m.n) {
            const parts = [];
            for (let i = 0; i < m.n; i++) {
              const label = tt('Загрузка из облака', 'Downloading from cloud') + ' · ' + (i + 1) + '/' + m.n;
              tprogress(m.name, i / m.n * 100, label);
              const chunk = await getDoc(doc(db, 'trackers', user.uid, 'tracks', id, 'c', String(i).padStart(4, '0')));
              if (!chunk.exists()) throw new Error('Не найден фрагмент файла: ' + (i + 1));
              const bin = atob(chunk.data().d), bytes = new Uint8Array(bin.length);
              for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
              parts.push(bytes); tprogress(m.name, (i + 1) / m.n * 100, label);
            }
            blob = new Blob(parts, { type: m.type || 'audio/mpeg' });
          } else continue;
          const o = { id, name: m.name, size: m.size, type: m.type || 'audio/mpeg', blob, cloud: true, syncState: 'cloud', ts: m.ts };
          if (!await idbPut(o)) throw new Error('Не удалось сохранить загруженный файл локально');
          M.list.push(mk(o));
        } catch (err) { tmsg(errText(err)); }
      }
      tmsg('');
    } catch (e) { tmsg(errText(e)); }
    tbusy = false;
  }
  window.trackSync = trackSync;
  window.onKey = () => save();
  window.onTrackRemove = async id => {
    if (!user) return;
    try {
      const { collection, getDocs, deleteDoc, doc } = fb.F;
      const { ref, deleteObject } = fb.St;
      const meta = await getDoc(doc(db, 'trackers', user.uid, 'tracks', id));
      if (meta.exists() && meta.data().storagePath) {
        try { await deleteObject(ref(storage, meta.data().storagePath)); } catch (e) {}
      }
      await deleteDoc(doc(db, 'trackers', user.uid, 'tracks', id));
      const cs = await getDocs(collection(db, 'trackers', user.uid, 'tracks', id, 'c'));
      for (const d of cs.docs) await deleteDoc(d.ref);
    } catch (e) { tmsg(errText(e)); }
  };

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
