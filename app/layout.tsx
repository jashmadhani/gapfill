import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600"],
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Toure — Your trip, replanned as it happens",
  description:
    "AI itinerary planning that adapts in real time to weather, closures, and your budget — with a safety net if you ever lose signal.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eaf0f7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${outfit.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="app-canvas min-h-full flex flex-col font-sans text-stone-800">
        {children}
      </body>
    </html>
  );
}
