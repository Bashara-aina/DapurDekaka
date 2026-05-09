import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DapurDekaka",
  description: "DapurDekaka Next.js App Router bootstrap",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
