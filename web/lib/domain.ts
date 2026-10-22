export type Money = {
  minor: number;
  currency: string;
};

export type SplitInput = {
  memberId: string;
  amountMinor?: number;
  percentageBps?: number;
  weight?: number;
};

export type MemberBalance = {
  memberId: string;
  name: string;
  paidMinor: number;
  owedMinor: number;
  netMinor: number;
};

export type SimplifiedDebt = {
  fromMemberId: string;
  toMemberId: string;
  fromName: string;
  toName: string;
  amountMinor: number;
};
