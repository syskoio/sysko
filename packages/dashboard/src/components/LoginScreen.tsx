import { useState, type KeyboardEvent } from "react";

interface LoginScreenProps {
  error: string | null;
  onLogin: (password: string) => Promise<boolean>;
}

export function LoginScreen({ error, onLogin }: LoginScreenProps): React.ReactElement {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (!value || submitting) return;
    setSubmitting(true);
    setLocalError(null);
    const ok = await onLogin(value);
    if (!ok) {
      setLocalError("Wrong password.");
      setValue("");
    }
    setSubmitting(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") void submit();
  };

  const displayError = localError ?? error;

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-zinc-950">
      <div className="w-full max-w-xs flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">sysko observe</span>
          <h1 className="text-zinc-100 text-lg font-semibold tracking-tight">Dashboard</h1>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            placeholder="Password"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 font-mono transition-colors"
          />

          {displayError && (
            <p className="text-[12px] text-red-400 font-mono">{displayError}</p>
          )}

          <button
            type="button"
            disabled={!value || submitting}
            onClick={() => void submit()}
            className="w-full bg-lime-400 hover:bg-lime-300 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold text-sm rounded-lg py-2.5 transition-colors"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
