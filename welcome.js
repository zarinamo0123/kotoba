
(() => {
  const STORAGE_KEY = "kotoba-welcome-seen";

  function showWelcome() {
    const isApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;

    if (!isApp) return;

    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;

      localStorage.setItem(STORAGE_KEY + "-test", "1");
      localStorage.removeItem(STORAGE_KEY + "-test");
    } catch {
      return;
    }

    if (typeof HTMLDialogElement === "undefined" ||
        typeof HTMLDialogElement.prototype.showModal !== "function") {
      return;
    }

    const style = document.createElement("style");

    style.textContent = `
      #kotoba-welcome {
        position: fixed;
        inset: 0;
        margin: auto;
        width: calc(100% - 36px);
        max-width: 420px;
        max-height: 90vh;
        box-sizing: border-box;
        padding: 38px 20px 30px;
        overflow-y: auto;
        border: 1px solid #ddd5c6;
        border-radius: 20px;
        background: #fffdf8;
        color: #51483b;
        text-align: center;
        font-family: inherit;
      }

      #kotoba-welcome[open] {
        animation: kotoba-appear 0.8s ease both;
      }

      #kotoba-welcome::backdrop {
        background: rgba(81, 72, 59, 0.22);
      }

      #kotoba-welcome img {
        display: block;
        width: 112px;
        height: 112px;
        margin: 0 auto 24px;
        border-radius: 24px;
      }

      #kotoba-welcome h2 {
        margin: 0 0 26px;
        font-size: 28px;
        font-weight: 500;
        letter-spacing: 0.12em;
      }

      #kotoba-welcome .welcome-catch {
        margin: 0 0 26px;
        font-size: 18px;
        font-weight: 700;
      }

      #kotoba-welcome .welcome-message {
        margin: 0 0 32px;
        font-size: 16px;
        line-height: 2.3;
        color: #796c5b;
      }

      #kotoba-welcome .welcome-message span {
        display: block;
      }

      #kotoba-welcome button {
        width: 85%;
        min-height: 52px;
        padding: 14px 20px;
        border: 0;
        border-radius: 30px;
        background: #a45c45;
        color: #ffffff;
        font-family: inherit;
        font-size: 16px;
        letter-spacing: 0.08em;
        cursor: pointer;
      }

      #kotoba-welcome button:focus-visible {
        outline: 2px solid #a45c45;
        outline-offset: 4px;
      }

      @keyframes kotoba-appear {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #kotoba-welcome[open] {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);

    const dialog = document.createElement("dialog");

    dialog.id = "kotoba-welcome";
    dialog.setAttribute("aria-labelledby", "welcome-title");
    dialog.setAttribute("aria-describedby", "welcome-message");

    dialog.innerHTML = `
      <img src="icons/icon-192.png" alt="">

      <h2 id="welcome-title">ことばをたどる</h2>

      <p class="welcome-catch">
        乗っ取られて、嬉しい。
      </p>

      <p class="welcome-message" id="welcome-message">
        <span>誰かに乗っ取られながら、</span>
        <span>書いた人も知らない場所へ。</span>
        <span>その足あとを、たどってみませんか。</span>
      </p>

      <button type="button" id="welcome-start" autofocus>
        たどってみる
      </button>
    `;

    document.body.appendChild(dialog);

    dialog.addEventListener("close", () => {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // 保存できなくても利用を妨げない
      }

      dialog.remove();
      style.remove();
    });

    dialog.querySelector("#welcome-start")
      .addEventListener("click", () => {
        dialog.close();
      });

    try {
      dialog.showModal();
    } catch {
      dialog.remove();
      style.remove();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded", showWelcome
    );
  } else {
    showWelcome();
  }
})();
