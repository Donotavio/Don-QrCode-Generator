import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { value: string; label: string }[];
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
}

export function Tabs({ tabs, value, onValueChange, children }: TabsProps) {
  return (
    <div>
      <div className="inline-flex rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onValueChange(t.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              value === t.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function useTabs(initial: string) {
  return useState(initial);
}
