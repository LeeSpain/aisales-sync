export const leadStatusColors: Record<string, string> = {
  discovered: "bg-muted text-muted-foreground",
  researched: "bg-muted text-muted-foreground",
  scored: "bg-primary/10 text-primary",
  qualified: "bg-success/10 text-success",
  outreach_pending: "bg-accent/10 text-accent",
  sequence_active: "bg-accent/10 text-accent",
  contacted: "bg-accent/10 text-accent",
  replied: "bg-warning/10 text-warning",
  in_conversation: "bg-warning/10 text-warning",
  call_scheduled: "bg-warning/10 text-warning",
  call_completed: "bg-primary/10 text-primary",
  meeting_booked: "bg-success/10 text-success",
  proposal_sent: "bg-primary/10 text-primary",
  negotiating: "bg-warning/10 text-warning",
  converted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  unresponsive: "bg-muted text-muted-foreground",
};

export const campaignStatusColors: Record<string, string> = {
  setup: "bg-muted text-muted-foreground",
  hunting: "bg-warning/10 text-warning",
  scoring: "bg-primary/10 text-primary",
  outreach: "bg-accent/10 text-accent",
  active: "bg-success/10 text-success",
  paused: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

export const proposalStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-500/10 text-amber-400",
  approved: "bg-success/10 text-success",
  sent: "bg-blue-500/10 text-blue-400",
  viewed: "bg-amber-500/10 text-amber-400",
  accepted: "bg-emerald-500/10 text-emerald-400",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export const emailStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-500/10 text-amber-400",
  approved: "bg-success/10 text-success",
  scheduled: "bg-blue-500/10 text-blue-400",
  sent: "bg-blue-500/10 text-blue-400",
  opened: "bg-amber-500/10 text-amber-400",
  replied: "bg-emerald-500/10 text-emerald-400",
  bounced: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
  pending_manual: "bg-warning/10 text-warning",
};

export const intentColors: Record<string, string> = {
  interested: "bg-success/10 text-success",
  not_interested: "bg-destructive/10 text-destructive",
  question: "bg-accent/10 text-accent",
  call_request: "bg-warning/10 text-warning",
  meeting_request: "bg-warning/10 text-warning",
  out_of_office: "bg-muted text-muted-foreground",
  referral: "bg-primary/10 text-primary",
  other: "bg-muted text-muted-foreground",
};

export const statusChartColors: Record<string, string> = {
  discovered: "hsl(240 10% 40%)",
  researched: "hsl(240 10% 50%)",
  scored: "hsl(234 89% 74%)",
  qualified: "hsl(160 84% 39%)",
  outreach_pending: "hsl(187 92% 60%)",
  sequence_active: "hsl(187 92% 69%)",
  contacted: "hsl(239 84% 67%)",
  replied: "hsl(187 92% 69%)",
  in_conversation: "hsl(187 92% 60%)",
  call_scheduled: "hsl(38 92% 50%)",
  call_completed: "hsl(38 92% 60%)",
  meeting_booked: "hsl(38 92% 50%)",
  proposal_sent: "hsl(239 84% 67%)",
  negotiating: "hsl(38 92% 60%)",
  converted: "hsl(160 84% 39%)",
  rejected: "hsl(0 84% 60%)",
  unresponsive: "hsl(240 10% 30%)",
};
