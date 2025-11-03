import ConditionalLayout from "@/components/layout/ConditionalLayout";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoProvider } from "@/hooks/use-demo";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "D-NAV",
  description: "Decision Navigator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DemoProvider>
            <ConditionalLayout>{children}</ConditionalLayout>
          </DemoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
