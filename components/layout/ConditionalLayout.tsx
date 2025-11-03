"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./Sidebar";
import Header from "./Header";
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
      <div className="min-h-screen">
        <main>{children}</main>
      </div>
    );
  }

  // For all other pages, render with sidebar
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
