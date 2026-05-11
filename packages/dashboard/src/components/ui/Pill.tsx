export function Pill({
  children,
  bg = "bg-zinc-800",
  text = "text-zinc-300",
  className = "",
}: {
  children: React.ReactNode;
  bg?: string;
  text?: string;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 " +
        "text-[10.5px] font-medium tracking-wide uppercase font-mono " +
        bg + " " + text + " " + className
      }
    >
      {children}
    </span>
  );
}
