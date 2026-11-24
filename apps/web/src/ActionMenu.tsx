import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useBackLayer } from './navigation';
import { ChevronDown } from './ChevronDown';

export function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ above: false, height: 240 });
  const menu = useRef<HTMLDetailsElement>(null);
  const release = useBackLayer(open, () => setOpen(false));
  const latestRelease = useRef(release);
  latestRelease.current = release;
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = menu.current
        ?.querySelector('summary')
        ?.getBoundingClientRect();
      const panel = menu.current?.querySelector('div');
      if (!rect || !panel) return;
      const below =
        innerHeight -
        rect.bottom -
        (matchMedia('(max-width: 650px)').matches ? 96 : 16);
      const above = below < panel.scrollHeight && rect.top > below;
      setPlacement({
        above,
        height: Math.max(48, above ? rect.top - 16 : below),
      });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node))
        void latestRelease.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void latestRelease
          .current()
          .then(() => menu.current?.querySelector('summary')?.focus());
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <details
      ref={menu}
      className="recurring-manage"
      open={open}
      data-placement={placement.above ? 'above' : 'below'}
      style={{ '--menu-max-height': `${placement.height}px` } as CSSProperties}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        onClick={(event) => {
          event.preventDefault();
          if (open) void release();
          else setOpen(true);
        }}
      >
        {label}
        <ChevronDown className="disclosure-icon" />
      </summary>
      <div>
        {Children.map(children, (child) => {
          if (!isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(child))
            return child;
          return cloneElement(child, {
            onClick: async (event) => {
              await release();
              child.props.onClick?.(event);
            },
          });
        })}
      </div>
    </details>
  );
}
