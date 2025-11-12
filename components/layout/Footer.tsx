import Link from "next/link";
import { AnimatedCompass } from "@/components/animated-compass";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <AnimatedCompass className="h-20 w-20 rounded-[28px] before:rounded-[24px] p-3" />
          <div>
            <p className="text-sm text-muted-foreground">Reach out anytime:</p>
            <a
              href="mailto:vudi@thednav.com"
              className="text-lg font-semibold text-foreground hover:underline"
            >
              vudi@thednav.com
            </a>
          </div>
        </div>
        <Button asChild className="w-full md:w-auto">
          <Link href="/contact#contact-form">Let&apos;s Connect</Link>
        </Button>
      </div>
    </footer>
  );
}
