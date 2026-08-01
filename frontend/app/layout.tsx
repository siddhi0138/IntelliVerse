import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden bg-background text-foreground">
        {/* Same glow on every route, not just the hero/login screens — fixed
            behind everything so it never scrolls or shifts between pages.
            Sidebar/panels are opaque so this never bleeds into text. */}
        {/* A CSS gradient (not a blurred div) so the falloff is an exact
            percentage, not blur spillover — kept anchored to the bottom
            corner only, nowhere near headings/page titles, which all sit
            at the top of every page. */}
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 100% 100%, oklch(0.7 0.18 295 / 0.12), transparent 25%)",
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
