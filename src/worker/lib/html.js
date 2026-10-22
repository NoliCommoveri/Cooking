// Escaping for the one page the Worker renders as HTML itself: /ops. The app's
// screens are built in the browser with text nodes, so they don't need it.
export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
