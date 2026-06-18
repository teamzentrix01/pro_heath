'use client';

import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

// Note: Metadata export is not supported in 'use client' mode
// Uncomment this when using a layout server component
/*
export const metadata: Metadata = {
  title: "Health track ",
  description: "Healthcare Management System",
};
*/

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
