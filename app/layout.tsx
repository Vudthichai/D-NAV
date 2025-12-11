import ConditionalLayout from "@/components/layout/ConditionalLayout";
import { DatasetProvider } from "@/components/DatasetProvider";
import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "@/styles/compare.css";

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
      <body className="font-sans antialiased">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-2NBF5E84J2"
          strategy="afterInteractive"
        />
        <Script
          src="https://identity.netlify.com/v1/netlify-identity-widget.js"
          strategy="afterInteractive"
        />
        <Script id="netlify-identity-init" strategy="afterInteractive">
          {`
            (function () {
              function initializeIdentity() {
                const identity = window.netlifyIdentity;
                if (!identity) {
                  return false;
                }

                identity.on("init", (user) => {
                  if (!user) {
                    identity.on("login", () => {
                      document.location.reload();
                    });
                  }
                });

                return true;
              }

              if (!initializeIdentity()) {
                const interval = window.setInterval(() => {
                  if (initializeIdentity()) {
                    window.clearInterval(interval);
                  }
                }, 500);
              }
            })();
          `}
        </Script>
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-2NBF5E84J2');
          `}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DatasetProvider>
            <ConditionalLayout>{children}</ConditionalLayout>
          </DatasetProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
