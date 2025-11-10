import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Reach out anytime:</p>
          <a
            href="mailto:vudi@thednav.com"
            className="text-lg font-semibold text-foreground hover:underline"
          >
            vudi@thednav.com
          </a>
        </div>
        <Button asChild>
          <Link href="/contact#contact-form">Let&apos;s Connect</Link>
        </Button>
      </div>
    </footer>
  );
}
