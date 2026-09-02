import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/// Inter es la alternativa libre más cercana a SF Pro, que no es redistribuible.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gestión",
    template: "%s · Gestión",
  },
  description: "Sistema interno de gestión de inventario y ventas.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: "14px",
              fontFamily: "var(--font-inter), -apple-system, sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
