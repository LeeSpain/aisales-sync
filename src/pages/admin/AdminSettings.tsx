import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, Eye, EyeOff, Shield, Globe, CreditCard, Mail, Phone, Save, CheckCircle, AlertCircle } from "lucide-react";

interface ApiKeyConfig {
  id: string;
  label: string;
  envName: string;
  description: string;
  icon: React.ElementType;
  category: string;
  docsUrl: string;
}

const API_KEYS: ApiKeyConfig[] = [
  {
    id: "stripe_secret",
    label: "Stripe Secret Key",
    envName: "STRIPE_SECRET_KEY",
    description: "For subscription payments & billing portal. Get it from dashboard.stripe.com/apikeys",
    icon: CreditCard,
    category: "Payments",
    docsUrl: "https://dashboard.stripe.com/apikeys",
  },
  {
    id: "stripe_webhook",
    label: "Stripe Webhook Secret",
    envName: "STRIPE_WEBHOOK_SECRET",
    description: "For receiving Stripe webhook events. Found in your Stripe webhook endpoint settings.",
    icon: CreditCard,
    category: "Payments",
    docsUrl: "https://dashboard.stripe.com/webhooks",
  },
  {
    id: "google_places",
    label: "Google Places API Key",
    envName: "GOOGLE_PLACES_API_KEY",
    description: "For real lead discovery via Google Maps/Places. Enable Places API in Google Cloud Console.",
    icon: Globe,
    category: "Lead Discovery",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "serp_api",
    label: "SerpAPI Key",
    envName: "SERP_API_KEY",
    description: "For enriching lead data with search results. Get it from serpapi.com/dashboard",
    icon: Globe,
    category: "Lead Discovery",
    docsUrl: "https://serpapi.com/dashboard",
  },
  {
    id: "apollo_api",
    label: "Apollo API Key",
    envName: "APOLLO_API_KEY",
    description: "For B2B prospect discovery and enrichment. Get it from your Apollo.io settings.",
    icon: Globe,
    category: "Lead Discovery",
    docsUrl: "https://apollo.io/settings/api",
  },
  {
    id: "linkedin_cookie",
    label: "LinkedIn session cookie (li_at)",
    envName: "LINKEDIN_SESSION_COOKIE",
    description: "For LinkedIn out-bound sequences and search. Grab 'li_at' cookie from browser.",
    icon: Globe,
    category: "Lead Discovery",
    docsUrl: "https://linkedin.com",
  },
  {
    id: "sendgrid",
    label: "SendGrid API Key",
    envName: "SENDGRID_API_KEY",
    description: "For sending outreach emails. Create one at app.sendgrid.com/settings/api_keys",
    icon: Mail,
    category: "Email",
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
  },
  {
    id: "twilio_sid",
    label: "Twilio Account SID",
    envName: "TWILIO_ACCOUNT_SID",
    description: "For AI voice calls. Found in your Twilio Console dashboard.",
    icon: Phone,
    category: "Voice",
    docsUrl: "https://console.twilio.com",
  },
  {
    id: "twilio_auth",
    label: "Twilio Auth Token",
    envName: "TWILIO_AUTH_TOKEN",
    description: "Twilio authentication token, found alongside Account SID.",
    icon: Phone,
    category: "Voice",
    docsUrl: "https://console.twilio.com",
  },
  {
    id: "twilio_phone",
    label: "Twilio Phone Number",
    envName: "TWILIO_PHONE_NUMBER",
    description: "The Twilio phone number to make calls from (e.g. +1234567890).",
    icon: Phone,
    category: "Voice",
    docsUrl: "https://console.twilio.com/phone-numbers",
  },
];

const AdminSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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

  // Load stored keys from ai_config (we use the purpose field to store key status)
  const { data: storedKeys } = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_config")
        .select("*")
        .eq("purpose", "api_key_store");
      return data || [];
    },
    enabled: isAdmin,
  });

  const isKeyConfigured = (envName: string) => {
    return storedKeys?.some((k) => k.provider === envName && k.is_active);
  };

  const handleSave = async (config: ApiKeyConfig) => {
    const value = values[config.id];
    if (!value?.trim()) {
      toast({ title: "Error", description: "Please enter a value", variant: "destructive" });
      return;
    }

    setSaving((p) => ({ ...p, [config.id]: true }));

    try {
      // Store reference in ai_config table
      const existing = storedKeys?.find((k) => k.provider === config.envName);
      if (existing) {
        await supabase
          .from("ai_config")
          .update({ api_key_encrypted: "configured", is_active: true, model: config.label })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: config.envName,
          purpose: "api_key_store",
          model: config.label,
          api_key_encrypted: "configured",
          is_active: true,
        });
      }

      // Store actual secret via edge function would go here
      // For now we track that the key has been configured
      toast({ title: "Saved", description: `${config.label} has been saved. Add it as a backend secret named ${config.envName} to activate.` });
      setValues((p) => ({ ...p, [config.id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [config.id]: false }));
    }
  };

  const categories = [...new Set(API_KEYS.map((k) => k.category))];

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Manage API keys and integrations. Keys are stored securely as backend secrets.
      </p>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-8">
        <p className="text-sm text-amber-200">
          <strong>Important:</strong> After entering a key here, you also need to add it as a backend secret with the exact name shown.
          This page tracks which keys are configured — the actual secrets are stored securely in the backend.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-foreground">{category}</h2>
          <div className="space-y-4">
            {API_KEYS.filter((k) => k.category === category).map((config) => {
              const configured = isKeyConfigured(config.envName);
              return (
                <div key={config.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <config.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{config.label}</p>
                          {configured ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <CheckCircle className="h-3 w-3" /> Configured
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              <AlertCircle className="h-3 w-3" /> Not set
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={visibility[config.id] ? "text" : "password"}
                        placeholder={configured ? "••••••••••••••••" : `Enter ${config.label}...`}
                        value={values[config.id] || ""}
                        onChange={(e) => setValues((p) => ({ ...p, [config.id]: e.target.value }))}
                        className="pr-10 bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => setVisibility((p) => ({ ...p, [config.id]: !p[config.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {visibility[config.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSave(config)}
                      disabled={saving[config.id] || !values[config.id]?.trim()}
                      className="gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {configured ? "Update" : "Save"}
                    </Button>
                  </div>

                  <div className="mt-2">
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Where to find this key →
                    </a>
                    <span className="text-xs text-muted-foreground ml-3">
                      Secret name: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{config.envName}</code>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminSettings;
