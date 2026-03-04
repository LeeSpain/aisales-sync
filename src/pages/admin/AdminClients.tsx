import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Navigate } from "react-router-dom";
import { Users, Search, UserPlus, Mail, Phone, Send, X, CheckCircle, Clock, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";

const AdminClients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", mobile: "" });
  const [sendVia, setSendVia] = useState<("email" | "whatsapp")[]>(["email"]);

  const { data: roles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const isAdmin = roles?.some((r) => r.role === "admin");
  if (roles && !isAdmin) return <Navigate to="/dashboard" replace />;

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    },
    enabled: isAdmin,
  });

  // Check if WhatsApp is configured
  const { data: whatsappConfig } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_config")
        .select("*")
        .eq("purpose", "api_key_store")
        .eq("provider", "WHATSAPP_API_TOKEN")
        .maybeSingle();
      return data;
    },
    enabled: isAdmin,
  });
  const whatsappConfigured = !!whatsappConfig?.is_active;

  // Fetch invites
  const { data: invites } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin,
  });

  const filtered = companies?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const toggleSendVia = (ch: "email" | "whatsapp") => {
    setSendVia((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSendInvite = async () => {
    if (!invite.name.trim() || !invite.email.trim()) {
      toast({ title: "Missing info", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    if (sendVia.length === 0) {
      toast({ title: "Select channel", description: "Pick at least one delivery method.", variant: "destructive" });
      return;
    }
    if (sendVia.includes("whatsapp") && !invite.mobile.trim()) {
      toast({ title: "Mobile required", description: "Enter a mobile number for WhatsApp delivery.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      // Store the invite
      const { data: newInvite, error } = await supabase
        .from("invitations")
        .insert({
          name: invite.name.trim(),
          email: invite.email.trim(),
          mobile: invite.mobile.trim() || null,
          channels: sendVia,
          status: "pending",
          invited_by: user!.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Call the send-invite edge function
      const { error: fnErr } = await supabase.functions.invoke("send-invite", {
        body: { invite_id: newInvite.id },
      });

      if (fnErr) {
        // Invite saved but delivery may have failed — still show success
        console.error("Send invite function error:", fnErr);
        toast({
          title: "Invite saved",
          description: "Invite was created but delivery may be pending. Check logs for details.",
        });
      } else {
        toast({
          title: "Invite sent!",
          description: `Invitation sent to ${invite.name} via ${sendVia.join(" & ")}.`,
        });
      }

      setInvite({ name: "", email: "", mobile: "" });
      setSendVia(["email"]);
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    } catch (e: any) {
      console.error("Invite error:", e);
      toast({ title: "Error", description: e.message || "Failed to send invite", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const pendingInvites = invites?.filter((i) => i.status === "pending") || [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{companies?.length || 0} total clients</p>
        </div>
        <Button className="gradient-primary border-0 text-white gap-1.5" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Invite Client
        </Button>
      </div>

      {/* Pending invites banner */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-amber-400">
              {pendingInvites.length} pending {pendingInvites.length === 1 ? "invite" : "invites"}
            </p>
          </div>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium">{inv.name}</span>
                <span className="text-muted-foreground">{inv.email}</span>
                <div className="flex items-center gap-1 ml-auto">
                  {(inv.channels as string[])?.map((ch: string) => (
                    <Badge key={ch} variant="outline" className="text-[10px] capitalize">
                      {ch === "email" ? <Mail className="h-2.5 w-2.5 mr-0.5" /> : <MessageSquare className="h-2.5 w-2.5 mr-0.5" />}
                      {ch}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(inv.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background"
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="grid grid-cols-5 gap-4 border-b border-border px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Company</span>
          <span>Industry</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Users</span>
        </div>
        {filtered.length > 0 ? (
          <div className="divide-y divide-border">
            {filtered.map((company) => {
              const userCount = profiles?.filter((p) => p.company_id === company.id).length || 0;
              return (
                <div
                  key={company.id}
                  className="grid grid-cols-5 gap-4 px-6 py-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/clients/${company.id}`)}
                >
                  <div>
                    <p className="font-medium text-sm">{company.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{company.website || "No website"}</p>
                  </div>
                  <span className="text-sm text-muted-foreground self-center">{company.industry || "—"}</span>
                  <span className="text-sm self-center capitalize">{company.subscription_plan || "Free"}</span>
                  <span className={`text-sm self-center capitalize ${company.status === "active" ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {company.status || "—"}
                  </span>
                  <div className="flex items-center gap-1 self-center">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{userCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No clients found</div>
        )}
      </div>

      {/* ═══ INVITE MODAL ═══ */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Invite Client
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join the platform. They'll receive a signup link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Full Name</Label>
              <Input
                id="inv-name"
                value={invite.name}
                onChange={(e) => setInvite((p) => ({ ...p, name: e.target.value }))}
                placeholder="John Smith"
                className="bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email Address</Label>
              <Input
                id="inv-email"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
                placeholder="john@company.com"
                className="bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-mobile">Mobile Number</Label>
              <Input
                id="inv-mobile"
                type="tel"
                value={invite.mobile}
                onChange={(e) => setInvite((p) => ({ ...p, mobile: e.target.value }))}
                placeholder="+44 7700 900000"
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">Required for WhatsApp delivery. Include country code.</p>
            </div>

            {/* Delivery channels */}
            <div className="space-y-2">
              <Label>Send via</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => toggleSendVia("email")}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-3 text-left transition-all",
                    sendVia.includes("email")
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Mail className={cn("h-4 w-4", sendVia.includes("email") ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-[10px] text-muted-foreground">Signup link via email</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (!whatsappConfigured) {
                      toast({
                        title: "WhatsApp not configured",
                        description: "Add your WhatsApp API credentials in Admin Settings first.",
                        variant: "destructive",
                      });
                      return;
                    }
                    toggleSendVia("whatsapp");
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-3 text-left transition-all relative",
                    sendVia.includes("whatsapp")
                      ? "border-primary bg-primary/10"
                      : whatsappConfigured
                        ? "border-border hover:border-primary/50"
                        : "border-border opacity-60"
                  )}
                >
                  <MessageSquare className={cn("h-4 w-4", sendVia.includes("whatsapp") ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium">WhatsApp</p>
                    <p className="text-[10px] text-muted-foreground">
                      {whatsappConfigured ? "Message via WhatsApp" : "Not configured"}
                    </p>
                  </div>
                  {!whatsappConfigured && (
                    <Badge variant="outline" className="absolute -top-2 -right-2 text-[8px] px-1.5">
                      Setup needed
                    </Badge>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                className="gradient-primary border-0 text-white gap-1.5"
                onClick={handleSendInvite}
                disabled={sending || !invite.name.trim() || !invite.email.trim() || sendVia.length === 0}
              >
                {sending ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Send Invite
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClients;
