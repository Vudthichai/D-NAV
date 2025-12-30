"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const showThemeToggle = pathname !== "/";

  return (
    <header
      className="dn-app-chrome sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-sidebar/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-sidebar/75"
    >
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-muted/60"
        >
          <Image
            src="/mockups/Header%20Logos.png"
            alt="D-NAV logo"
            width={2000}
            height={2000}
            className="h-10 w-auto"
            priority
          />
          <span className="sr-only">D-NAV</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {showThemeToggle ? <ThemeToggle /> : null}
        <Button variant="outline" size="sm">
          Help
        </Button>
      </div>
    </header>
  );
}
