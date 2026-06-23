import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenOCR — Open-source document OCR & format export",
  description:
    "Free, private, in-browser OCR for scanned documents. Powered by Tesseract.js. Export to PDF, DOCX, Markdown, TXT, CSV, HTML, XLSX, XML & GeoJSON.",
  keywords: [
    "OCR",
    "Tesseract",
    "open-source",
    "document scanning",
    "PDF",
    "DOCX",
    "Markdown",
    "GeoJSON",
  ],
  authors: [{ name: "OpenOCR" }],
  openGraph: {
    title: "OpenOCR — Open-source document OCR",
    description: "Turn scanned documents into 9 structured formats, entirely in your browser.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
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
