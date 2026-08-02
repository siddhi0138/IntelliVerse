import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";
import { Footer } from "@/components/Footer";
import { Sidebar } from "@/components/Sidebar";
import { PersonaProvider } from "@/components/PersonaContext";
import { SimpleModeProvider } from "@/components/SimpleModeContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Space Grotesk for brand/headings, matching the reference exactly.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
      className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden bg-background text-foreground">
        {/* Same two ambient radial gradients (cyan top-right, emerald
            bottom-left) the reference uses on its body — fixed behind
            everything so every route gets it, not just the hero. Bumped up
            from the original 0.10/0.07 — at that strength it read as barely
            there once real content (cards, tables) filled the page. */}
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(60rem 60rem at 80% -10%, rgba(6, 182, 212, 0.18), transparent 60%), radial-gradient(50rem 50rem at -10% 20%, rgba(16, 185, 129, 0.14), transparent 55%), radial-gradient(40rem 40rem at 60% 100%, rgba(167, 139, 250, 0.10), transparent 60%)",
          }}
        />
        <SimpleModeProvider>
          <PersonaProvider>
            <div className="flex-1 min-h-0 flex">
              <Sidebar />
              <div className="flex-1 min-w-0 flex flex-col min-h-0 pt-14 md:pt-0">
                <AuthGuard>{children}</AuthGuard>
              </div>
            </div>
            <Footer />
          </PersonaProvider>
        </SimpleModeProvider>
      </body>
    </html>
  );
}
