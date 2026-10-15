import { useEffect, useRef, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';

/**
 * Dialog. Centered on larger screens, a bottom sheet on phones. Built on Radix Dialog, which
 * handles the focus trap, scroll lock, inert background, Escape (an open picker inside closes
 * first) and returning focus on close. Rendered only while open: mount it to open, unmount to close.
 */
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  // callers unmount the dialog to close it, which skips Radix's own focus return: do it here
  const returnTo = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => () => { const el = returnTo.current; setTimeout(() => el?.isConnected && el.focus({ preventScroll: true }), 0); }, []);
  return (
    <DialogPrimitive.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-fade-in fixed inset-0 z-50 bg-(--scrim)" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <DialogPrimitive.Content aria-describedby={undefined}
            className={`animate-dialog-in pointer-events-auto relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-t-(--radius-dialog) bg-popover shadow-(--shadow-overlay) outline-none
              sm:max-h-[min(88dvh,56rem)] sm:rounded-(--radius-dialog) ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />
            <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
              <DialogPrimitive.Title className="min-w-0 break-words pt-1 text-base font-semibold leading-6 tracking-tight">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="btn-ghost btn-icon -me-2 shrink-0" aria-label="סגור"><X /></DialogPrimitive.Close>
            </div>
            <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 sm:px-6 ${footer ? 'pb-5' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6'}`}>
              {children}
            </div>
            {footer && (
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-muted/60 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 max-sm:[&>*]:flex-1">
                {footer}
              </div>
            )}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
