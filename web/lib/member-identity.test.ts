import { expect, it } from "vitest";
import { memberNameKey, principalMembershipWhere } from "./member-identity";
it("treats case, width and repeated whitespace as the same group name", () => {
  expect(memberNameKey("  Ａlex   Tan ")).toBe(memberNameKey("alex tan"));
});
it("maps guest identity to guest session membership, never to a user id", () => {
  expect(principalMembershipWhere("guest:opaque-session")).toEqual({ guestSessionId: "opaque-session", userId: null });
  expect(principalMembershipWhere("real-account")).toEqual({ userId: "real-account" });
});
