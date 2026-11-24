import { useEffect, useId, useState } from 'react';
import { Modal } from './Modal';

interface Request {
  message: string;
  resolve: (accepted: boolean) => void;
}
let pending: Request | null = null;
let receive: ((request: Request | null) => void) | null = null;
export function confirmAction(message: string): Promise<boolean> {
  if (pending || !receive) return Promise.resolve(false);
  return new Promise((resolve) => {
    pending = { message, resolve };
    receive?.(pending);
  });
}
export function ConfirmationHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const description = useId();
  useEffect(() => {
    receive = setRequest;
    return () => {
      receive = null;
      pending?.resolve(false);
      pending = null;
    };
  }, []);
  function finish(accepted: boolean) {
    const current = pending;
    pending = null;
    setRequest(null);
    current?.resolve(accepted);
  }
  if (!request) return null;
  const destructive = /^(Delete|Retract|Replace|Discard)/.test(request.message);
  const action = request.message.startsWith('Delete')
    ? 'Delete'
    : request.message.startsWith('Retract')
      ? 'Retract'
      : request.message.startsWith('Discard')
        ? 'Discard changes'
        : request.message.startsWith('Archive')
          ? 'Archive'
          : request.message.startsWith('Replace')
            ? 'Replace settings'
            : 'Confirm';
  return (
    <Modal
      title={destructive ? 'Review this change' : 'Confirm your action'}
      descriptionId={description}
      onDismiss={() => finish(false)}
      className="confirmation-dialog"
    >
      {(close) => (
        <>
          <p className="dialog-message" id={description}>
            {request.message}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary"
              autoFocus
              onClick={() => void close(() => finish(false))}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`primary ${destructive ? 'danger-action' : ''}`}
              data-testid="confirm-action"
              onClick={() => void close(() => finish(true))}
            >
              {action}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
