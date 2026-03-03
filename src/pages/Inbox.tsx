import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const intentColors: Record<string, string> = {
  interested: "bg-success/10 text-success",
  not_interested: "bg-destructive/10 text-destructive",
  question: "bg-accent/10 text-accent",
  call_request: "bg-warning/10 text-warning",
  out_of_office: "bg-muted text-muted-foreground",
  other: "bg-muted text-muted-foreground",
};

const Inbox = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: replies, isLoading, refetch } = useQuery({
    queryKey: ["inbox-replies", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("email_replies").select("*, leads(business_name, city)").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const handleApprove = async (replyId: string) => {
    await supabase.from("email_replies").update({ ai_draft_approved: true }).eq("id", replyId);
    toast({ title: "Draft approved and queued for sending" });
    refetch();
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Inbox</h1>
      <p className="text-muted-foreground mb-6">Review lead replies and AI-drafted responses</p>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : replies && replies.length > 0 ? (
        <div className="space-y-4">
          {replies.map((reply) => (
            <div key={reply.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{(reply as any).leads?.business_name || "Unknown"}</h3>
                  {reply.intent && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", intentColors[reply.intent] || "bg-muted text-muted-foreground")}>
                      {reply.intent.replace("_", " ")}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(reply.created_at).toLocaleDateString()}</span>
              </div>

              {/* Original reply */}
              <div className="rounded-lg bg-muted/50 p-4 mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">From: {reply.from_email}</p>
                {reply.subject && <p className="text-sm font-medium mb-1">{reply.subject}</p>}
                <p className="text-sm">{reply.body}</p>
              </div>

              {/* AI Draft */}
              {reply.ai_draft_response && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium text-primary mb-2">AI Draft Response</p>
                  <p className="text-sm">{reply.ai_draft_response}</p>
                  {!reply.ai_draft_approved && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="gradient-primary border-0 text-white" onClick={() => handleApprove(reply.id)}>
                        <Check className="h-3 w-3 mr-1" /> Approve & Send
                      </Button>
                      <Button size="sm" variant="outline">
                        <X className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </div>
                  )}
                  {reply.ai_draft_approved && (
                    <p className="mt-2 text-xs text-success font-medium">✓ Approved</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Inbox empty</h3>
          <p className="text-sm text-muted-foreground">Lead replies will appear here with AI-drafted responses</p>
        </div>
      )}
    </div>
  );
};

export default Inbox;
