import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { openBackLayer } from './navigation';

let locks = 0;
let previousOverflow = '';
export type CloseModal = (action?: () => void) => Promise<void>;

export function Modal({
  title,
  onDismiss,
  children,
  className = '',
  style,
  descriptionId,
}: {
  title: string;
  onDismiss: () => void;
  children: (close: CloseModal) => ReactNode;
  className?: string;
  style?: CSSProperties;
  descriptionId?: string;
}) {
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const release = useRef<(() => Promise<void>) | null>(null);
  const completion = useRef<(() => void) | null>(null);
  const latestDismiss = useRef(onDismiss);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  latestDismiss.current = onDismiss;
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    element.showModal();
    const initialFocus = element.querySelector<HTMLElement>(
      '[autofocus], [role="option"][aria-selected="true"]:not(:disabled)',
    );
    initialFocus?.focus({ preventScroll: true });
    initialFocus?.scrollIntoView({ block: 'nearest' });
    const viewport = window.visualViewport;
    const resize = () => {
      element.style.setProperty(
        '--dialog-viewport-height',
        `${viewport?.height ?? innerHeight}px`,
      );
      element.style.setProperty(
        '--dialog-keyboard-inset',
        `${Math.max(0, innerHeight - (viewport?.height ?? innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    if (locks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    let mounted = true;
    queueMicrotask(() => {
      if (mounted)
        release.current = openBackLayer(() => {
          (completion.current ?? latestDismiss.current)();
        });
    });
    return () => {
      mounted = false;
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      void release.current?.();
      release.current = null;
      element.close();
      if (--locks === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  async function close(action: () => void = latestDismiss.current) {
    if (completion.current) return;
    completion.current = action;
    if (release.current) await release.current();
    else action();
  }
  function resetDrag() {
    drag.current = null;
    dialog.current?.removeAttribute('data-dragging');
    dialog.current?.style.removeProperty('--dialog-drag-offset');
  }
  return createPortal(
    <dialog
      ref={dialog}
      className={`app-dialog ${className}`}
      style={style}
      aria-labelledby={heading}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        void close();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex]',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          void close();
      }}
    >
      <div
        className="dialog-header"
        onPointerDown={(event) => {
          if (
            !matchMedia('(max-width: 650px)').matches ||
            !event.isPrimary ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest('button')
          )
            return;
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          dialog.current?.setAttribute('data-dragging', '');
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) > Math.max(10, Math.abs(dy))) {
            resetDrag();
            return;
          }
          dialog.current?.style.setProperty(
            '--dialog-drag-offset',
            `${Math.max(0, dy)}px`,
          );
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          const element = dialog.current;
          if (!start || start.id !== event.pointerId || !element) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          const threshold = Math.min(
            100,
            Math.max(64, element.offsetHeight / 4),
          );
          if (dy >= threshold && dy > Math.abs(dx)) {
            drag.current = null;
            void close();
          } else resetDrag();
        }}
        onPointerCancel={resetDrag}
        onLostPointerCapture={() => {
          if (drag.current) resetDrag();
        }}
      >
        <div className="dialog-drag-handle" aria-hidden="true">
          <span />
        </div>
        <div className="dialog-heading">
          <h2 id={heading}>{title}</h2>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close dialog"
            onClick={() => void close()}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {children(close)}
    </dialog>,
    document.body,
  );
}
