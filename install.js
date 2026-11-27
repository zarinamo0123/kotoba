
(() => {
  let installPrompt = null;

  const isInstalled = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    document.getElementById("install-guide")?.remove();
  });

  function updateInstallButton() {
    const button = document.getElementById("install-direct");
    if (button) {
      button.hidden = !installPrompt || isInstalled();
    }
  }

  function createGuide() {
    if (isInstalled()) return;

    const footer = document.querySelector("footer");
    if (!footer) return;

    const style = document.createElement("style");

    style.textContent = `
      #install-guide {
        max-width: 540px;
        margin: 24px auto;
        padding: 20px;
        box-sizing: border-box;
        background: #fffdf8;
        border: 1px solid #ddd5c6;
        border-radius: 12px;
        color: #51483b;
        text-align: left;
        line-height: 1.8;
        font-size: 15px;
      }

      #install-guide [hidden] {
        display: none !important;
      }

      .install-heading {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .install-heading img {
        width: 64px;
        height: 64px;
        border-radius: 14px;
        flex-shrink: 0;
      }

      #install-guide h2 {
        font-size: 18px;
        margin: 0 0 4px;
        font-weight: 700;
      }

      #install-guide p {
        margin: 8px 0;
        line-height: 1.8;
      }

      #install-guide button {
        appearance: none;
        font: inherit;
        color: #51483b;
        background: #fffdf8;
        border: 1px solid #ddd5c6;
        border-radius: 8px;
        padding: 12px;
        min-height: 48px;
        cursor: pointer;
      }

      #install-guide button:focus-visible,
      #install-guide summary:focus-visible {
        outline: 2px solid #a45c45;
        outline-offset: 3px;
      }

      #install-direct {
        width: 100%;
        margin-top: 14px;
        background: #a45c45 !important;
        color: white !important;
        font-weight: 700 !important;
      }

      #install-guide details {
        margin-top: 14px;
      }

      #install-guide summary {
        cursor: pointer;
        padding: 12px;
        border: 1px solid #ddd5c6;
        border-radius: 8px;
        font-weight: 700;
        text-align: center;
      }

      .install-tabs {
        display: flex;
        gap: 8px;
        margin: 16px 0;
      }

      .install-tabs button {
        flex: 1;
      }

      .install-tabs button[aria-pressed="true"] {
        background: #f2e4d9 !important;
        color: #a45c45 !important;
        border-color: #a45c45 !important;
        font-weight: 700 !important;
      }

      .install-step {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 0;
        border-bottom: 1px solid #eee8dc;
      }

      .install-step h3 {
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
      }

      .install-step p {
        font-size: 14px;
      }

      .install-symbol {
        width: 52px;
        height: 52px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8f5ed;
        border: 1px solid #ddd5c6;
        border-radius: 10px;
        font-size: 28px;
      }

      .install-symbol svg {
        width: 28px;
        height: 28px;
      }

      .install-complete {
        text-align: center;
        padding: 24px 0 8px;
      }

      .install-complete img {
        width: 72px;
        height: 72px;
        border-radius: 16px;
      }

      .install-note {
        font-size: 13px;
        color: #796c5b;
      }

      @media (max-width: 700px) {
        #install-guide {
          margin: 20px 12px;
          padding: 16px;
        }
      }
    `;

    document.head.appendChild(style);

    const guide = document.createElement("section");
    guide.id = "install-guide";

    guide.innerHTML = `
      <div class="install-heading">
        <img src="icons/icon-192.png" alt="">
        <div>
          <h2>ことばを、もっと身近に。</h2>
          <p>
            ホーム画面から、いつでも
            ことばのつながりをたどれます。
          </p>
        </div>
      </div>

      <p class="install-note">
        無料・会員登録不要。
        アプリストアを開く必要もありません。
      </p>

      <button id="install-direct" type="button" hidden>
        ホーム画面に追加する
      </button>

      <details>
        <summary>ホーム画面への追加方法</summary>

        <p>
          お使いのスマートフォンを選んでください。
        </p>

        <div class="install-tabs">
          <button id="install-iphone"
                  type="button"
                  aria-pressed="false">
            iPhoneの方
          </button>

          <button id="install-android"
                  type="button"
                  aria-pressed="false">
            Androidの方
          </button>
        </div>

        <div id="install-iphone-steps" hidden>

          <div class="install-step">
            <div class="install-symbol">①</div>
            <div>
              <h3>Safariでこのサイトを開く</h3>
              <p>
                Safariは、青い方位磁針の
                マークのアプリです。
                noteやLINEの中で開いている場合は、
                このサイトのURLをコピーして
                Safariで開いてください。
              </p>
            </div>
          </div>

          <div class="install-step">
            <div class="install-symbol">
              <svg viewBox="0 0 24 24"
                   fill="none"
                   stroke="#007aff"
                   stroke-width="1.8"
                   stroke-linecap="round"
                   stroke-linejoin="round">
                <path d="M8 8H5v13h14V8h-3"/>
                <path d="M12 15V2"/>
                <path d="M8 6l4-4 4 4"/>
              </svg>
            </div>
            <div>
              <h3>② 共有ボタンを押す</h3>
              <p>
                四角から上向きの矢印が
                出ているマークです。
                見当たらない場合は、
                メニューの中を探してください。
              </p>
            </div>
          </div>

          <div class="install-step">
            <div class="install-symbol">⊞</div>
            <div>
              <h3>③「ホーム画面に追加」を押す</h3>
              <p>
                見つからない場合は、
                表示されたメニューを
                下にスクロールしてください。
              </p>
            </div>
          </div>

          <div class="install-step">
            <div class="install-symbol">④</div>
            <div>
              <h3>「追加」を押す</h3>
              <p>
                「Webアプリとして開く」
                という設定がある場合は、
                オンにしてください。
                最後に「追加」を押します。
              </p>
            </div>
          </div>

        </div>

        <div id="install-android-steps" hidden>

          <div class="install-step">
            <div class="install-symbol">①</div>
            <div>
              <h3>Chromeでこのサイトを開く</h3>
              <p>
                Chromeは、赤・黄・緑・青の
                丸いマークのアプリです。
                noteやLINEの中で開いている場合は、
                このサイトのURLをコピーして
                Chromeで開いてください。
              </p>
            </div>
          </div>

          <div class="install-step">
            <div class="install-symbol">⋮</div>
            <div>
              <h3>② 画面右上の「︙」を押す</h3>
              <p>
                縦に点が3つ並んでいる
                マークです。
              </p>
            </div>
          </div>

          <div class="install-step">
            <div class="install-symbol">⊞</div>
            <div>
              <h3>③「ホーム画面に追加」を押す</h3>
              <p>
                「アプリをインストール」と
                表示される場合もあります。
              </p>
            </div>
          </div>

          <div class="install-step">
            <div class="install-symbol">④</div>
            <div>
              <h3>「インストール」または「追加」を押す</h3>
              <p>
                確認画面が表示されたら、
                画面の案内に従ってください。
                選べる場合は
                「インストール」を選んでください。
              </p>
            </div>
          </div>

        </div>

        <div class="install-complete">
          <img src="icons/icon-192.png" alt="枝のマーク">
          <p>ことばをたどる</p>
          <strong>これで完了です！</strong>
          <p>
            次からは、ホーム画面の
            このマークを押すだけで開けます。
          </p>
        </div>

        <p class="install-note">
          ※ スマートフォンの機種やバージョンにより、
          ボタンの位置や表示される言葉が
          異なる場合があります。
        </p>

        <p class="install-note">
          うまく追加できない場合でも、
          今までどおりこのサイトをご利用いただけます。
        </p>

      </details>
    `;

    footer.prepend(guide);

    const iphoneButton =
      document.getElementById("install-iphone");

    const androidButton =
      document.getElementById("install-android");

    function selectDevice(device) {
      const iphone = device === "iphone";

      iphoneButton.setAttribute(
        "aria-pressed", String(iphone)
      );

      androidButton.setAttribute(
        "aria-pressed", String(!iphone)
      );

      document.getElementById(
        "install-iphone-steps"
      ).hidden = !iphone;

      document.getElementById(
        "install-android-steps"
      ).hidden = iphone;
    }

    iphoneButton.addEventListener("click", () => {
      selectDevice("iphone");
    });

    androidButton.addEventListener("click", () => {
      selectDevice("android");
    });

    const isAndroid =
      /Android/i.test(navigator.userAgent);

    selectDevice(isAndroid ? "android" : "iphone");

    document.getElementById("install-direct")
      .addEventListener("click", async () => {
        if (!installPrompt) return;

        const prompt = installPrompt;
        installPrompt = null;

        try {
          await prompt.prompt();
          const result = await prompt.userChoice;

          if (result.outcome === "accepted") {
            guide.remove();
          }
        } catch (error) {
          console.warn("追加処理:", error);
          guide.querySelector("details").open = true;
        }

        updateInstallButton();
      });

    updateInstallButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded", createGuide
    );
  } else {
    createGuide();
  }
})();
