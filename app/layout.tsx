import type { Metadata } from "next";
import { Playfair_Display, Special_Elite, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ variable: "--font-display", subsets: ["latin"], weight: ["400", "700", "900"] });
const elite = Special_Elite({ variable: "--font-type", subsets: ["latin"], weight: "400" });
const inter = Inter({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Case Files",
  description: "A noir neurosymbolic murder mystery. Interrogate AI suspects whose lies are controlled by a symbolic engine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${elite.variable} ${inter.variable} antialiased`}>
        <div className="grain" aria-hidden />
        <div className="vignette" aria-hidden />
        {children}
      </body>
    </html>
  );
}
