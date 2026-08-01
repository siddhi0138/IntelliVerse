import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border flex-shrink-0">
      <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex shrink-0">
            <Logo size="sm" />
            <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border-2 border-background bg-primary animate-pulse" />
          </span>
          <span className="font-display text-base text-foreground">IntelliVerse</span>
        </div>
        <p className="text-xs font-mono">
          <a
            href="https://github.com/siddhi0138/IntelliVerse"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary hover:underline"
          >
            GitHub
          </a>
          <span className="mx-2">&middot;</span>
          FastAPI + Next.js
        </p>
      </div>
    </footer>
  );
}
