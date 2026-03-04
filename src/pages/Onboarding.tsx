import { useState, useCallback, KeyboardEvent } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Globe, Building2, Package, Target, Award, Rocket, ChevronRight, ChevronLeft, X, Check } from "lucide-react";

const INDUSTRIES = [
  "Technology / SaaS", "Marketing / Advertising", "E-commerce / Retail",
  "Healthcare", "Finance / Insurance", "Real Estate", "Manufacturing",
  "Hospitality / Tourism", "Education", "Professional Services", "Other",
];

const REGIONS = ["United Kingdom", "Europe", "North America", "Asia Pacific", "Global", "Custom"];

const TONE_OPTIONS = [
  { value: "formal", label: "Formal", desc: "Corporate, traditional business tone" },
  { value: "professional", label: "Professional", desc: "Polished but approachable" },
  { value: "casual", label: "Casual", desc: "Relaxed, conversational style" },
  { value: "friendly", label: "Friendly", desc: "Warm, personable, relationship-first" },
];

const STEPS = [
  { icon: Globe, label: "Website" },
  { icon: Building2, label: "Business" },
  { icon: Package, label: "Services" },
  { icon: Target, label: "Markets" },
  { icon: Award, label: "USPs" },
  { icon: Rocket, label: "Launch" },
];

