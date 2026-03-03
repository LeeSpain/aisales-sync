import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Phone as PhoneIcon, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const outcomeColors: Record<string, string> = {
  interested: "bg-success/10 text-success",
  not_interested: "bg-destructive/10 text-destructive",
  follow_up_needed: "bg-warning/10 text-warning",
  meeting_booked: "bg-success/10 text-success",
  deal_closed: "bg-primary/10 text-primary",
  no_answer: "bg-muted text-muted-foreground",
  voicemail: "bg-muted text-muted-foreground",
};

const Calls = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("calls").select("*, leads(business_name)").eq("company_id", profile!.company_id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Calls</h1>
      <p className="text-muted-foreground mb-6">AI voice calls and scheduled calls</p>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : calls && calls.length > 0 ? (
        <div className="space-y-3">
          {calls.map((call) => (
            <div key={call.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", call.status === "completed" ? "bg-success/10" : "bg-muted")}>
                    {call.status === "completed" ? <CheckCircle className="h-4 w-4 text-success" /> : call.status === "scheduled" ? <Clock className="h-4 w-4 text-warning" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{(call as any).leads?.business_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{call.call_type.replace("_", " ")} • {call.status}</p>
                  </div>
                </div>
                {call.outcome && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", outcomeColors[call.outcome] || "bg-muted text-muted-foreground")}>
                    {call.outcome.replace("_", " ")}
                  </span>
                )}
              </div>
              {call.summary && <p className="text-sm text-muted-foreground mt-2">{call.summary}</p>}
              {call.duration_seconds && <p className="text-xs text-muted-foreground mt-1">Duration: {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <PhoneIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No calls yet</h3>
          <p className="text-sm text-muted-foreground">AI voice calls will appear here once configured</p>
        </div>
      )}
    </div>
  );
};

export default Calls;
