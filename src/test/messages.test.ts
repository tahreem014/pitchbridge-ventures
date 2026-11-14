import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatMessage, dayLabel, displayName, groupByDay, initialsOf, isUuid, listTime } from "@/lib/messages";

const msg = (id: string, created_at: string): ChatMessage => ({
  id, created_at, content: id, read_at: null, sender_id: "a", recipient_id: "b",
});

describe("isUuid", () => {
  it("accepts real UUIDs", () => {
    expect(isUuid("d0000000-0000-4000-8000-000000000005")).toBe(true);
    expect(isUuid("D0000000-0000-4000-8000-00000000000A")).toBe(true);
  });

  it("rejects anything that could change a database filter", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("d0000000-0000-4000-8000-000000000005),sender_id.neq.x")).toBe(false);
    expect(isUuid("d0000000-0000-4000-8000-000000000005 ")).toBe(false);
  });
});

describe("names", () => {
  it("falls back when a profile has no name", () => {
    expect(displayName(null)).toBe("PitchBridge member");
    expect(displayName("   ")).toBe("PitchBridge member");
    expect(displayName(" Priya Nair ")).toBe("Priya Nair");
  });

  it("builds initials", () => {
    expect(initialsOf("Priya Nair")).toBe("PN");
    expect(initialsOf("madonna")).toBe("M");
    expect(initialsOf("Ana Maria Lopez")).toBe("AM");
    expect(initialsOf("")).toBe("?");
  });
});

describe("dates", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 13, 12, 0, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  it("labels days relative to today", () => {
    expect(dayLabel(new Date(2026, 9, 13, 8, 0).toISOString())).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 12, 23, 0).toISOString())).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 1, 9, 0).toISOString())).toBe("October 1, 2026");
  });

  it("shortens inbox timestamps", () => {
    expect(listTime(new Date(2026, 9, 12, 9, 0).toISOString())).toBe("Yesterday");
    expect(listTime(new Date(2026, 8, 30, 9, 0).toISOString())).toBe("Sep 30");
  });

  it("groups messages by calendar day, keeping order", () => {
    const groups = groupByDay([
      msg("1", new Date(2026, 9, 12, 9, 0).toISOString()),
      msg("2", new Date(2026, 9, 12, 21, 0).toISOString()),
      msg("3", new Date(2026, 9, 13, 8, 0).toISOString()),
    ]);
    expect(groups.map(g => g.label)).toEqual(["Yesterday", "Today"]);
    expect(groups[0].messages.map(m => m.id)).toEqual(["1", "2"]);
    expect(groups[1].messages.map(m => m.id)).toEqual(["3"]);
  });

  it("returns no groups for an empty thread", () => {
    expect(groupByDay([])).toEqual([]);
  });
});
