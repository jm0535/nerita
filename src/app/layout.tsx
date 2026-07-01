import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nerita — Clings to every pixel, grazes every word",
  description:
    "Nerita is a private, in-browser OCR app named after the mangrove nerita snail. Hybrid engine (Tesseract.js + vision AI), document intelligence, searchable PDF, local history. Export to PDF, DOCX, Markdown, TXT, CSV, HTML, XLSX, XML & GeoJSON.",
  keywords: [
    "Nerita",
    "OCR",
    "Tesseract",
    "vision AI",
    "open-source",
    "document scanning",
    "searchable PDF",
    "DOCX",
    "Markdown",
    "GeoJSON",
  ],
  authors: [{ name: "Nerita" }],
  icons: {
    icon: "/nerita-logo.svg",
  },
  openGraph: {
    title: "Nerita — Clings to every pixel, grazes every word",
    description: "Hybrid OCR engine + document intelligence. Turn scanned documents into 9 structured formats, entirely in your browser.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
