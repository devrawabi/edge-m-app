/** Mirrors `IncomingCallPayload` from RawabiEdge-Last `incoming-call-store`. */
export type WhatsAppIncomingCallPayload = {
  callId: string;
  contactName: string;
  phoneNumber: string;
  status: 'calling' | 'ringing';
  contactId?: string;
  timestamp: number;
  session?: { sdp: string; sdp_type: string };
};
