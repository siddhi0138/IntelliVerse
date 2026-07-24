import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";
import { Footer } from "@/components/Footer";
import { PersonaProvider } from "@/components/PersonaContext";
import { SimpleModeProvider } from "@/components/SimpleModeContext";
import { ThemeProvider } from "@/components/ThemeContext";

// Runs before React hydrates so the .dark class (and therefore every
// dark: utility class) is already correct on first paint — otherwise a
// returning user who chose dark mode would see a flash of light mode.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('nexus_theme');var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IntelliVerse",
  description: "Upload anything. Understand everything.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <SimpleModeProvider>
            <PersonaProvider>
              <AuthGuard>{children}</AuthGuard>
              <Footer />
            </PersonaProvider>
          </SimpleModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
