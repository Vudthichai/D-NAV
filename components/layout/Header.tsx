"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";

export default function Header() {
  const pathname = usePathname();
  const showThemeToggle = pathname !== "/";
  const { openDefinitions } = useDefinitionsPanel();

  return (
    <header
      className="dn-app-chrome sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b bg-sidebar/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-sidebar/75"
    >
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-muted/60"
        >
          <BrandMark
            className="gap-3"
            imageClassName="h-[28px] w-auto max-w-none sm:h-[32px] lg:h-[40px]"
            textClassName="text-primary"
            priority
          />
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {showThemeToggle ? <ThemeToggle /> : null}
        <Button variant="outline" size="sm" onClick={(event) => openDefinitions(event.currentTarget)}>
          Help
        </Button>
      </div>
    </header>
  );
}
