"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  Calculator,
  FileText,
  Gauge,
  ListOrdered,
  MessageSquare,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: Gauge },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/stress-test", label: "Stress Test", icon: Calculator },
  { href: "/log", label: "Log", icon: ListOrdered },
  { href: "/definitions", label: "Definitions", icon: BookOpen },
  { href: "/use-cases", label: "Use Cases", icon: Users },
  { href: "/contact", label: "Contact", icon: MessageSquare },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="dn-sidebar">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <Image
            src="/mockups/dnavdelta.png"
            alt="D-NAV logo"
            width={2000}
            height={2000}
            className="h-[30px] w-auto object-contain group-data-[collapsible=icon]:h-[30px] group-data-[collapsible=icon]:w-auto"
            priority
          />
          <div className="font-bold text-lg group-data-[collapsible=icon]:hidden">D-NAV</div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname === href} tooltip={label}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Decision Navigator
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
