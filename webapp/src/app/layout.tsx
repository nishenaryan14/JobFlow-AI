import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import DevConsole from "@/components/DevConsole";

export const metadata: Metadata = {
  title: "JobFlow AI — Intelligent Career Platform",
  description:
    "AI-powered resume analysis, job matching, ATS scoring, and application tracking. Land your dream role faster.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body suppressHydrationWarning>
        <div className="bg-mesh" />
        <div className="app-layout" suppressHydrationWarning>
          <Navbar />
          <main className="main-content" suppressHydrationWarning>
            {children}
          </main>
        </div>
        <DevConsole />
      </body>
    </html>
  );
}
