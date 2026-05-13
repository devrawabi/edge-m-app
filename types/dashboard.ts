export type DailyMessageVolume = {
  date: string;
  total: number;
  outgoing: number;
  incoming: number;
  delivered: number;
};

export type MessagesReportResponse = {
  period: { from: string; to: string };
  summary: {
    totalMessages: number;
    outgoingMessages: number;
    incomingMessages: number;
    readMessages: number;
    deliveredMessages: number;
    readPct: number;
    deliveredPct: number;
  };
  dailyData: DailyMessageVolume[];
};

export type OverviewStatsResponse = {
  period: { from: string; to: string };
  scopeNote: string | null;
  totalMessages: number;
  activeContacts: number;
  connectedChannels: number;
  readMessages: number;
  deliveredMessages: number;
  readPct: number;
  hotLeads: number;
  followUps: number;
  closedDeals: number;
};

export type EcommerceReportSummary = {
  period: { from: string; to: string };
  stats: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalSales: number;
    deliveredSales: number;
    newCustomers: number;
    repeatCustomers: number;
  };
  fulfillmentTiming?: {
    avgTotalFulfillmentMin: number | null;
    avgPrepMin: number | null;
    avgRouteMin: number | null;
    deliveredWithTotalSample: number;
    deliveredWithPrepSample: number;
    deliveredWithRouteSample: number;
  };
};
