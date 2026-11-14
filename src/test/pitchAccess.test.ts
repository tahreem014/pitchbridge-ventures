import { describe, it, expect } from "vitest";
import {
  AccessRequestItem, VersionItem, accessState, canRequestAccess, describeChanges, describeEvent, emptyDetails,
  groupVersions, hasAnyDetails, logDetail, shortHash, sortRequests, summarizeRequests,
} from "@/lib/pitchAccess";

const person = { id: "p", name: "Priya Nair", avatar: null, headline: null, company: null };
let n = 0;
const request = (status: AccessRequestItem["status"], extra: Partial<AccessRequestItem> = {}): AccessRequestItem => ({
  id: `r${++n}`, ideaId: "i", ideaTitle: "SkillSwap", status, message: null, createdAt: "2026-10-01T00:00:00Z",
  decidedAt: null, ndaAcceptedAt: null, person, ...extra,
});

describe("accessState: reading needs approval AND the signed confidentiality terms", () => {
  it("is 'none' before any request", () => {
    expect(accessState(null)).toBe("none");
  });

  it("follows the request while it is pending, declined or withdrawn", () => {
    expect(accessState({ status: "pending", ndaAcceptedAt: null })).toBe("pending");
    expect(accessState({ status: "rejected", ndaAcceptedAt: null })).toBe("rejected");
    expect(accessState({ status: "revoked", ndaAcceptedAt: "2026-10-02T00:00:00Z" })).toBe("revoked");
  });

  it("is only 'granted' when approved and the terms were accepted", () => {
    expect(accessState({ status: "approved", ndaAcceptedAt: null })).toBe("needs_nda");
    expect(accessState({ status: "approved", ndaAcceptedAt: "2026-10-02T00:00:00Z" })).toBe("granted");
  });

  it("a stray acceptance never unlocks a request that is not approved", () => {
    expect(accessState({ status: "pending", ndaAcceptedAt: "2026-10-02T00:00:00Z" })).toBe("pending");
  });
});

describe("requesting again", () => {
  it("is allowed when there is no open request", () => {
    expect(canRequestAccess("none")).toBe(true);
    expect(canRequestAccess("rejected")).toBe(true);
    expect(canRequestAccess("revoked")).toBe(true);
  });

  it("is not allowed while a request is open or access is granted", () => {
    expect(canRequestAccess("pending")).toBe(false);
    expect(canRequestAccess("needs_nda")).toBe(false);
    expect(canRequestAccess("granted")).toBe(false);
  });
});

describe("detailed pitch text", () => {
  it("starts empty", () => {
    expect(hasAnyDetails(emptyDetails())).toBe(false);
  });

  it("counts any section with real text, ignoring blank spaces", () => {
    expect(hasAnyDetails({ ...emptyDetails(), market_research: "  " })).toBe(false);
    expect(hasAnyDetails({ ...emptyDetails(), market_research: "TAM 12M" })).toBe(true);
  });
});

describe("version history wording", () => {
  it("names what changed in plain words", () => {
    expect(describeChanges(["details.business_model", "public.funding_target"])).toEqual(["Business model", "Funding goal"]);
  });

  it("names a change to the supporting documents", () => {
    expect(describeChanges(["documents", "details.market_research"])).toEqual(["Supporting documents", "Market research"]);
  });

  it("returns nothing for the original submission", () => {
    expect(describeChanges(null)).toEqual([]);
    expect(describeChanges([])).toEqual([]);
  });

  it("keeps an unknown field name rather than hiding it", () => {
    expect(describeChanges(["public.something_new"])).toEqual(["public.something_new"]);
  });

  it("shortens a fingerprint for display", () => {
    expect(shortHash("0123456789abcdef0123")).toBe("0123456789");
  });
});

describe("activity wording, from the founder's point of view", () => {
  it("describes every kind of event", () => {
    expect(describeEvent("access_requested", "Priya", "SkillSwap")).toBe("Priya asked to read the detailed pitch of SkillSwap");
    expect(describeEvent("access_approved", "Priya", "SkillSwap")).toBe("You approved Priya's request to read SkillSwap");
    expect(describeEvent("access_rejected", "Priya", "SkillSwap")).toBe("You declined Priya's request to read SkillSwap");
    expect(describeEvent("access_revoked", "Priya", "SkillSwap")).toBe("You withdrew Priya's access to SkillSwap");
    expect(describeEvent("nda_accepted", "Priya", "SkillSwap")).toBe("Priya accepted the confidentiality terms for SkillSwap");
    expect(describeEvent("pitch_viewed", "Priya", "SkillSwap")).toBe("Priya opened the detailed pitch of SkillSwap");
  });

  it("names the document that was opened, when the entry says which", () => {
    expect(describeEvent("document_viewed", "Priya", "SkillSwap", "Pitch deck")).toBe('Priya opened the document "Pitch deck" of SkillSwap');
    expect(describeEvent("document_viewed", "Priya", "SkillSwap")).toBe("Priya opened a supporting document of SkillSwap");
    expect(describeEvent("document_viewed", "Priya", "SkillSwap", null)).toBe("Priya opened a supporting document of SkillSwap");
  });

  it("reads the document title from a log entry's details", () => {
    expect(logDetail({ document_id: "d1", title: "Pitch deck" })).toBe("Pitch deck");
    expect(logDetail({ document_id: "d1" })).toBeNull();
    expect(logDetail({ title: 42 })).toBeNull();
    expect(logDetail(null)).toBeNull();
    expect(logDetail("Pitch deck")).toBeNull();
  });

  it("still says something for an event it does not know", () => {
    expect(describeEvent("brand_new", "Priya", "SkillSwap")).toContain("brand_new");
  });
});

describe("requests list", () => {
  it("counts who is waiting, who has access, and who has not signed yet", () => {
    const items = [
      request("pending"), request("pending"),
      request("approved", { ndaAcceptedAt: "2026-10-02T00:00:00Z" }), request("approved"),
      request("rejected"), request("revoked"),
    ];
    expect(summarizeRequests(items)).toEqual({ waiting: 2, withAccess: 1, awaitingNda: 1 });
    expect(summarizeRequests([])).toEqual({ waiting: 0, withAccess: 0, awaitingNda: 0 });
  });

  it("puts what needs an answer first, then approved, then finished; newest first", () => {
    const oldPending = request("pending", { createdAt: "2026-09-01T00:00:00Z" });
    const newPending = request("pending", { createdAt: "2026-10-20T00:00:00Z" });
    const approved = request("approved", { createdAt: "2026-10-25T00:00:00Z" });
    const rejected = request("rejected", { createdAt: "2026-10-26T00:00:00Z" });
    expect(sortRequests([rejected, oldPending, approved, newPending]).map(r => r.id)).toEqual([newPending.id, oldPending.id, approved.id, rejected.id]);
  });
});

describe("version history grouping", () => {
  const v = (ideaId: string, ideaTitle: string, version: number): VersionItem => ({
    id: `${ideaId}-${version}`, ideaId, ideaTitle, version, hash: "h", createdAt: "2026-10-01T00:00:00Z", changes: [],
  });

  it("groups by idea, newest version first", () => {
    const groups = groupVersions([v("a", "Alpha", 1), v("b", "Beta", 1), v("a", "Alpha", 3), v("a", "Alpha", 2)]);
    expect(groups.map(g => g.ideaTitle)).toEqual(["Alpha", "Beta"]);
    expect(groups[0].versions.map(x => x.version)).toEqual([3, 2, 1]);
  });

  it("returns nothing for no versions", () => {
    expect(groupVersions([])).toEqual([]);
  });
});
