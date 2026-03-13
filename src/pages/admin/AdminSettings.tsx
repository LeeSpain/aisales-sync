import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTestMode } from "@/hooks/useTestMode";
import { useTheme } from "@/hooks/useTheme";
import { useBrandColors } from "@/hooks/useBrandColors";
import { useLeadApiToggles } from "@/hooks/useLeadApiToggles";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Key, Eye, EyeOff, Shield, Globe, CreditCard, Mail, Phone, Save,
  CheckCircle, AlertCircle, FlaskConical, User, Sun, Moon, Palette,
  RotateCcw, MessageSquare,
} from "lucide-react";

// ─── API Key Config ───
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
  { id: "stripe_secret", label: "Stripe Secret Key", envName: "STRIPE_SECRET_KEY", description: "For subscription payments & billing portal. Get it from dashboard.stripe.com/apikeys", icon: CreditCard, category: "Payments", docsUrl: "https://dashboard.stripe.com/apikeys" },
  { id: "stripe_webhook", label: "Stripe Webhook Secret", envName: "STRIPE_WEBHOOK_SECRET", description: "For receiving Stripe webhook events. Found in your Stripe webhook endpoint settings.", icon: CreditCard, category: "Payments", docsUrl: "https://dashboard.stripe.com/webhooks" },
  { id: "google_places", label: "Google Places API Key", envName: "GOOGLE_PLACES_API_KEY", description: "For real lead discovery via Google Maps/Places. Enable Places API in Google Cloud Console.", icon: Globe, category: "Lead Discovery", docsUrl: "https://console.cloud.google.com/apis/credentials" },
  { id: "serp_api", label: "SerpAPI Key", envName: "SERP_API_KEY", description: "For enriching lead data with search results. Get it from serpapi.com/dashboard", icon: Globe, category: "Lead Discovery", docsUrl: "https://serpapi.com/dashboard" },
  { id: "apollo_api", label: "Apollo API Key", envName: "APOLLO_API_KEY", description: "For B2B prospect discovery and enrichment. Get it from your Apollo.io settings.", icon: Globe, category: "Lead Discovery", docsUrl: "https://apollo.io/settings/api" },
  { id: "linkedin_cookie", label: "LinkedIn session cookie (li_at)", envName: "LINKEDIN_SESSION_COOKIE", description: "For LinkedIn out-bound sequences and search. Grab 'li_at' cookie from browser.", icon: Globe, category: "Lead Discovery", docsUrl: "https://linkedin.com" },
  { id: "sendgrid", label: "SendGrid API Key", envName: "SENDGRID_API_KEY", description: "For sending outreach emails. Create one at app.sendgrid.com/settings/api_keys", icon: Mail, category: "Email", docsUrl: "https://app.sendgrid.com/settings/api_keys" },
  { id: "twilio_sid", label: "Twilio Account SID", envName: "TWILIO_ACCOUNT_SID", description: "For AI voice calls. Found in your Twilio Console dashboard.", icon: Phone, category: "Voice", docsUrl: "https://console.twilio.com" },
  { id: "twilio_auth", label: "Twilio Auth Token", envName: "TWILIO_AUTH_TOKEN", description: "Twilio authentication token, found alongside Account SID.", icon: Phone, category: "Voice", docsUrl: "https://console.twilio.com" },
  { id: "twilio_phone", label: "Twilio Phone Number", envName: "TWILIO_PHONE_NUMBER", description: "The Twilio phone number to make calls from (e.g. +1234567890).", icon: Phone, category: "Voice", docsUrl: "https://console.twilio.com/phone-numbers" },
  { id: "whatsapp_api_id", label: "WhatsApp Business Account ID", envName: "WHATSAPP_BUSINESS_ACCOUNT_ID", description: "Your WhatsApp Business Account ID from Meta Business Suite.", icon: MessageSquare, category: "WhatsApp", docsUrl: "https://business.facebook.com/settings/whatsapp-business-accounts" },
  { id: "whatsapp_phone_id", label: "WhatsApp Phone Number ID", envName: "WHATSAPP_PHONE_NUMBER_ID", description: "The phone number ID registered to your WhatsApp Business account.", icon: MessageSquare, category: "WhatsApp", docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" },
  { id: "whatsapp_token", label: "WhatsApp API Token", envName: "WHATSAPP_API_TOKEN", description: "Permanent access token for the WhatsApp Cloud API. Generate in Meta Developer Portal.", icon: MessageSquare, category: "WhatsApp", docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#set-up-developer-assets" },
];

const AdminSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isTestMode, isToggling, toggle: toggleTestMode } = useTestMode();
  const { theme, setTheme } = useTheme();
  const { colors, setColors, reset: resetColors, defaults } = useBrandColors();
  const leadToggles = useLeadApiToggles();

  const getPurpose = (keyId: string): string => {
    const maps: Record<string, string> = {
      "google_places": "google_places_api",
      "serp_api": "serper_api",
      "apollo_api": "apollo_api",
      "linkedin_cookie": "linkedin_api",
    };
    return maps[keyId] || `${keyId}_api`;
  };
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // ─── Auth guard ───
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

  // ─── Owner profile ───
  const { data: profile } = useQuery({
    queryKey: ["admin-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const [profileEdits, setProfileEdits] = useState<{ full_name?: string; avatar_url?: string }>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updates: Record<string, string> = {};
      if (profileEdits.full_name !== undefined) updates.full_name = profileEdits.full_name;
      if (profileEdits.avatar_url !== undefined) updates.avatar_url = profileEdits.avatar_url;

      if (Object.keys(updates).length === 0) {
        toast({ title: "No changes", description: "Nothing to save." });
        setSavingProfile(false);
        return;
      }

      await supabase.from("profiles").update(updates).eq("id", user.id);
      queryClient.invalidateQueries({ queryKey: ["admin-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Saved", description: "Your profile has been updated." });
      setProfileEdits({});
    } catch {
      toast({ title: "Error", description: "Failed to save profile", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── API keys ───
  const { data: storedKeys } = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: async () => {
      const { data } = await supabase.from("api_keys").select("*").eq("is_active", true);
      return data || [];
    },
    enabled: isAdmin,
  });

  const isKeyConfigured = (envName: string) => storedKeys?.some((k) => k.key_name === envName && k.is_active);

  const handleSave = async (config: ApiKeyConfig) => {
    const value = values[config.id];
    if (!value?.trim()) {
      toast({ title: "Error", description: "Please enter a value", variant: "destructive" });
      return;
    }
    setSaving((p) => ({ ...p, [config.id]: true }));
    try {
      const existing = storedKeys?.find((k) => k.key_name === config.envName);
      if (existing) {
        await supabase.from("api_keys").update({ key_value: value, is_active: true, label: config.label }).eq("id", existing.id);
      } else {
        await supabase.from("api_keys").insert({ key_name: config.envName, key_value: value, label: config.label, is_active: true });
      }
      toast({ title: "Saved", description: `${config.label} has been saved and is now live.` });
      setValues((p) => ({ ...p, [config.id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [config.id]: false }));
    }
  };

  const categories = [...new Set(API_KEYS.map((k) => k.category))];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Your profile, appearance, API keys, and platform configuration.
      </p>

      {/* ═══ OWNER PROFILE ═══ */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-semibold">Owner Profile</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Full Name</label>
            <Input
              value={profileEdits.full_name ?? profile?.full_name ?? ""}
              onChange={(e) => setProfileEdits((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Your full name"
              className="bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <Input value={user?.email || ""} disabled className="bg-background opacity-60" />
            <p className="text-[10px] text-muted-foreground mt-1">Email is tied to your auth account and cannot be changed here.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Avatar URL</label>
            <div className="flex gap-3 items-center">
              {(profileEdits.avatar_url ?? profile?.avatar_url) && (
                <img
                  src={profileEdits.avatar_url ?? profile?.avatar_url ?? ""}
                  alt="Avatar"
                  className="h-10 w-10 rounded-full object-cover border border-border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <Input
                value={profileEdits.avatar_url ?? profile?.avatar_url ?? ""}
                onChange={(e) => setProfileEdits((p) => ({ ...p, avatar_url: e.target.value }))}
                placeholder="https://example.com/avatar.jpg"
                className="bg-background flex-1"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile || Object.keys(profileEdits).length === 0}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save Profile
          </Button>
        </div>
      </div>

      {/* ═══ THEME PICKER ═══ */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : theme === "brand" ? <Palette className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          </div>
          <div>
            <h2 className="font-semibold">Appearance</h2>
            <p className="text-xs text-muted-foreground">
              Choose your theme. Your preference is saved locally.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Light */}
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              theme === "light"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Sun className="h-4 w-4 text-amber-600" />
              </div>
              {theme === "light" && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-sm font-semibold">Light</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Clean, bright interface</p>
            {/* Mini preview */}
            <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gray-100" />
              <div className="flex">
                <div className="w-6 bg-gray-50 h-8" />
                <div className="flex-1 bg-white h-8 p-1.5">
                  <div className="h-1.5 w-8 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          </button>

          {/* Dark */}
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              theme === "dark"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                <Moon className="h-4 w-4 text-slate-300" />
              </div>
              {theme === "dark" && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-sm font-semibold">Dark</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Easy on the eyes</p>
            {/* Mini preview */}
            <div className="mt-3 rounded-lg border border-gray-700 overflow-hidden">
              <div className="h-2 bg-gray-900" />
              <div className="flex">
                <div className="w-6 bg-gray-800 h-8" />
                <div className="flex-1 bg-gray-900 h-8 p-1.5">
                  <div className="h-1.5 w-8 bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          </button>

          {/* Brand */}
          <button
            onClick={() => setTheme("brand")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              theme === "brand"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <Palette className="h-4 w-4 text-white" />
              </div>
              {theme === "brand" && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-sm font-semibold">Brand</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tinted with your colours</p>
            {/* Mini preview — brand-tinted */}
            <div className="mt-3 rounded-lg border border-primary/30 overflow-hidden">
              <div className="h-2 bg-primary/20" />
              <div className="flex">
                <div className="w-6 bg-primary/10 h-8" />
                <div className="flex-1 bg-primary/5 h-8 p-1.5">
                  <div className="h-1.5 w-8 bg-primary/20 rounded" />
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ═══ BRAND COLOURS ═══ */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold">Brand Colours</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={resetColors} className="gap-1 text-xs h-7">
            <RotateCcw className="h-3 w-3" /> Reset Defaults
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Customise the platform colours. Changes are applied instantly and saved locally. Affects buttons, accents, badges, and gradients across the entire UI.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            { key: "primary" as const, label: "Primary", desc: "Buttons, links, active states" },
            { key: "accent" as const, label: "Accent", desc: "Gradients, highlights" },
            { key: "success" as const, label: "Success", desc: "Active badges, positive states" },
            { key: "warning" as const, label: "Warning", desc: "Alerts, trial warnings" },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="color"
                  value={colors[key]}
                  onChange={(e) => setColors({ [key]: e.target.value })}
                  className="h-8 w-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={colors[key]}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) setColors({ [key]: v });
                  }}
                  placeholder="#000000"
                  className="text-xs h-7 bg-background font-mono"
                />
              </div>
              {colors[key] !== defaults[key] && (
                <p className="text-[10px] text-amber-400 mt-1">Modified (default: {defaults[key]})</p>
              )}
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="mt-4 rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground mb-2">Live Preview</p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" className="gradient-primary border-0 text-white">Primary Button</Button>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Primary Badge</span>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Success Badge</span>
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Warning Badge</span>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Accent Badge</span>
            <span className="text-sm font-bold gradient-text">Gradient Text</span>
          </div>
        </div>
      </div>

      {/* ═══ TEST MODE ═══ */}
      <div className={`rounded-xl border p-5 mb-8 transition-colors ${isTestMode ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isTestMode ? "bg-emerald-500/10" : "bg-muted"}`}>
              <FlaskConical className={`h-5 w-5 ${isTestMode ? "text-emerald-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-medium">Test Mode</p>
              <p className="text-xs text-muted-foreground">
                When enabled, new signups skip real payment and are activated as fully paid.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isTestMode}
            disabled={isToggling}
            onClick={() => {
              toggleTestMode(!isTestMode);
              toast({
                title: isTestMode ? "Test Mode disabled" : "Test Mode enabled",
                description: isTestMode
                  ? "New signups will now require real payment via Stripe."
                  : "New signups will simulate full payment — no money charged.",
              });
            }}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${isTestMode ? "bg-emerald-500" : "bg-muted"}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${isTestMode ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {isTestMode && (
          <div className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            Test Mode is ON — new registrations will be marked as fully paid (status: active, setup fee: paid) without charging any money.
          </div>
        )}
      </div>

      {/* ═══ API KEYS ═══ */}
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
              const purpose = getPurpose(config.id);
              const isEnabled = leadToggles.isApiEnabled(purpose);
              const configured = isKeyConfigured(config.envName);
              const isLeadDiscovery = config.category === "Lead Discovery";
              const configured = isKeyConfigured(config.envName);
              const statusText = isLeadDiscovery 
                ? (isEnabled && configured ? "Enabled & Configured" : isEnabled ? "Enabled • Add Key" : "Disabled")
                : (configured ? "Configured" : "Not set");
              const statusVariant = isLeadDiscovery 
                ? (isEnabled && configured ? "bg-emerald-500/10 text-emerald-400" : isEnabled ? "bg-amber-500/10 text-amber-400" : "bg-muted text-muted-foreground")
                : (configured ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground");;
              return (
                <div key={config.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <config.icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{config.label}</p>
                          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", statusVariant)}>
                            {isLeadDiscovery ? (
                              <>
                                {isEnabled ? <CheckCircle className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                                {statusText}
                              </>
                            ) : (
                              configured ? (
                                <>
                                  <CheckCircle className="h-3 w-3" /> Configured
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3 w-3" /> Not set
                                </>
                              )
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                      </div>
                    </div>
                  </div>
                  {isLeadDiscovery && (
                    <div className="flex items-center justify-between py-3 border-t border-border/50">
                      <div className="flex items-center gap-2 text-sm">
                        <span>Enable API</span>
                        <p className="text-xs text-muted-foreground">{leadToggles.LEAD_APIS.find(a => a.purpose === purpose)?.description}</p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => {
                          leadToggles.toggleApi({ purpose, enabled: checked });
                          toast({
                            title: `${config.label} ${checked ? "enabled" : "disabled"}`,
                            description: checked 
                              ? "API calls will now use this integration" 
                              : "API calls will skip this integration (fallback to others/AI)",
                          });
                        }}
                        disabled={leadToggles.isToggling}
                      />
                    </div>
                  )}

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
                    <a href={config.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
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
