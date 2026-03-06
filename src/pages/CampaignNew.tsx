import { useState, KeyboardEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useCampaignPipeline } from "@/hooks/useCampaignPipeline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { TagInput } from "@/components/ui/tag-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Target, Users, Globe, MessageSquare, BarChart3, Rocket,
  ChevronRight, ChevronLeft, X, Check, Mail, Linkedin, Phone, MessageCircle,
  Loader2, CheckCircle2, Search, Sparkles, AlertCircle,
} from "lucide-react";

const INDUSTRY_TAGS = [
  "E-commerce", "SaaS", "Retail", "Healthcare", "Finance",
  "Real Estate", "Marketing", "Hospitality", "Manufacturing",
  "Education", "Professional Services", "Other",
];

const SIZE_OPTIONS = [
  { value: "small", label: "Small", desc: "1–50 employees" },
  { value: "medium", label: "Medium", desc: "51–500 employees" },
  { value: "enterprise", label: "Enterprise", desc: "500+ employees" },
];

const GEO_SCOPES = [
  { value: "local", label: "Local", desc: "Specific cities, towns, or postcodes", icon: "📍" },
  { value: "regional", label: "Regional", desc: "Counties, states, or metro areas", icon: "🗺️" },
  { value: "national", label: "National", desc: "One or more countries", icon: "🏳️" },
  { value: "international", label: "International", desc: "Multiple countries or global", icon: "🌍" },
];

const COUNTRIES = [
  "United Kingdom", "United States", "Canada", "Australia", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Ireland", "Sweden",
  "Norway", "Denmark", "Switzerland", "Belgium", "Austria", "Portugal",
  "New Zealand", "Singapore", "UAE", "India", "Japan", "South Korea",
  "Brazil", "Mexico", "South Africa",
];

const UK_REGIONS = [
  "London", "South East", "South West", "East of England", "West Midlands",
  "East Midlands", "Yorkshire", "North West", "North East", "Scotland",
  "Wales", "Northern Ireland",
];

const SPAIN_REGIONS = [
  "Andalusia", "Catalonia", "Community of Madrid", "Valencian Community",
  "Galicia", "Castile and León", "Basque Country", "Canary Islands",
  "Castile-La Mancha", "Region of Murcia", "Aragon", "Extremadura",
  "Asturias", "Balearic Islands", "Navarre", "Cantabria", "La Rioja",
];

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian",
  "Dutch", "Catalan", "Arabic", "Mandarin", "Japanese",
];

const DECISION_MAKER_ROLES = [
  "Owner / Founder", "CEO / Managing Director", "Sales Director",
  "Marketing Manager", "Operations Manager", "General Manager",
  "Procurement Manager", "Any decision maker",
];

const INTERNATIONAL_REGIONS = [
  "Western Europe", "Eastern Europe", "Scandinavia", "North America",
  "Latin America", "Middle East", "Asia Pacific", "Africa", "Global",
];

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail, desc: "Personalized cold email sequences" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, desc: "Connection requests + DMs" },
  { value: "phone", label: "Phone", icon: Phone, desc: "AI-briefed cold calls" },
  { value: "sms", label: "SMS", icon: MessageCircle, desc: "Follow-up text messages" },
];

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
];

const SCORE_LABELS: Record<string, string> = {
  "1": "Any lead (high volume, lower quality)",
  "2": "Basic match (relevant industry)",
  "3": "Good fit (right size + industry)",
  "4": "Strong fit (high intent signals)",
  "5": "Perfect match (ideal client profile)",
};

const STEPS = [
  { icon: Users, label: "Audience" },
  { icon: Globe, label: "Geography" },
  { icon: MessageSquare, label: "Outreach" },
  { icon: BarChart3, label: "Scoring" },
  { icon: Rocket, label: "Launch" },
  { icon: Sparkles, label: "AI Running" },
];

const CampaignNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const pipeline = useCampaignPipeline();

  // Form state
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [businessSize, setBusinessSize] = useState("small");
  const [idealClient, setIdealClient] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [targetDecisionMaker, setTargetDecisionMaker] = useState("Any decision maker");
  const [geoScope, setGeoScope] = useState("");
  const [geoCountries, setGeoCountries] = useState<string[]>([]);
  const [geoRegions, setGeoRegions] = useState<string[]>([]);
  const [geoCities, setGeoCities] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [tone, setTone] = useState("professional");
  const [outreachLanguage, setOutreachLanguage] = useState("English");
  const [minimumScore, setMinimumScore] = useState(3.5);
  const [campaignName, setCampaignName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*, companies(*)").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const company = profile?.companies as Record<string, unknown> | null;

  // Pre-fill outreach language from company profile when it loads
  useEffect(() => {
    if (company?.outreach_languages) {
      const langs = company.outreach_languages as string[];
      if (langs.length > 0) setOutreachLanguage(langs[0]);
    }
  }, [company]);

  const totalSteps = STEPS.length;
  const progress = step >= 5 ? 100 : ((step + 1) / (totalSteps - 1)) * 100;

  const toggleIndustry = (ind: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
    );
  };

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const canNext = () => {
    switch (step) {
      case 0: return selectedIndustries.length > 0;
      case 1: {
        if (!geoScope) return false;
        if (geoScope === "local") return geoCountries.length > 0 && geoCities.length > 0;
        if (geoScope === "regional") return geoCountries.length > 0 && geoRegions.length > 0;
        if (geoScope === "national") return geoCountries.length > 0;
        return geoRegions.length > 0; // international
      }
      case 2: return channels.length > 0;
      case 3: return true;
      default: return campaignName.trim().length > 0;
    }
  };

  /** Build a human-readable geography summary (includes country so AI has full context) */
  const geoSummary = () => {
    const country = geoCountries[0];
    if (geoScope === "local") {
      const cities = geoCities.join(", ");
      return country ? `${cities} (${country})` : cities;
    }
    if (geoScope === "regional") {
      const regions = geoRegions.join(", ");
      return country ? `${regions} (${country})` : regions;
    }
    if (geoScope === "national") return geoCountries.join(", ");
    if (geoScope === "international") return geoRegions.join(", ");
    return "";
  };

  const autoName = () => {
    if (campaignName) return;
    const ind = selectedIndustries[0] || "General";
    const geo = geoSummary().split(",")[0]?.trim() || "Global";
    setCampaignName(`${ind} — ${geo}`);
  };

  const ensureCompany = async (): Promise<string | null> => {
    if (profile?.company_id) return profile.company_id;
    const fullName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "My Company";
    const { data: newCompany, error: compErr } = await supabase
      .from("companies")
      .insert({ name: `${fullName}'s Company`, owner_id: user!.id, status: "active" })
      .select("id")
      .single();
    if (compErr || !newCompany) return null;
    await supabase.from("profiles").update({ company_id: newCompany.id }).eq("id", user!.id);
    await supabase.from("user_roles").upsert({ user_id: user!.id, role: "client" as const }, { onConflict: "user_id,role" });
    return newCompany.id;
  };

  const handleLaunch = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const companyId = await ensureCompany();
      if (!companyId) {
        toast({ title: "Error", description: "Failed to set up your company. Please try again.", variant: "destructive" });
        setSaving(false);
        return;
      }

      const geo = geoSummary();
      const criteria = {
        industries: selectedIndustries,
        business_size: businessSize,
        keywords: customKeywords,
        target_decision_maker: targetDecisionMaker,
        channels,
        tone,
        outreach_language: outreachLanguage,
        geo_scope: geoScope,
        geo_countries: geoCountries,
        geo_regions: geoRegions,
        geo_cities: geoCities,
      };

      const { data: newCampaign, error: campErr } = await supabase
        .from("campaigns")
        .insert({
          company_id: companyId,
          name: campaignName,
          target_description: idealClient || `${selectedIndustries.join(", ")} businesses (${businessSize})`,
          geographic_focus: geo,
          minimum_score: minimumScore,
          target_criteria: criteria,
          status: "setup",
        })
        .select("id")
        .single();

      if (campErr) throw campErr;

      // Move to pipeline step
      setCreatedCampaignId(newCampaign.id);
      setStep(5);
      setSaving(false);

      // Run the AI pipeline
      pipeline.runPipeline({
        campaignId: newCampaign.id,
        companyId,
        targetCriteria: criteria,
        geographicFocus: geo,
        minimumScore,
        tone,
      });
    } catch (e) {
      console.error("Campaign create error:", e);
      toast({ title: "Error", description: "Could not create campaign. Please try again.", variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left sidebar — steps */}
      <div className="hidden w-72 flex-col justify-between border-r border-border bg-card p-8 lg:flex">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold">New Campaign</span>
          </div>

          <div className="space-y-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              const isPipelineStep = i === 5;
              const pipelineLocked = step >= 5; // Can't go back once pipeline starts
              return (
                <button
                  key={s.label}
                  onClick={() => !pipelineLocked && i < step && setStep(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-primary/10 text-primary font-medium" :
                    isDone ? "text-foreground cursor-pointer hover:bg-muted/50" :
                    "text-muted-foreground cursor-default"
                  } ${pipelineLocked && !isActive ? "opacity-50 cursor-default" : ""}`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isActive && isPipelineStep ? "gradient-primary" :
                    isActive ? "gradient-primary" :
                    isDone ? "bg-success/20" :
                    "bg-muted/30"
                  }`}>
                    {isDone ? <Check className="h-4 w-4 text-success" /> :
                     isActive && isPipelineStep ? <Loader2 className={`h-4 w-4 text-white ${pipeline.stage !== "done" && pipeline.stage !== "error" ? "animate-spin" : ""}`} /> :
                     <Icon className={`h-4 w-4 ${isActive ? "text-white" : ""}`} />}
                  </div>
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* AI tip from company profile */}
          {company?.industry && (
            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-medium text-primary mb-1">AI Suggestion</p>
              <p className="text-xs text-muted-foreground">
                Based on your {company.industry as string} business, targeting {
                  (company.target_markets as string[])?.slice(0, 2).join(" and ") || "similar businesses"
                } could be a great starting point.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Step {step + 1} of {totalSteps}</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile progress */}
        <div className="p-4 lg:p-6">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold">New Campaign</span>
            <span className="ml-auto text-xs text-muted-foreground">Step {step + 1}/{totalSteps}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Step content */}
        <div className="flex-1 px-4 pb-8 lg:px-8">
          <div className="w-full space-y-6">

            {/* Step 0: Target Audience */}
            {step === 0 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Who do you want to target?</CardTitle>
                  <CardDescription>Select industries and define your ideal client profile.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Industries (select all that apply)</Label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRY_TAGS.map((ind) => (
                        <Badge
                          key={ind}
                          variant={selectedIndustries.includes(ind) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${
                            selectedIndustries.includes(ind)
                              ? "bg-primary text-primary-foreground"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => toggleIndustry(ind)}
                        >
                          {ind}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Business size</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {SIZE_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setBusinessSize(s.value)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            businessSize === s.value
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="idealClient">Describe your ideal client (optional)</Label>
                    <Textarea
                      id="idealClient"
                      value={idealClient}
                      onChange={(e) => setIdealClient(e.target.value)}
                      placeholder="e.g. Growing e-commerce brands doing £50k+ monthly revenue who need help with paid ads"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Custom keywords (optional)</Label>
                    <TagInput
                      tags={customKeywords}
                      onAdd={(t) => setCustomKeywords([...customKeywords, t])}
                      onRemove={(i) => setCustomKeywords(customKeywords.filter((_, idx) => idx !== i))}
                      placeholder="e.g. Shopify, DTC brand, online store"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Who to contact at each business?</Label>
                    <div className="flex flex-wrap gap-2">
                      {DECISION_MAKER_ROLES.map((role) => (
                        <Badge
                          key={role}
                          variant={targetDecisionMaker === role ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${targetDecisionMaker === role ? "bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
                          onClick={() => setTargetDecisionMaker(role)}
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">The AI will try to find and contact this type of person at each lead.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Geographic Focus */}
            {step === 1 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Where should we look?</CardTitle>
                  <CardDescription>Define exactly where your AI should find leads — from local streets to global markets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Scope selector */}
                  <div className="space-y-2">
                    <Label>Search scope</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {GEO_SCOPES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => {
                            setGeoScope(s.value);
                            setGeoCountries([]);
                            setGeoRegions([]);
                            setGeoCities([]);
                          }}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                            geoScope === s.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="text-lg mt-0.5">{s.icon}</span>
                          <div>
                            <p className="text-sm font-medium">{s.label}</p>
                            <p className="text-xs text-muted-foreground">{s.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* LOCAL: Country + Cities/Towns/Postcodes */}
                  {geoScope === "local" && (
                    <>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Select
                          value={geoCountries[0] || ""}
                          onValueChange={(v) => setGeoCountries([v])}
                        >
                          <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cities, towns, villages, or postcodes</Label>
                        <TagInput
                          tags={geoCities}
                          onAdd={(t) => setGeoCities([...geoCities, t])}
                          onRemove={(i) => setGeoCities(geoCities.filter((_, idx) => idx !== i))}
                          placeholder={
                            geoCountries[0] === "Spain"
                              ? "e.g. Marbella, Ronda, Fuengirola, 29600, Nerja"
                              : geoCountries[0] === "United Kingdom"
                              ? "e.g. Manchester, M1, Leeds, Sheffield S1"
                              : "e.g. Town, city, or postcode"
                          }
                        />
                        <p className="text-xs text-muted-foreground">Add any number of locations — villages, towns, cities, or postcodes. Your AI searches for businesses in each one.</p>
                      </div>
                    </>
                  )}

                  {/* REGIONAL: Country + Regions */}
                  {geoScope === "regional" && (
                    <>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Select
                          value={geoCountries[0] || ""}
                          onValueChange={(v) => setGeoCountries([v])}
                        >
                          <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {geoCountries[0] === "United Kingdom" ? (
                        <div className="space-y-2">
                          <Label>Regions</Label>
                          <div className="flex flex-wrap gap-2">
                            {UK_REGIONS.map((r) => (
                              <Badge
                                key={r}
                                variant={geoRegions.includes(r) ? "default" : "outline"}
                                className={`cursor-pointer transition-all ${
                                  geoRegions.includes(r) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"
                                }`}
                                onClick={() =>
                                  setGeoRegions((prev) =>
                                    prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                                  )
                                }
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : geoCountries[0] === "Spain" ? (
                        <div className="space-y-2">
                          <Label>Autonomous communities</Label>
                          <div className="flex flex-wrap gap-2">
                            {SPAIN_REGIONS.map((r) => (
                              <Badge
                                key={r}
                                variant={geoRegions.includes(r) ? "default" : "outline"}
                                className={`cursor-pointer transition-all ${
                                  geoRegions.includes(r) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"
                                }`}
                                onClick={() =>
                                  setGeoRegions((prev) =>
                                    prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                                  )
                                }
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Regions, states, or areas</Label>
                          <TagInput
                            tags={geoRegions}
                            onAdd={(t) => setGeoRegions([...geoRegions, t])}
                            onRemove={(i) => setGeoRegions(geoRegions.filter((_, idx) => idx !== i))}
                            placeholder="e.g. Andalusia, California, Bavaria, New South Wales"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* NATIONAL: Multi-country select */}
                  {geoScope === "national" && (
                    <div className="space-y-2">
                      <Label>Countries</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {geoCountries.map((c, i) => (
                          <Badge key={i} variant="secondary" className="gap-1 pr-1">
                            {c}
                            <button onClick={() => setGeoCountries(geoCountries.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <Select
                        value=""
                        onValueChange={(v) => {
                          if (!geoCountries.includes(v)) setGeoCountries([...geoCountries, v]);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Add a country" /></SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.filter((c) => !geoCountries.includes(c)).map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* INTERNATIONAL: World regions */}
                  {geoScope === "international" && (
                    <div className="space-y-2">
                      <Label>World regions</Label>
                      <div className="flex flex-wrap gap-2">
                        {INTERNATIONAL_REGIONS.map((r) => (
                          <Badge
                            key={r}
                            variant={geoRegions.includes(r) ? "default" : "outline"}
                            className={`cursor-pointer transition-all ${
                              geoRegions.includes(r) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"
                            }`}
                            onClick={() =>
                              setGeoRegions((prev) =>
                                prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                              )
                            }
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info tip */}
                  {geoScope && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs text-muted-foreground">
                        {geoScope === "local" && "Perfect for targeting businesses on specific high streets, business parks, or neighbourhoods. Your AI will search Google Maps, directories, and social media for leads in these exact locations."}
                        {geoScope === "regional" && "Great for covering larger areas like counties or metro regions. Your AI will find businesses across the entire region."}
                        {geoScope === "national" && "Target businesses across entire countries. Best for products or services that aren't location-dependent."}
                        {geoScope === "international" && "Go global. Your AI will adapt outreach language and approach for each market."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Outreach Strategy */}
            {step === 2 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">How should we reach them?</CardTitle>
                  <CardDescription>Choose your outreach channels and communication style.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Outreach channels</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {CHANNELS.map((ch) => {
                        const Icon = ch.icon;
                        const selected = channels.includes(ch.value);
                        return (
                          <button
                            key={ch.value}
                            onClick={() => toggleChannel(ch.value)}
                            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                              selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <Icon className={`h-5 w-5 mt-0.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                            <div>
                              <p className="text-sm font-medium">{ch.label}</p>
                              <p className="text-xs text-muted-foreground">{ch.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Communication tone</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {TONE_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTone(t.value)}
                          className={`rounded-xl border px-3 py-2 text-sm transition-all ${
                            tone === t.value
                              ? "border-primary bg-primary/10 font-medium"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Outreach language</Label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => (
                        <Badge
                          key={lang}
                          variant={outreachLanguage === lang ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${outreachLanguage === lang ? "bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
                          onClick={() => setOutreachLanguage(lang)}
                        >
                          {lang}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">All messages for this campaign will be written in this language.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Quality & Scoring */}
            {step === 3 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Set your quality threshold</CardTitle>
                  <CardDescription>Only leads scoring above this threshold will enter your pipeline.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Minimum quality score</Label>
                      <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                        {minimumScore.toFixed(1)}
                      </Badge>
                    </div>
                    <Slider
                      value={[minimumScore]}
                      onValueChange={(v) => setMinimumScore(v[0])}
                      min={1}
                      max={5}
                      step={0.5}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1.0 — More leads</span>
                      <span>5.0 — Higher quality</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    {Object.entries(SCORE_LABELS).map(([score, label]) => (
                      <div key={score} className={`flex items-center gap-2 text-xs ${
                        parseFloat(score) === Math.floor(minimumScore) ? "text-primary font-medium" : "text-muted-foreground"
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          parseFloat(score) === Math.floor(minimumScore) ? "bg-primary" : "bg-border"
                        }`} />
                        <span className="font-medium w-4">{score}.0</span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Review & Launch */}
            {step === 4 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Review & launch</CardTitle>
                  <CardDescription>Give your campaign a name and confirm the details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaignName">Campaign name</Label>
                    <Input
                      id="campaignName"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g. UK E-commerce Q1"
                      onFocus={autoName}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-3">
                    <ReviewRow label="Industries" value={selectedIndustries.join(", ")} onEdit={() => setStep(0)} />
                    <ReviewRow label="Business size" value={SIZE_OPTIONS.find(s => s.value === businessSize)?.label || businessSize} onEdit={() => setStep(0)} />
                    <ReviewRow label="Contact target" value={targetDecisionMaker} onEdit={() => setStep(0)} />
                    {idealClient && <ReviewRow label="Ideal client" value={idealClient} onEdit={() => setStep(0)} />}
                    <ReviewRow label="Scope" value={GEO_SCOPES.find(s => s.value === geoScope)?.label || geoScope} onEdit={() => setStep(1)} />
                    <ReviewRow label="Locations" value={geoSummary()} onEdit={() => setStep(1)} />
                    <ReviewRow label="Channels" value={channels.map(c => CHANNELS.find(ch => ch.value === c)?.label).join(", ")} onEdit={() => setStep(2)} />
                    <ReviewRow label="Language" value={outreachLanguage} onEdit={() => setStep(2)} />
                    <ReviewRow label="Tone" value={TONE_OPTIONS.find(t => t.value === tone)?.label || tone} onEdit={() => setStep(2)} />
                    <ReviewRow label="Min score" value={minimumScore.toFixed(1)} onEdit={() => setStep(3)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: AI Pipeline Running */}
            {step === 5 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    {pipeline.stage === "done" ? (
                      <><CheckCircle2 className="h-5 w-5 text-success" /> Campaign Ready</>
                    ) : pipeline.stage === "error" ? (
                      <><AlertCircle className="h-5 w-5 text-destructive" /> Pipeline Error</>
                    ) : (
                      <><Loader2 className="h-5 w-5 animate-spin text-primary" /> AI Pipeline Running</>
                    )}
                  </CardTitle>
                  <CardDescription>{pipeline.progress || "Starting pipeline..."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Pipeline stages */}
                  <div className="space-y-3">
                    {[
                      { key: "discovering", label: "Discovering leads", icon: Search },
                      { key: "scoring", label: "Scoring & qualifying", icon: BarChart3 },
                      { key: "saving_leads", label: "Saving leads to pipeline", icon: Users },
                      { key: "generating_outreach", label: "Writing outreach messages", icon: MessageSquare },
                      { key: "finalizing", label: "Finalising campaign", icon: Rocket },
                    ].map((s) => {
                      const stageOrder = ["idle", "discovering", "scoring", "saving_leads", "generating_outreach", "finalizing", "done"];
                      const currentIdx = stageOrder.indexOf(pipeline.stage === "error" ? "done" : pipeline.stage);
                      const thisIdx = stageOrder.indexOf(s.key);
                      const isActive = pipeline.stage === s.key;
                      const isDone = currentIdx > thisIdx || pipeline.stage === "done";
                      const Icon = s.icon;
                      return (
                        <div key={s.key} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          isActive ? "bg-primary/10 text-primary font-medium" :
                          isDone ? "text-foreground" :
                          "text-muted-foreground"
                        }`}>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            isActive ? "gradient-primary" :
                            isDone ? "bg-success/20" :
                            "bg-muted/30"
                          }`}>
                            {isActive ? (
                              <Loader2 className="h-4 w-4 text-white animate-spin" />
                            ) : isDone ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <Icon className="h-4 w-4" />
                            )}
                          </div>
                          {s.label}
                        </div>
                      );
                    })}
                  </div>

                  {/* Stats */}
                  {(pipeline.leadsFound > 0 || pipeline.stage === "done") && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-border bg-card p-3 text-center">
                        <p className="text-2xl font-bold">{pipeline.leadsFound}</p>
                        <p className="text-[10px] text-muted-foreground">Leads Found</p>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-3 text-center">
                        <p className="text-2xl font-bold">{pipeline.leadsQualified}</p>
                        <p className="text-[10px] text-muted-foreground">Qualified</p>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-3 text-center">
                        <p className="text-2xl font-bold">{pipeline.messagesGenerated}</p>
                        <p className="text-[10px] text-muted-foreground">Messages</p>
                      </div>
                    </div>
                  )}

                  {pipeline.stage === "error" && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <p className="text-sm text-destructive">{pipeline.error}</p>
                      <p className="text-xs text-muted-foreground mt-1">The campaign was created. You can view it and retry later.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            {step <= 4 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  onClick={() => step === 0 ? navigate("/campaigns") : setStep(step - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
                </Button>

                {step < 4 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={!canNext()}
                    className="gradient-primary border-0 text-white gap-1"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleLaunch}
                    disabled={saving || !campaignName.trim()}
                    className="gradient-primary border-0 text-white gap-2"
                  >
                    {saving ? "Launching..." : (
                      <>
                        <Rocket className="h-4 w-4" /> Launch Campaign
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Pipeline done/error navigation */}
            {step === 5 && (pipeline.stage === "done" || pipeline.stage === "error") && (
              <div className="flex items-center justify-end pt-2">
                <Button
                  onClick={() => navigate(`/campaigns/${createdCampaignId}`)}
                  className="gradient-primary border-0 text-white gap-2"
                >
                  View Campaign <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Small review row with edit button */
function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
      <button onClick={onEdit} className="shrink-0 text-xs text-primary hover:underline">Edit</button>
    </div>
  );
}

export default CampaignNew;
