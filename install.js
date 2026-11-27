(() => {
  'use strict';
  const URL = 'https://zarinamo0123.github.io/kotoba/';
  let pending = null;
  let installed = false;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const apple = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(navigator.platform || '') && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if (!apple && !android) return;
  const $ = id => document.getElementById(id);
  const icons = {
    safari: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#168eea" stroke="#fff" stroke-width="2"/><circle cx="24" cy="24" r="16" fill="none" stroke="#fff" stroke-dasharray="1 3" stroke-width="2"/><path d="M33 13 27 27 15 35 21 21Z" fill="white"/><path d="M33 13 27 27 21 21Z" fill="#e94c4c"/></svg>',
    chrome: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#e94235"/><path d="M5 15 A21 21 0 0 0 24 45 L34 27 17 27Z" fill="#34a853"/><path d="M24 45 A21 21 0 0 0 44 16 L24 16 34 27Z" fill="#fbbc05"/><circle cx="24" cy="24" r="10" fill="#4285f4" stroke="white" stroke-width="2"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8H5v13h14V8h-3M12 15V2M8 6l4-4 4 4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 7v10M7 12h10"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/></svg>'
  };
  function step(n, icon, title, detail) {
    return `<li class="ig-step"><span class="ig-number" aria-hidden="true">${n}</span><span class="ig-symbol">${icons[icon]}</span><div><strong>${title}</strong><p>${detail}</p></div></li>`;
  }
  function trouble(title, body, group = 'both') {
    return `<details class="ig-help" data-device="${group}"><summary>${title}</summary><div class="ig-answer">${body}</div></details>`;
  }
  function refresh() {
    if (installed || standalone()) { $('install-guide')?.remove(); return; }
    const direct = $('install-direct');
    if (!direct) return;
    const canPrompt = !!pending && !apple;
    direct.hidden = !canPrompt;
    $('install-method').classList.toggle('ig-primary-method', !canPrompt);
    $('install-method-label').textContent = canPrompt ? 'ボタンで追加できないとき・手動での追加方法' : 'ホーム画面に追加する方法';
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); pending = event; refresh();
  });
  window.addEventListener('appinstalled', () => {
    installed = true; pending = null; refresh();
  });
  function build() {
    if (installed || standalone() || $('install-guide')) return;
    const footer = document.querySelector('footer');
    if (!footer) return;
    const style = document.createElement('style');
    style.textContent = `
      #install-guide{max-width:540px;margin:24px auto;padding:20px;box-sizing:border-box;background:#fffdf8;border:1px solid #ddd5c6;border-radius:12px;color:#51483b;text-align:left;font-size:16px;line-height:1.75;letter-spacing:normal;overflow-wrap:anywhere}
      #install-guide *{box-sizing:border-box} #install-guide [hidden]{display:none!important}
      #install-guide p{margin:6px 0;line-height:1.75} #install-guide h2{font-size:19px;margin:0 0 3px} #install-guide h3{font-size:16px;margin:18px 0 8px}
      .ig-heading{display:flex;align-items:center;gap:14px}.ig-heading img{width:60px;height:60px;border-radius:14px;flex-shrink:0}
      #install-guide .ig-note{font-size:14px;color:#796c5b}
      #install-guide button,#install-guide summary{font:inherit;color:#51483b;background:#fffdf8;border:1px solid #ddd5c6;border-radius:8px;padding:12px;min-height:48px;cursor:pointer;white-space:normal}
      #install-guide button:focus-visible,#install-guide summary:focus-visible,#install-guide input:focus-visible{outline:2px solid #a45c45;outline-offset:3px}
      #install-direct,#install-guide .ig-primary-method>summary{background:#a45c45!important;color:#fff!important;font-weight:700!important;width:100%;text-align:center}
      #install-direct{margin-top:12px} #install-method{margin-top:12px} #install-method>summary{font-weight:700;text-align:center}
      .ig-tabs{display:flex;gap:8px;margin:14px 0}.ig-tabs button{flex:1;min-width:0}.ig-tabs button[aria-pressed=true]{background:#f2e4d9!important;color:#914b36!important;border-color:#a45c45!important;font-weight:700!important}
      .ig-steps{padding:0!important;margin:0!important;list-style:none!important}.ig-step{display:grid;grid-template-columns:23px 42px minmax(0,1fr);gap:9px;align-items:start;padding:14px 0;border-bottom:1px solid #eee8dc}.ig-step strong{font-size:16px}.ig-step p{font-size:15px}.ig-number{font-weight:bold;color:#914b36}.ig-symbol{width:42px;height:42px;display:grid;place-items:center;background:#f8f5ed;border-radius:9px}.ig-symbol svg{width:31px;height:31px}
      .ig-complete{text-align:center;padding:20px 0}.ig-complete img{width:64px;height:64px;border-radius:14px}.ig-help{margin:8px 0}.ig-help>summary{text-align:left;font-weight:500}.ig-answer{padding:10px 6px 14px;font-size:15px}.ig-copy{width:100%;margin:8px 0}.ig-url{width:100%;padding:10px;border:1px solid #ddd5c6;border-radius:6px;font-size:16px;color:#51483b;background:#fff}.ig-copy-status{font-size:14px;min-height:1.5em;color:#51483b}
      @media(max-width:700px){#install-guide{margin:20px 12px;padding:16px}}
    `;
    document.head.appendChild(style);
    const guide = document.createElement('section');
    guide.id = 'install-guide';
    guide.setAttribute('aria-labelledby','install-heading');
    guide.innerHTML = `
      <div class="ig-heading"><img src="icons/icon-192.png" alt=""><div><h2 id="install-heading">ことばを、もっと身近に。</h2><p>ホーム画面から、いつでもことばのつながりをたどれます。</p></div></div>
      <p class="ig-note">無料・会員登録不要。アプリストアを開く必要もありません。</p>
      <button id="install-direct" type="button" hidden>ホーム画面に追加する</button>
      <p id="install-result" class="ig-note" role="status" hidden></p>
      <details id="install-method"><summary id="install-method-label">ホーム画面に追加する方法</summary>
        <p>お使いのスマートフォン・タブレットを選んでください。</p>
        <div class="ig-tabs" role="group" aria-label="端末の種類"><button type="button" id="install-iphone" aria-pressed="false">iPhone・iPad</button><button type="button" id="install-android" aria-pressed="false">Android</button></div>
        <div id="install-iphone-steps" hidden><ol class="ig-steps">
          ${step(1,'safari','Safariでこのサイトを開く','青い方位磁針のマークのアプリです。すでにSafariで開いている方は次へ。')}
          ${step(2,'share','共有ボタンを押す','四角から上向きの矢印が出たマークです。見当たらなければ「…」などのメニューから「共有」を探します。')}
          ${step(3,'plus','「ホーム画面に追加」を押す','共有メニューを下へスクロールして探してください。')}
          ${step(4,'check','「追加」を押す','「ウェブアプリとして開く」が表示される場合はオンにしてから追加します。')}
        </ol></div>
        <div id="install-android-steps" hidden><ol class="ig-steps">
          ${step(1,'chrome','Chromeでこのサイトを開く','赤・黄・緑・青の丸いマークのアプリです。すでにChromeで開いている方は次へ。')}
          ${step(2,'dots','「︙」を押す','アドレス欄の近くにある、縦に点が3つ並んだマークです。')}
          ${step(3,'plus','追加・インストールの項目を押す','「ホーム画面に追加」「アプリをインストール」「インストールしてショートカットを作成」などの表示を探します。')}
          ${step(4,'check','画面の案内に従って追加する','「インストール」が選べる場合は選び、確認画面でも追加してください。')}
        </ol></div>
        <div class="ig-complete"><img src="icons/icon-192.png" alt="ことばをたどるの枝のマーク"><p><strong>これで完了です！</strong></p><p>次からは、ホーム画面のこのマークを押すだけで開けます。</p></div>
        <h3>うまくいかないときは</h3>
        ${trouble('note・LINEなどから開いている／ブラウザで開く方法がわからない',`<p>次のボタンでサイトのURLをコピーします。</p><button type="button" id="install-copy" class="ig-copy">サイトのURLをコピーする</button><input id="install-url" class="ig-url" type="text" readonly aria-label="サイトのURL" value="${URL}"><p id="install-copy-status" class="ig-copy-status" role="status"></p><p>① ホーム画面に戻り、<span id="install-browser-name">Safari</span>を開きます。</p><p>② アドレス欄を長押しし、「ペースト」または「貼り付け」を選びます。</p><p>③「開く」「移動」などを押して、サイトを開き直します。</p>`)}
        ${trouble('共有ボタンが見つからない','<p>Safariの画面を軽く上下に動かすか、アドレス欄を押して操作ボタンを表示します。共有マークがなければ「…」などのページメニューを開きます。iPadでは画面上部にもご注意ください。</p>','iphone')}
        ${trouble('「ホーム画面に追加」が見つからない','<p>共有メニューを下へスクロールします。「表示を増やす」があれば押してください。「アクションを編集」があれば開いて、ホーム画面に追加の項目がないか確認してください。</p><p>それでも見つからなければ、Safariで開き直してみてください。</p>','iphone')}
        ${trouble('追加ボタンやメニューが見つからない','<p>Chromeでこのサイトを開き直してください。すでにアプリが追加されている場合や、ブラウザが直接追加に対応していない場合にもボタンが出ないことがあります。ホーム画面やアプリ一覧も確認してください。</p>','android')}
        ${trouble('追加したアイコンが見つからない','<p>ホーム画面を左右にめくって、枝のマークを探してください。端末によってはアプリ一覧や検索から「ことばをたどる」を探せます。見つかったアイコンから開いてください。</p>')}
        ${trouble('パソコンで見ている／どの端末かわからない',`<p>スマートフォンでこのURLを開いてください。iPhone・iPadならSafari、その他のAndroid端末ならChromeから開くのがおすすめです。</p><p>${URL}</p><p>端末がわからなければ、両方の説明を切り替えて、画面に合うものをご確認ください。</p>`)}
        <p class="ig-note">機種やOS、ブラウザによって、ボタンの位置や名前が異なります。追加できなくても、今までどおりこのサイトを使えます。</p>
      </details>`;
    footer.prepend(guide);
    function select(device) {
      const ios = device === 'iphone';
      $('install-iphone').setAttribute('aria-pressed', String(ios));
      $('install-android').setAttribute('aria-pressed', String(!ios));
      $('install-iphone-steps').hidden = !ios;
      $('install-android-steps').hidden = ios;
      $('install-browser-name').textContent = ios ? 'Safari' : 'Chrome';
      guide.querySelectorAll('[data-device]').forEach(d => { d.hidden = d.dataset.device !== 'both' && d.dataset.device !== device; });
    }
    $('install-iphone').addEventListener('click', () => select('iphone'));
    $('install-android').addEventListener('click', () => select('android'));
    select(android ? 'android' : 'iphone');
    $('install-copy').addEventListener('click', async () => {
      const status = $('install-copy-status');
      try { await navigator.clipboard.writeText(URL); status.textContent = 'URLをコピーしました。'; }
      catch (_) {
        const input = $('install-url'); input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
        status.textContent = '自動でコピーできませんでした。上のURLを長押しして「コピー」を選んでください。';
      }
    });
    $('install-direct').addEventListener('click', async () => {
      if (!pending) { $('install-method').open = true; return; }
      const prompt = pending; pending = null;
      $('install-direct').disabled = true;
      try {
        await prompt.prompt();
        const result = await prompt.userChoice;
        if (result.outcome === 'accepted' && !installed) {
          const message = $('install-result');
          if (message) { message.hidden = false; message.textContent = '画面の案内が完了したら、ホーム画面の枝のマークを探してください。'; }
        }
      } catch (_) {
        if ($('install-method')) $('install-method').open = true;
      } finally {
        if ($('install-direct')) $('install-direct').disabled = false;
        refresh();
      }
    });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, {once:true});
  else build();
})();
