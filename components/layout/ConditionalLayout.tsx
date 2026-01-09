"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DefinitionsPanelProvider } from "@/components/definitions/DefinitionsPanelProvider";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isHomePage = pathname === "/" || pathname === "/home";
  const isPrintPage = pathname?.startsWith("/reports/print");

  if (isHomePage) {
    // For home page, render without sidebar
    return (
      <div className="flex min-h-screen flex-col dark">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  if (isPrintPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  // For all other pages, render with sidebar
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen">
        <DefinitionsPanelProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 p-6">{children}</main>
            <Footer />
          </div>
        </DefinitionsPanelProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
