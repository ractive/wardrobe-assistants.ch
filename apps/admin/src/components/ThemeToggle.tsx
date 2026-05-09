// Local mods on top of @shadcn/mode-toggle: aria-hidden, motion-safe, onSelect, relative.
// If re-running `npx shadcn@latest add @shadcn/mode-toggle --overwrite`, re-apply these.
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Sun
            aria-hidden="true"
            className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 motion-safe:transition-all dark:scale-0 dark:-rotate-90"
          />
          <Moon
            aria-hidden="true"
            className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 motion-safe:transition-all dark:scale-100 dark:rotate-0"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
