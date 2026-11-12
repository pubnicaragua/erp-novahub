import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

interface FrameBridgeOptions {
  frameRef: RefObject<HTMLIFrameElement | null>;
  sectionRef: RefObject<HTMLElement | null>;
  userName: string;
  /** Cambia cuando el iframe se vuelve a crear o cambia de tamaño; reinicia los observadores. */
  refreshKey: string;
  streamStatusRef: MutableRefObject<'connected' | 'reconnecting'>;
  pendingProspectTargetRef: MutableRefObject<string | null>;
  pendingRouteTargetRef: MutableRefObject<string | null>;
  onFrameError: (failed: boolean) => void;
  /** El mapa terminó de cargar: aquí se reenvía lo que el ERP guardó mientras cargaba (p. ej. la búsqueda). */
  onFrameReady?: () => void;
}

/**
 * Puente entre el ERP y el iframe del mapa: comparte el tema y el área visible, comprueba que lo cargado sea el mapa
 * (y no la página de la aplicación) y entrega los destinos pendientes (punto o ruta) cuando el mapa está listo.
 */
export function useForceSalesFrameBridge({
  frameRef, sectionRef, userName, refreshKey, streamStatusRef, pendingProspectTargetRef, pendingRouteTargetRef, onFrameError, onFrameReady,
}: FrameBridgeOptions) {
  useEffect(() => {
    const frame = frameRef.current;
    const section = sectionRef.current;
    if (!frame || !section) return undefined;

    let scheduledFrame = 0;
    const publishUiContext = () => {
      scheduledFrame = 0;
      const target = frame.contentWindow;
      if (!target) return;

      const visualViewport = window.visualViewport;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const frameBounds = frame.getBoundingClientRect();
      const visibleTop = Math.max(frameBounds.top, viewportTop);
      const visibleBottom = Math.min(frameBounds.bottom, viewportTop + viewportHeight);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const styles = getComputedStyle(document.documentElement);
      const color = (token: string, fallback: string) => {
        const value = styles.getPropertyValue(token).trim();
        return value && CSS.supports('color', value) ? value : fallback;
      };

      target.postMessage({
        source: 'novahub-force-sales',
        type: 'ui-context',
        userName,
        viewport: {
          top: visibleHeight ? Math.round(visibleTop - frameBounds.top) : 0,
          bottom: visibleHeight ? Math.round(frameBounds.bottom - visibleBottom) : 0,
          height: Math.round(visibleHeight),
        },
        theme: {
          dark: document.documentElement.classList.contains('dark'),
          colors: {
            background: color('--background', '#f8fafc'),
            foreground: color('--foreground', '#11241f'),
            card: color('--card', '#ffffff'),
            muted: color('--muted', '#ececf0'),
            mutedForeground: color('--muted-foreground', '#6c7c77'),
            border: color('--border', 'rgba(0,0,0,.1)'),
            primary: color('--primary', '#01422c'),
          },
        },
      }, window.location.origin);
    };
    const scheduleUiContext = () => {
      if (scheduledFrame) return;
      scheduledFrame = requestAnimationFrame(publishUiContext);
    };
    const resizeObserver = new ResizeObserver(scheduleUiContext);
    const themeObserver = new MutationObserver(scheduleUiContext);
    const onUiContextRequest = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.source === 'novahub-force-sales' && event.data?.type === 'request-ui-context') scheduleUiContext();
    };
    resizeObserver.observe(section);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('message', onUiContextRequest);
    window.addEventListener('resize', scheduleUiContext, { passive: true });
    window.addEventListener('scroll', scheduleUiContext, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', scheduleUiContext, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleUiContext, { passive: true });
    const onFrameLoad = () => {
      if (frame.src === 'about:blank') return;
      const mapDocument = frame.contentDocument;
      if (!mapDocument?.getElementById('sheet') || !mapDocument.getElementById('map')) {
        onFrameError(true);
        frame.src = 'about:blank';
        return;
      }
      onFrameError(false);
      scheduleUiContext();
      frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-stream-status', status: streamStatusRef.current }, window.location.origin);
      const targetId = pendingProspectTargetRef.current;
      if (targetId) frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-focus-prospect', targetId }, window.location.origin);
      const routeId = pendingRouteTargetRef.current;
      if (routeId) frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-focus-route', routeId }, window.location.origin);
      onFrameReady?.();
    };
    frame.addEventListener('load', onFrameLoad);
    scheduleUiContext();

    return () => {
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', scheduleUiContext);
      window.removeEventListener('scroll', scheduleUiContext, true);
      window.visualViewport?.removeEventListener('resize', scheduleUiContext);
      window.visualViewport?.removeEventListener('scroll', scheduleUiContext);
      window.removeEventListener('message', onUiContextRequest);
      frame.removeEventListener('load', onFrameLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, userName]);
}
