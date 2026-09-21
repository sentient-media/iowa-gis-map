/**
 * Iframe embed helper. When this app is embedded in a parent page, it posts its
 * content height so the host can auto-size the iframe. Only does anything when
 * actually framed.
 *
 * Host listens with:
 *   window.addEventListener('message', (e) => {
 *     if (e.data?.type === 'cafo-map:height') iframe.style.height = e.data.height + 'px';
 *   });
 */
export function initEmbedResizer(): () => void {
  if (typeof window === 'undefined' || window.parent === window) return () => {};

  const post = () => {
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'cafo-map:height', height }, '*');
  };

  const ro = new ResizeObserver(post);
  ro.observe(document.documentElement);
  window.addEventListener('load', post);
  post();

  return () => {
    ro.disconnect();
    window.removeEventListener('load', post);
  };
}
