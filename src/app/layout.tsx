import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "이미 늦었습니다",
  description: "누르지 말랬잖아",
  openGraph: {
    title: "이미 늦었습니다",
    description: "누르지 말랬잖아",
    // 배포하고 나서 실제 주소로 바꾸면 됨
    url: "https://already-late.vercel.app/",
    siteName: "이미 늦었습니다",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
  card: "summary_large_image",
  title: "이미 늦었습니다",
  description: "누르지 말랬잖아",
  images: ["/og.png"],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
