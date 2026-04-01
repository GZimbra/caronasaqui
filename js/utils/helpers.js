// ============================================================
// TOAST — sistema de notificações visuais
// ============================================================

const TOAST_ICONS = {
  sucesso: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  erro:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  aviso:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

const TOAST_STYLES = {
  sucesso: { accent: "#2ecc71", bg: "rgba(46,204,113,0.10)", border: "rgba(46,204,113,0.25)" },
  erro:    { accent: "#e55",    bg: "rgba(238,85,85,0.10)",  border: "rgba(238,85,85,0.25)"  },
  aviso:   { accent: "#f5a623", bg: "rgba(245,166,35,0.10)", border: "rgba(245,166,35,0.25)" },
  info:    { accent: "#4f9eff", bg: "rgba(79,158,255,0.10)", border: "rgba(79,158,255,0.25)" },
};

// Injeta o CSS uma única vez
(function injetarToastCSS() {
  if (document.getElementById("toast-style")) return;
  const s = document.createElement("style");
  s.id = "toast-style";
  s.textContent = `
    #toast-container {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      gap: 10px;
      z-index: 99999;
      pointer-events: none;
    }

    .toast-item {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 13px 18px 13px 14px;
      border-radius: 12px;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      font-size: 13.5px;
      font-weight: 500;
      line-height: 1.4;
      letter-spacing: 0.01em;
      min-width: 240px;
      max-width: min(420px, 90vw);
      backdrop-filter: blur(12px);
      border: 1px solid;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
      pointer-events: auto;
      cursor: default;
      opacity: 0;
      transform: translateY(16px) scale(0.96);
      transition: opacity 0.28s cubic-bezier(0.16,1,0.3,1),
                  transform 0.28s cubic-bezier(0.16,1,0.3,1);
    }

    .toast-item.toast-show {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .toast-item.toast-hide {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
      transition: opacity 0.22s ease, transform 0.22s ease;
    }

    .toast-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .toast-msg {
      flex: 1;
    }

    .toast-close {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.4;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.15s;
      background: none;
      border: none;
      padding: 0;
      color: inherit;
      font-size: 16px;
      line-height: 1;
    }

    .toast-close:hover { opacity: 0.9; }

    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      border-radius: 0 0 12px 12px;
      width: 100%;
      transform-origin: left;
      animation: toastProgress var(--toast-duration, 3s) linear forwards;
    }

    @keyframes toastProgress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
  `;
  document.head.appendChild(s);
})();

function _getOrCreateContainer() {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    document.body.appendChild(c);
  }
  return c;
}

function showToast(msg, tipo = "info", duracao = 3500) {
  const s  = TOAST_STYLES[tipo] || TOAST_STYLES.info;
  const ic = TOAST_ICONS[tipo]  || TOAST_ICONS.info;

  const item = document.createElement("div");
  item.className = "toast-item";
  item.style.cssText = `
    background: ${s.bg};
    border-color: ${s.border};
    color: ${s.accent};
    --toast-duration: ${duracao}ms;
    position: relative;
    overflow: hidden;
  `;

  item.innerHTML = `
    <span class="toast-icon">${ic}</span>
    <span class="toast-msg" style="color:#f0f2f5">${msg}</span>
    <button class="toast-close" title="Fechar">✕</button>
    <div class="toast-progress" style="background:${s.accent};opacity:0.4"></div>
  `;

  item.querySelector(".toast-close").onclick = () => _fecharToast(item);

  _getOrCreateContainer().appendChild(item);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => item.classList.add("toast-show"));
  });

  setTimeout(() => _fecharToast(item), duracao);
}

function _fecharToast(item) {
  item.classList.remove("toast-show");
  item.classList.add("toast-hide");
  setTimeout(() => item.remove(), 250);
}

// Substitui alert() nativo por toast de erro (mais elegante)
window._alertOriginal = window.alert;
window.alert = function(msg) {
  // Detecta tipo pela mensagem
  const lower = String(msg).toLowerCase();
  const tipo =
    lower.includes("erro") || lower.includes("error") || lower.includes("não foi possível") || lower.includes("nao foi possivel")
      ? "erro"
    : lower.includes("sucesso") || lower.includes("criada") || lower.includes("enviada") || lower.includes("atualizada")
      ? "sucesso"
    : lower.includes("atenção") || lower.includes("atencao") || lower.includes("já") || lower.includes("permita")
      ? "aviso"
      : "info";

  showToast(msg, tipo);
};

window.showToast = showToast;
