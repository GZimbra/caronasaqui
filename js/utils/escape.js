// ============================================================
// ESCAPE HTML — utilitário compartilhado por todos os módulos
// Evita XSS ao inserir strings no DOM via innerHTML
// ============================================================

/**
 * Converte caracteres especiais HTML em entidades seguras.
 * Deve ser usada em TODA string externa inserida via innerHTML.
 * @param {*} v - Qualquer valor; será convertido para string
 * @returns {string} String segura para inserção no DOM
 */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.esc = esc;
