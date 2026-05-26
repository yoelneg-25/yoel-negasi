import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yoelnegasi.dev"),
  title: "Yoel Negasi — Senior Full Stack Engineer",
  description:
    "Senior Full Stack Engineer specializing in React, Next.js, Node.js, platform engineering, enterprise automation, and AI-integrated systems. Based in Oakland, CA.",
  keywords: [
    "Full Stack Engineer",
    "React",
    "Next.js",
    "Node.js",
    "TypeScript",
    "Platform Engineering",
    "Automation",
    "AI",
    "AWS",
  ],
  authors: [{ name: "Yoel Negasi" }],
  openGraph: {
    title: "Yoel Negasi — Senior Full Stack Engineer",
    description:
      "Building scalable enterprise platforms, modern React applications, and workflow automation systems.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#080810] text-[#f8f8ff]">{children}</body>
    </html>
  );
}
