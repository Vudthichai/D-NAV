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
import { BookOpen, Calculator, Gauge, ListOrdered } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: Gauge },
  { href: "/calculator", label: "The D-NAV", icon: Calculator },
  { href: "/log", label: "Log", icon: ListOrdered },
  { href: "/definitions", label: "Definitions", icon: BookOpen },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <img
            src="/logo.PNG"
            alt="D-NAV"
            className="w-8 h-8 rounded-md bg-primary/20 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8"
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
