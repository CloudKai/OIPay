import { describe, expect, it } from "vitest";
import { pageInfo, parseHistoryQuery } from "./history-query";

describe("history query validation", () => {
  it("bounds pages and normalizes unsupported filters", () => {
    const query = parseHistoryQuery({ page: "999999", paymentsPage: "-1", activityPage: "NaN", category: "INVALID", tab: "unknown" });
    expect(query).toMatchObject({ page: 100_000, paymentsPage: 1, activityPage: 1, tab: "overview", filters: { category: "ALL" } });
    expect(pageInfo(query.page, 60)).toEqual({ page: 3, totalPages: 3, total: 60 });
  });

  it("rejects impossible dates without sending invalid values to the database", () => {
    expect(parseHistoryQuery({ from: "2026-02-30", to: "not-a-date" }).filters).toMatchObject({ dateFrom: "", dateTo: "" });
    expect(parseHistoryQuery({ from: "2024-02-29" }).filters.dateFrom).toBe("2024-02-29");
  });

  it("accepts repeated URL parameters safely and keeps empty results on page one", () => {
    expect(parseHistoryQuery({ q: ["  Lunch  ", "Dinner"], page: ["2", "3"] })).toMatchObject({ page: 2, filters: { search: "Lunch" } });
    expect(pageInfo(2, 0)).toEqual({ page: 1, totalPages: 1, total: 0 });
  });
});
