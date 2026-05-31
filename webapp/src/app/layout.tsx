import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "JobFlow AI — Intelligent Career Platform",
  description:
    "AI-powered resume analysis, job matching, ATS scoring, and application tracking. Powered by CrewAI agents.",
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
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
