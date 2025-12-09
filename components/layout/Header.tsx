"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const getPageTitle = () => {
    switch (pathname) {
      case "/":
        return "Decision Navigator";
      case "/calculator":
        return "The D-NAV";
      case "/log":
        return "Decision Log";
      case "/definitions":
        return "Definitions";
      case "/reports":
        return "Reports & Exports";
      default:
        return "D-NAV";
    }
  };

  return (
    <header className="dn-app-chrome flex h-16 shrink-0 items-center gap-3 border-b bg-sidebar px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-muted/60"
        >
          <Image
            src="/logo.PNG"
            alt="D-NAV logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-md bg-primary/20 object-cover"
            priority
          />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              The Decision NAVigator
            </span>
            <span className="text-sm font-semibold text-foreground">{getPageTitle()}</span>
          </div>
        </Link>
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
