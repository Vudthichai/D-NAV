"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  if (isHomePage) {
    // For home page, render without sidebar
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  // For all other pages, render with sidebar
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen">
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 p-6">{children}</main>
          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
