import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  priority?: boolean;
}

export function BrandMark({
  className,
  imageClassName,
  textClassName,
  priority,
}: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/mockups/deltaorange.png"
        alt="D-NAV logo"
        width={2000}
        height={2000}
        className={cn("h-[30px] w-auto object-contain", imageClassName)}
        priority={priority}
      />
      <span className={cn("font-bold text-lg text-primary", textClassName)}>
        D-NAV
      </span>
    </div>
  );
}
