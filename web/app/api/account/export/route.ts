import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireAuth } from "@/lib/server/require-auth";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          status: true,
          joinedAt: true,
          group: {
            select: {
              id: true,
              name: true,
              currency: true,
              archivedAt: true,
              expenses: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  description: true,
                  totalMinor: true,
                  originalCurrency: true,
                  originalMinor: true,
                  exchangeRate: true,
                  exchangeRateDate: true,
                  exchangeRateSource: true,
                  splitType: true,
                  category: true,
                  expenseDate: true,
                  notes: true,
                  paidByMemberId: true,
                  shares: {
                    select: {
                      memberId: true,
                      shareMinor: true,
                      percentageBps: true,
                      weight: true
                    }
                  }
                }
              },
              settlements: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  fromMemberId: true,
                  toMemberId: true,
                  amountMinor: true,
                  originalCurrency: true,
                  originalMinor: true,
                  exchangeRate: true,
                  exchangeRateDate: true,
                  exchangeRateSource: true,
                  method: true,
                  settledAt: true,
                  notes: true
                }
              }
            }
          }
        }
      }
    }
  });

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      account
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="oipay-export.json"'
      }
    }
  );
}