/** Reusable tag input component */
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
            <button onClick={() => onRemove(i)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
      />
      <p className="text-xs text-muted-foreground mt-1">Press Enter to add</p>
    </div>
  );
}

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [website, setWebsite] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [pricingSummary, setPricingSummary] = useState("");
  const [targetMarkets, setTargetMarkets] = useState<string[]>([]);
  const [geographicRange, setGeographicRange] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [sellingPoints, setSellingPoints] = useState<string[]>([]);
  const [tonePreference, setTonePreference] = useState("professional");

  const { data: profile } = useQuery({
    queryKey: ["profile-onboarding", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("company_id, companies(name)").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Pre-fill company name from profile
  useState(() => {
    if (profile?.companies && typeof profile.companies === "object" && "name" in profile.companies) {
      setCompanyName((profile.companies as { name: string }).name || "");
    }
  });

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const canNext = () => {
    switch (step) {
      case 0: return website.trim().length > 0;
      case 1: return companyName.trim().length > 0 && industry.length > 0;
      case 2: return services.length > 0;
      case 3: return targetMarkets.length > 0 && geographicRange.length > 0;
      case 4: return sellingPoints.length > 0;
      default: return true;
    }
  };

  const handleLaunch = async () => {
    if (!user || !profile?.company_id) return;
    setSaving(true);

    try {
      const geo = geographicRange === "Custom" ? customRegion : geographicRange;

      const { error: updateErr } = await supabase
        .from("companies")
        .update({
          name: companyName,
          website,
          industry,
          description,
          services: services as unknown as any,
          selling_points: sellingPoints as unknown as any,
          target_markets: targetMarkets as unknown as any,
          geographic_range: geo,
          pricing_summary: pricingSummary || null,
          tone_preference: tonePreference,
        })
        .eq("id", profile.company_id);

      if (updateErr) throw updateErr;

      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);

      toast({ title: "You're all set!", description: "Your AI sales team now knows your business." });
      navigate("/dashboard");
    } catch (e) {
      console.error("Onboarding save error:", e);
      toast({ title: "Error", description: "Could not save your profile. Please try again.", variant: "destructive" });
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">AI Sales Sync</span>
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
        </div>

        <p className="text-xs text-muted-foreground">
          Step {step + 1} of {totalSteps} — takes about 3 minutes
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile progress */}
        <div className="p-4 lg:p-6">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">AI Sales Sync</span>
            <span className="ml-auto text-xs text-muted-foreground">Step {step + 1}/{totalSteps}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Step content */}
        <div className="flex-1 flex items-start justify-center px-4 pb-8 lg:px-8 lg:items-center">
          <div className="w-full max-w-xl space-y-6">

            {/* Step 0: Website */}
            {step === 0 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">What's your company website?</CardTitle>
                  <CardDescription>We'll use this to understand your business, services, and positioning.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website URL</Label>
                    <Input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourcompany.com"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Don't have a website? No problem — just type your company name and we'll set you up manually.</p>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Business Profile */}
            {step === 1 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Tell us about your business</CardTitle>
                  <CardDescription>This helps your AI sales team represent you accurately.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company name</Label>
                    <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Ltd" />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((ind) => (
                          <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">What does your company do?</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="We help small businesses grow through digital marketing and lead generation..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Services */}
            {step === 2 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">What do you sell?</CardTitle>
                  <CardDescription>List your main services or products. Your AI will use these to craft targeted outreach.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Services / Products</Label>
                    <TagInput
                      tags={services}
                      onAdd={(t) => setServices([...services, t])}
                      onRemove={(i) => setServices(services.filter((_, idx) => idx !== i))}
                      placeholder="e.g. Web Design, SEO, PPC Management"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricing">Pricing overview (optional)</Label>
                    <Textarea
                      id="pricing"
                      value={pricingSummary}
                      onChange={(e) => setPricingSummary(e.target.value)}
                      placeholder="e.g. Packages from £500/month, custom enterprise pricing available"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Target Markets */}
            {step === 3 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Who are your dream clients?</CardTitle>
                  <CardDescription>Define who your AI should be finding and reaching out to.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target client types</Label>
                    <TagInput
                      tags={targetMarkets}
                      onAdd={(t) => setTargetMarkets([...targetMarkets, t])}
                      onRemove={(i) => setTargetMarkets(targetMarkets.filter((_, idx) => idx !== i))}
                      placeholder="e.g. E-commerce startups, SaaS founders, Restaurant owners"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Geographic range</Label>
                    <Select value={geographicRange} onValueChange={setGeographicRange}>
                      <SelectTrigger><SelectValue placeholder="Where do you want to find clients?" /></SelectTrigger>
                      <SelectContent>
                        {REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {geographicRange === "Custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="customRegion">Specific regions or cities</Label>
                      <Input
                        id="customRegion"
                        value={customRegion}
                        onChange={(e) => setCustomRegion(e.target.value)}
                        placeholder="e.g. London, Manchester, Birmingham"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 4: Differentiators */}
            {step === 4 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">What makes you different?</CardTitle>
                  <CardDescription>These selling points help your AI write compelling, personalized outreach.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Key selling points / USPs</Label>
                    <TagInput
                      tags={sellingPoints}
                      onAdd={(t) => setSellingPoints([...sellingPoints, t])}
                      onRemove={(i) => setSellingPoints(sellingPoints.filter((_, idx) => idx !== i))}
                      placeholder="e.g. 10+ years experience, Award-winning team, 98% client retention"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Outreach tone preference</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {TONE_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTonePreference(t.value)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            tonePreference === t.value
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Review & Launch */}
            {step === 5 && (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-xl">Review your profile</CardTitle>
                  <CardDescription>Everything look good? Your AI sales team will use this to find clients and run outreach.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <ReviewRow label="Website" value={website} onEdit={() => setStep(0)} />
                    <ReviewRow label="Company" value={`${companyName} — ${industry}`} onEdit={() => setStep(1)} />
                    {description && <ReviewRow label="Description" value={description} onEdit={() => setStep(1)} />}
                    <ReviewRow label="Services" value={services.join(", ")} onEdit={() => setStep(2)} />
                    {pricingSummary && <ReviewRow label="Pricing" value={pricingSummary} onEdit={() => setStep(2)} />}
                    <ReviewRow label="Target markets" value={targetMarkets.join(", ")} onEdit={() => setStep(3)} />
                    <ReviewRow label="Geography" value={geographicRange === "Custom" ? customRegion : geographicRange} onEdit={() => setStep(3)} />
                    <ReviewRow label="USPs" value={sellingPoints.join(", ")} onEdit={() => setStep(4)} />
                    <ReviewRow label="Tone" value={TONE_OPTIONS.find(t => t.value === tonePreference)?.label || tonePreference} onEdit={() => setStep(4)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep(step - 1)}
                disabled={step === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Back
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
                  disabled={saving}
                  className="gradient-primary border-0 text-white gap-2"
                >
                  {saving ? "Saving..." : (
                    <>
                      <Rocket className="h-4 w-4" /> Launch AI Sales Team
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

export default Onboarding;
