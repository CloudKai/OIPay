import { prisma } from "@/lib/prisma";
import { computeGroupBalances } from "@/lib/balances";

export async function getGroupPageData(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId
      }
    },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: true
            },
            orderBy: {
              joinedAt: "asc"
            }
          },
          expenses: {
            include: {
              paidByMember: {
                include: {
                  user: true
                }
              },
              createdByMember: {
                include: {
                  user: true
                }
              },
              shares: {
                include: {
                  member: {
                    include: {
                      user: true
                    }
                  }
                }
              }
            },
            orderBy: {
              expenseDate: "desc"
            }
          },
          settlements: {
            include: {
              fromMember: {
                include: {
                  user: true
                }
              },
              toMember: {
                include: {
                  user: true
                }
              },
              createdByMember: {
                include: {
                  user: true
                }
              }
            },
            orderBy: {
              settledAt: "desc"
            }
          },
          activities: {
            include: {
              actorMember: {
                include: {
                  user: true
                }
              }
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 50
          }
        }
      }
    }
  });

  if (!membership) {
    return null;
  }

  const group = membership.group;

  const { balances, simplifiedDebts } = computeGroupBalances({
    members: group.members.map((member) => ({
      id: member.id,
      name: member.user.name
    })),
    expenses: group.expenses.map((expense) => ({
      id: expense.id,
      paidByMemberId: expense.paidByMemberId,
      totalCents: expense.totalCents,
      shares: expense.shares.map((share) => ({
        memberId: share.memberId,
        shareCents: share.shareCents
      }))
    })),
    settlements: group.settlements.map((settlement) => ({
      id: settlement.id,
      fromMemberId: settlement.fromMemberId,
      toMemberId: settlement.toMemberId,
      amountCents: settlement.amountCents
    }))
  });

  return {
    membership,
    group,
    balances,
    simplifiedDebts
  };
}
