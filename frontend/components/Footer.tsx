export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <p>🧠 IntelliVerse — Upload anything. Understand everything.</p>
        <p>
          <a
            href="https://github.com/siddhi0138/IntelliVerse"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
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
