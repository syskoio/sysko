import { useEffect } from "react";

export interface KeyboardHandlers {
  onSearchFocus(): void;
  onEscape(): void;
  onNext(): void;
  onPrev(): void;
  onClear(): void;
  onTogglePause(): void;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function useKeyboard(handlers: KeyboardHandlers): void {
  useEffect(() => {
    function onKey(ev: KeyboardEvent): void {
      const editable = isEditable(ev.target);

      if (ev.key === "Escape") {
        if (editable && ev.target instanceof HTMLInputElement) {
          ev.target.blur();
        }
        handlers.onEscape();
        return;
      }

      if (editable) return;

      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      switch (ev.key) {
        case "/":
          ev.preventDefault();
          handlers.onSearchFocus();
          return;
        case "j":
        case "ArrowDown":
          ev.preventDefault();
          handlers.onNext();
          return;
        case "k":
        case "ArrowUp":
          ev.preventDefault();
          handlers.onPrev();
          return;
        case "c":
          handlers.onClear();
          return;
        case " ":
          ev.preventDefault();
          handlers.onTogglePause();
          return;
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handlers]);
}
