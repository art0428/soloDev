/* soloDev 文件站的互動：手機選單、章節目錄跟隨捲動、複製按鈕、外觀切換。 */
(function () {
  var root = document.documentElement;

  /* ── 手機選單（覆蓋式抽屜） ── */
  var menuBtn = document.querySelector('.tnm');
  var side = document.getElementById('sd-menu');
  var scrim = document.querySelector('.sd-scrim');
  function setMenu(open) {
    root.classList.toggle('sd-open', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
    }
    if (open && side) {
      var first = side.querySelector('.sd-x');
      if (first) first.focus();
    } else if (menuBtn && document.activeElement && side && side.contains(document.activeElement)) {
      menuBtn.focus();
    }
  }
  if (menuBtn && side) {
    menuBtn.addEventListener('click', function () { setMenu(!root.classList.contains('sd-open')); });
    if (scrim) scrim.addEventListener('click', function () { setMenu(false); });
    side.addEventListener('click', function (e) {
      if (e.target.closest('a') || e.target.closest('.sd-x')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('sd-open')) setMenu(false);
    });
    window.matchMedia('(min-width:768px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ── 章節目錄：標出目前讀到哪一章 ── */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('[data-toc] a'));
  if (tocLinks.length) {
    var heads = tocLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var current = null, ticking = false;
    function spy() {
      ticking = false;
      var idx = 0;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i] && heads[i].getBoundingClientRect().top <= 120) idx = i;
      }
      if (idx === current) return;
      current = idx;
      tocLinks.forEach(function (a, i) {
        a.classList.toggle('on', i === idx);
        if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(spy); }
    }, { passive: true });
    spy();
  }

  /* ── 程式碼區塊的複製按鈕：點後顯示「已複製」兩秒 ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var pre = btn.closest('.codeblk').querySelector('pre');
    var label = btn.querySelector('span');
    function done() {
      label.textContent = '已複製';
      setTimeout(function () { label.textContent = '複製'; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pre.textContent).then(done, function () {});
    }
  });

  /* ── 外觀：跟隨系統、淺色、深色 三選一，由設計系統的 theme.js 記住 ── */
  var modeBtn = document.querySelector('.sd-mode');
  if (modeBtn && window.DS && DS.setColorScheme) {
    var order = ['system', 'light', 'dark'];
    var names = { system: '跟隨系統', light: '淺色', dark: '深色' };
    var mode = 'system';
    try { mode = localStorage.getItem('ds.scheme') || 'system'; } catch (err) {}
    if (order.indexOf(mode) < 0) mode = 'system';
    function show() {
      modeBtn.setAttribute('data-mode', mode);
      modeBtn.setAttribute('aria-label', '外觀：' + names[mode] + '，點一下切換');
      modeBtn.setAttribute('title', '外觀：' + names[mode]);
    }
    modeBtn.addEventListener('click', function () {
      mode = order[(order.indexOf(mode) + 1) % order.length];
      DS.setColorScheme(mode);
      show();
    });
    show();
  }
})();
