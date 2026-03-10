"use client";

import { Command, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SupportedSymbol } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";
import { useUiStore } from "@/store/ui-store";

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  section: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSymbol, setExpiry } = useMarketStore();
  const { setVolSurfaceEnabled, setShowChainPanel } = useUiStore();

  const commands: CommandItem[] = [
    // Navigation
    { id: "nifty", label: "Switch to NIFTY", shortcut: "N", section: "Symbol", action: () => setSymbol("NIFTY") },
    { id: "banknifty", label: "Switch to BANKNIFTY", shortcut: "B", section: "Symbol", action: () => setSymbol("BANKNIFTY") },
    { id: "finnifty", label: "Switch to FINNIFTY", shortcut: "F", section: "Symbol", action: () => setSymbol("FINNIFTY") },
    // Views
    { id: "vol-on", label: "Enable Vol Surface", section: "View", action: () => setVolSurfaceEnabled(true) },
    { id: "vol-off", label: "Disable Vol Surface", section: "View", action: () => setVolSurfaceEnabled(false) },
    { id: "chain-on", label: "Show Chain Panel", section: "View", action: () => setShowChainPanel(true) },
    { id: "chain-off", label: "Hide Chain Panel", section: "View", action: () => setShowChainPanel(false) },
    // Actions
    { id: "scroll-top", label: "Scroll to Top", shortcut: "T", section: "Navigate", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { id: "scroll-bottom", label: "Scroll to Bottom", section: "Navigate", action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) },
    { id: "refresh", label: "Refresh All Data", shortcut: "R", section: "Action", action: () => window.location.reload() },
    { id: "fullscreen", label: "Toggle Fullscreen", shortcut: "F11", section: "Action", action: () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }},
    { id: "pricing", label: "Open Pricing Page", section: "Navigate", action: () => window.open("/pricing", "_blank") },
  ];

  const filtered = query
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.section.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIdx(0);
      }

      if (!open) return;

      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIdx]) {
        filtered[selectedIdx].action();
        setOpen(false);
      }
    },
    [open, filtered, selectedIdx]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border/80 bg-panel/95 px-3 py-2 text-xs text-muted-foreground shadow-neon backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
      >
        <Command className="h-3.5 w-3.5" />
        <span>Ctrl+K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-border/80 bg-panel shadow-neon"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No commands found</p>
          )}

          {(() => {
            let lastSection = "";
            return filtered.map((cmd, idx) => {
              const showSection = cmd.section !== lastSection;
              lastSection = cmd.section;

              return (
                <div key={cmd.id}>
                  {showSection && (
                    <p className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {cmd.section}
                    </p>
                  )}
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                      idx === selectedIdx
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                    onClick={() => {
                      cmd.action();
                      setOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                </div>
              );
            });
          })()}
        </div>

        <div className="border-t border-border/80 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="mr-3">Arrow keys to navigate</span>
          <span className="mr-3">Enter to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
