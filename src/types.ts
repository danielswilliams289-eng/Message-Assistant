export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  defaultSenderName?: string;
  defaultSignature?: string;
  defaultNiche?: string;
  sendingPaceSeconds?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type EmailValidationStatus = 'valid' | 'invalid' | 'unknown';
export type OutreachStatus = 'not_contacted' | 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface Lead {
  id?: string;
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  location?: string | null;
  niche: string;
  sourceUrl?: string | null;
  sourceType?: string | null;
  emailStatus: EmailValidationStatus;
  outreachStatus: OutreachStatus;
  inSendList?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastContactedAt?: string | null;
  lastContactedCampaign?: string | null;
}

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface Campaign {
  id?: string;
  userId: string;
  name: string;
  niche: string;
  subject: string;
  body: string;
  senderEmail: string;
  senderName: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  pendingCount: number;
  failedCount: number;
  paceSeconds: number;
  deliverabilityScore?: number;
  inboxSafeguardEnabled?: boolean;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CampaignRecipient {
  id?: string;
  campaignId: string;
  userId: string;
  leadId: string;
  recipientEmail: string;
  recipientName: string;
  recipientCompany: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';
  personalizedSubject?: string;
  personalizedBody?: string;
  gmailMessageId?: string | null;
  sentAt?: string | null;
  errorMessage?: string | null;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  type: 'lead_scouted' | 'send_list_added' | 'campaign_created' | 'campaign_launched' | 'email_sent' | 'campaign_paused' | 'campaign_completed' | 'gmail_connected' | 'deliverability_checked';
  description: string;
  createdAt: string;
}
