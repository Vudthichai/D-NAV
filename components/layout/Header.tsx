"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const getPageTitle = () => {
    switch (pathname) {
      case "/":
        return "Decision Navigator";
      case "/calculator":
        return "Calculator";
      case "/stats":
        return "Stats";
      case "/log":
        return "Decision Log";
      case "/definitions":
        return "Definitions";
      default:
        return "D-NAV";
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-sidebar">
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1">
        <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="outline" size="sm">
          Help
        </Button>
      </div>
    </header>
  );
}
