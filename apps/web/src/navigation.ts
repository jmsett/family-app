import { useEffect, useRef, useSyncExternalStore } from 'react';

export type AppView =
  'overview' | 'plan' | 'charts' | 'investments' | 'travel' | 'settings';
export interface Screen {
  view: AppView;
  trip: { label: string; start: string | null; end: string | null } | null;
}
interface Entry {
  index: number;
  screen: Screen;
  layers: string[];
}
interface Layer {
  close: () => void;
  beforeBack?: () => Promise<boolean>;
}
const KEY = 'familyNavigation';
let current: Entry = {
  index: 0,
  screen: { view: 'overview', trip: null },
  layers: [],
};
const subscribers = new Set<() => void>();
const layers = new Map<string, Layer>();
let guard: (() => Promise<boolean>) | null = null;
let restoring: (() => void) | null = null;
let skipGuard = false;
let handlingBack = false;
const pendingCloses = new Map<
  string,
  { resolve: () => void; promise: Promise<void> }
>();

function readEntry(state: unknown): Entry | null {
  const entry = (state as Record<string, Entry> | null)?.[KEY];
  return entry &&
    Number.isInteger(entry.index) &&
    entry.screen &&
    [
      'overview',
      'plan',
      'charts',
      'investments',
      'travel',
      'settings',
    ].includes(entry.screen.view) &&
    Array.isArray(entry.layers)
    ? entry
    : null;
}
function write(entry: Entry, replace = false) {
  const state = { ...history.state, [KEY]: entry };
  if (replace) history.replaceState(state, '');
  else history.pushState(state, '');
  apply(entry);
}
function apply(entry: Entry) {
  const removed = current.layers.filter((id) => !entry.layers.includes(id));
  current = entry;
  for (const id of removed.reverse()) {
    const layer = layers.get(id);
    layers.delete(id);
    layer?.close();
    pendingCloses.get(id)?.resolve();
    pendingCloses.delete(id);
  }
  for (const notify of subscribers) notify();
}
async function onPop(event: PopStateEvent) {
  const target = readEntry(event.state);
  if (restoring) {
    const done = restoring;
    restoring = null;
    done();
    return;
  }
  if (!target) return; // At the app's first screen, retain normal browser exit behavior.
  const source = current;
  const removed = source.layers.filter((id) => !target.layers.includes(id));
  const top = layers.get(removed.at(-1) ?? '');
  const beforeBack =
    target.screen.view !== source.screen.view ? guard : top?.beforeBack;
  if (!skipGuard && beforeBack) {
    if (handlingBack) return;
    handlingBack = true;
    await new Promise<void>((resolve) => {
      restoring = resolve;
      history.go(source.index - target.index);
    });
    const accepted = await beforeBack();
    handlingBack = false;
    if (accepted) {
      skipGuard = true;
      history.go(target.index - source.index);
    }
    return;
  }
  skipGuard = false;
  // A dismissed overlay cannot be reopened with stale component callbacks on Forward.
  const valid = {
    ...target,
    layers: target.layers.filter((id) => layers.has(id)),
  };
  history.replaceState({ ...history.state, [KEY]: valid }, '');
  apply(valid);
  if (target.screen.view !== source.screen.view)
    window.scrollTo({ top: 0, behavior: 'instant' });
}

export function initializeNavigation() {
  current = { ...current, index: readEntry(history.state)?.index ?? 0 };
  write(current, true);
  window.addEventListener('popstate', onPop);
}
export function useNavigation(
  beforeLeave: () => Promise<boolean>,
  protect: boolean,
) {
  const latestGuard = useRef(beforeLeave);
  latestGuard.current = beforeLeave;
  useEffect(() => {
    guard = protect ? () => latestGuard.current() : null;
    return () => {
      guard = null;
    };
  }, [protect]);
  const screen = useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      return () => {
        subscribers.delete(notify);
      };
    },
    () => current.screen,
  );
  async function navigate(view: AppView, trip: Screen['trip'] = null) {
    await Promise.all(
      [...pendingCloses.values()].map((pending) => pending.promise),
    );
    if (view === current.screen.view && trip === current.screen.trip)
      return false;
    if (handlingBack || !(await latestGuard.current())) return false;
    // Remove transient editor/menu entries before recording the next screen.
    // Otherwise Back would visit the parent twice after leaving an editor.
    if (current.layers.length) await closeBackLayer(current.layers[0]);
    write({ index: current.index + 1, screen: { view, trip }, layers: [] });
    window.scrollTo({ top: 0, behavior: 'instant' });
    return true;
  }
  return { screen, navigate };
}
export function openBackLayer(
  close: () => void,
  beforeBack?: () => Promise<boolean>,
) {
  if (pendingCloses.size) {
    const ready = Promise.all(
      [...pendingCloses.values()].map((pending) => pending.promise),
    ).then(() => openBackLayer(close, beforeBack));
    return async () => {
      await (
        await ready
      )();
    };
  }
  const id = crypto.randomUUID();
  layers.set(id, { close, beforeBack });
  write({
    ...current,
    index: current.index + 1,
    layers: [...current.layers, id],
  });
  return () => closeBackLayer(id);
}
function closeBackLayer(id: string): Promise<void> {
  if (!layers.has(id)) return Promise.resolve();
  const existing = pendingCloses.get(id);
  if (existing) return existing.promise;
  let done!: () => void;
  const promise = new Promise<void>((resolve) => {
    done = resolve;
  });
  const position = current.layers.indexOf(id);
  pendingCloses.set(id, { resolve: done, promise });
  skipGuard = true;
  history.go(-(current.layers.length - position));
  return promise;
}

/** Inline editors participate in Back without putting private form values in history. */
export function useBackLayer(
  active: boolean,
  close: () => void,
  beforeBack?: () => Promise<boolean>,
) {
  const latest = useRef({ close, beforeBack });
  const releaseRef = useRef<(() => Promise<void>) | null>(null);
  latest.current = { close, beforeBack };
  useEffect(() => {
    let mounted = true;
    let release: (() => Promise<void>) | undefined;
    queueMicrotask(() => {
      if (mounted && active) {
        release = openBackLayer(
          () => latest.current.close(),
          beforeBack ? () => latest.current.beforeBack!() : undefined,
        );
        releaseRef.current = release;
      }
    });
    return () => {
      mounted = false;
      void release?.();
      if (releaseRef.current === release) releaseRef.current = null;
    };
  }, [active, !!beforeBack]);
  return () => releaseRef.current?.() ?? Promise.resolve();
}
