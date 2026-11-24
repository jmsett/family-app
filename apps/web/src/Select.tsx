import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type SelectHTMLAttributes,
} from 'react';
import { Modal } from './Modal';

interface Choice {
  value: string;
  label: string;
  disabled: boolean;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const select = useRef<HTMLSelectElement>(null);
  const [picker, setPicker] = useState<{
    title: string;
    options: Choice[];
    style: CSSProperties;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const list = useId();
  const typeahead = useRef({ text: '', time: 0 });
  function open() {
    const element = select.current;
    if (!element || element.matches(':disabled') || picker) return;
    element.focus({ preventScroll: true });
    const label = element.labels?.[0]?.cloneNode(true) as
      HTMLElement | undefined;
    label
      ?.querySelectorAll('select, input, small, button')
      .forEach((node) => node.remove());
    const title =
      props['aria-label'] ?? label?.textContent?.trim() ?? 'Choose an option';
    const rect = element.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 300), innerWidth - 32);
    const maxHeight = Math.min(440, innerHeight - 32);
    const top =
      rect.bottom + 8 + maxHeight <= innerHeight
        ? rect.bottom + 8
        : Math.max(16, rect.top - maxHeight - 8);
    setQuery('');
    setActive(element.value);
    setPicker({
      title,
      options: Array.from(element.options, (option) => ({
        value: option.value,
        label: option.label,
        disabled:
          option.disabled ||
          (option.parentElement instanceof HTMLOptGroupElement &&
            option.parentElement.disabled),
      })),
      style: {
        '--picker-left': `${Math.min(Math.max(16, rect.left), innerWidth - width - 16)}px`,
        '--picker-top': `${top}px`,
        '--picker-width': `${width}px`,
        '--picker-height': `${maxHeight}px`,
      } as CSSProperties,
    });
  }
  const visible =
    picker?.options.filter((option) =>
      option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ) ?? [];
  const focused = visible.some(
    (option) => option.value === active && !option.disabled,
  )
    ? active
    : visible.find((option) => !option.disabled)?.value;
  return (
    <>
      <select
        {...props}
        ref={select}
        className={`app-select ${props.className ?? ''}`}
        aria-haspopup="dialog"
        aria-expanded={!!picker}
        aria-controls={picker ? list : undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          open();
        }}
        onClick={(event) => {
          event.preventDefault();
          open();
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (
            !event.defaultPrevented &&
            (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(
              event.key,
            ) ||
              event.key.length === 1)
          ) {
            event.preventDefault();
            open();
          }
        }}
      >
        {props.children}
      </select>
      {picker && (
        <Modal
          title={picker.title}
          onDismiss={() => setPicker(null)}
          className="select-dialog"
          style={picker.style}
        >
          {(close) => (
            <>
              {picker.options.length > 7 && (
                <div className="picker-search">
                  <input
                    aria-label={`Search ${picker.title}`}
                    placeholder="Search options…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus
                  />
                </div>
              )}
              <div
                className="picker-options"
                role="listbox"
                aria-label={picker.title}
                id={list}
                onKeyDown={(event) => {
                  const items = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      '[role="option"]:not(:disabled)',
                    ),
                  );
                  const index = items.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  let next: number | undefined;
                  if (event.key === 'ArrowDown')
                    next = (index + 1) % items.length;
                  if (event.key === 'ArrowUp')
                    next = (index - 1 + items.length) % items.length;
                  if (event.key === 'Home') next = 0;
                  if (event.key === 'End') next = items.length - 1;
                  if (event.key.length === 1 && event.key !== ' ') {
                    const now = Date.now();
                    typeahead.current = {
                      text:
                        (now - typeahead.current.time < 700
                          ? typeahead.current.text
                          : '') + event.key.toLocaleLowerCase(),
                      time: now,
                    };
                    const found = items.findIndex((item) =>
                      item.textContent
                        ?.toLocaleLowerCase()
                        .startsWith(typeahead.current.text),
                    );
                    if (found >= 0) next = found;
                  }
                  if (next !== undefined) {
                    event.preventDefault();
                    items[next]?.focus();
                  }
                }}
              >
                {visible.map((option) => (
                  <button
                    type="button"
                    role="option"
                    key={option.value}
                    disabled={option.disabled}
                    tabIndex={option.value === focused ? 0 : -1}
                    onFocus={() => setActive(option.value)}
                    aria-selected={select.current?.value === option.value}
                    autoFocus={
                      picker.options.length <= 7 &&
                      select.current?.value === option.value
                    }
                    onClick={() =>
                      void close(() => {
                        const element = select.current;
                        if (element) {
                          element.value = option.value;
                          element.dispatchEvent(
                            new Event('change', { bubbles: true }),
                          );
                        }
                        setPicker(null);
                      })
                    }
                  >
                    <span>{option.label}</span>
                    <span className="option-check" aria-hidden="true">
                      {select.current?.value === option.value ? '✓' : ''}
                    </span>
                  </button>
                ))}
                {!visible.length && (
                  <p className="picker-empty" role="status">
                    No matching options
                  </p>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
