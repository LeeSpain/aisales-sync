import { useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Target, Users, Globe, MessageSquare, BarChart3, Rocket,
  ChevronRight, ChevronLeft, X, Check, Mail, Linkedin, Phone, MessageCircle,
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

const REGIONS = ["United Kingdom", "Europe", "North America", "Asia Pacific", "Global", "Custom"];

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
];

/** Tag input component */
function TagInput({ tags, onAdd, onRemove, placeholder }: {
  tags: string[]; onAdd: (tag: string) => void; onRemove: (idx: number) => void; placeholder: string;
}) {
  const [input, setInput] = useState("");
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button onClick={() => onRemove(i)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} placeholder={placeholder} />
      <p className="text-xs text-muted-foreground mt-1">Press Enter to add</p>
    </div>
  );
}

const CampaignNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [businessSize, setBusinessSize] = useState("small");
  const [idealClient, setIdealClient] = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [geographicFocus, setGeographicFocus] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [tone, setTone] = useState("professional");
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
  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

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
      case 1: return geographicFocus.length > 0;
      case 2: return channels.length > 0;
      case 3: return true;
      default: return campaignName.trim().length > 0;
    }
  };

  const autoName = () => {
    if (campaignName) return;
    const ind = selectedIndustries[0] || "General";
    const geo = geographicFocus === "Custom" ? customRegion : geographicFocus;
    setCampaignName(`${ind} — ${geo || "Global"}`);
  };

  const handleLaunch = async () => {
    if (!user || !profile?.company_id) return;
    setSaving(true);

    try {
      const geo = geographicFocus === "Custom" ? customRegion : geographicFocus;

      const { data: newCampaign, error: campErr } = await supabase
        .from("campaigns")
        .insert({
          company_id: profile.company_id,
          name: campaignName,
          target_description: idealClient || `${selectedIndustries.join(", ")} businesses (${businessSize})`,
          geographic_focus: geo,
          minimum_score: minimumScore,
          target_criteria: {
            industries: selectedIndustries,
            business_size: businessSize,
            keywords: customKeywords,
            channels,
            tone,
          },
          status: "active",
        })
        .select("id")
        .single();

      if (campErr) throw campErr;

      toast({ title: "Campaign launched!", description: `"${campaignName}" is now active. Your AI is starting lead discovery.` });
      navigate(`/campaigns/${newCampaign.id}`);
    } catch (e) {
      console.error("Campaign create error:", e);
      toast({ title: "Error", description: "Could not create campaign. Please try again.", variant: "destructive" });
    } finally {
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
              return (
                <button
                  key={s.label}
                  onClick={() => i < step && setStep(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-primary/10 text-primary font-medium" :
                    isDone ? "text-foreground cursor-pointer hover:bg-muted/50" :
                    "text-muted-foreground cursor-default"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isActive ? "gradient-primary" :
                    isDone ? "bg-success/20" :
                    "bg-muted/30"
                  }`}>
                    {isDone ? <Check className="h-4 w-4 text-success" /> : <Icon className={`h-4 w-4 ${isActive ? "text-white" : ""}`} />}
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
        <div className="flex-1 flex items-start justify-center px-4 pb-8 lg:px-8 lg:items-center">
          <div className="w-full max-w-xl space-y-6">

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
                </CardContent>
              </Card>
            )}

            {/* Step 1: Geographic Focus */}
            {step === 1 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Where should we look?</CardTitle>
                  <CardDescription>Define the geographic area for lead discovery.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Select value={geographicFocus} onValueChange={setGeographicFocus}>
                      <SelectTrigger><SelectValue placeholder="Select a region" /></SelectTrigger>
                      <SelectContent>
                        {REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {geographicFocus === "Custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="customRegion">Specific cities or regions</Label>
                      <Input
                        id="customRegion"
                        value={customRegion}
                        onChange={(e) => setCustomRegion(e.target.value)}
                        placeholder="e.g. London, Manchester, Leeds"
                      />
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                      Your AI will discover leads within this area. You can always create additional campaigns for other regions.
                    </p>
                  </div>
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
                    <div className="grid grid-cols-4 gap-2">
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
                    {idealClient && <ReviewRow label="Ideal client" value={idealClient} onEdit={() => setStep(0)} />}
                    <ReviewRow label="Geography" value={geographicFocus === "Custom" ? customRegion : geographicFocus} onEdit={() => setStep(1)} />
                    <ReviewRow label="Channels" value={channels.map(c => CHANNELS.find(ch => ch.value === c)?.label).join(", ")} onEdit={() => setStep(2)} />
                    <ReviewRow label="Tone" value={TONE_OPTIONS.find(t => t.value === tone)?.label || tone} onEdit={() => setStep(2)} />
                    <ReviewRow label="Min score" value={minimumScore.toFixed(1)} onEdit={() => setStep(3)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => step === 0 ? navigate("/campaigns") : setStep(step - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
              </Button>

              {step < totalSteps - 1 ? (
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
