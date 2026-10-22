type MemberLookupClient = {
  groupMember: {
    findMany: (input: {
      where: { groupId: string };
      select: { id: true };
    }) => Promise<{ id: string }[]>;
  };
};

export async function validateGroupMemberIds(
  client: MemberLookupClient,
  input: {
    groupId: string;
    paidByMemberId: string;
    splitMemberIds: string[];
  }
): Promise<string | null> {
  const members = await client.groupMember.findMany({
    where: { groupId: input.groupId },
    select: { id: true }
  });
  const memberIds = new Set(members.map((member) => member.id));
  if (!memberIds.has(input.paidByMemberId)) {
    return "The payer is not part of this group.";
  }
  if (!input.splitMemberIds.every((memberId) => memberIds.has(memberId))) {
    return "Every participant must belong to this group.";
  }
  return null;
}
