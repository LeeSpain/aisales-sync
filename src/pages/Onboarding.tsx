import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TagInput } from "@/components/ui/tag-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Globe, Building2, Package, Target, Award, Rocket, ChevronRight, ChevronLeft, X, Check } from "lucide-react";

const INDUSTRIES = [
  "Technology / SaaS", "Marketing / Advertising", "E-commerce / Retail",
  "Healthcare", "Finance / Insurance", "Real Estate", "Manufacturing",
  "Hospitality / Tourism", "Education", "Professional Services", "Other",
];

const GEO_SCOPES = [
  { value: "local", label: "Local", desc: "Specific cities, towns, or postcodes" },
  { value: "regional", label: "Regional", desc: "Counties, states, or metro areas" },
  { value: "national", label: "National", desc: "One or more countries" },
  { value: "international", label: "International", desc: "Multiple countries or global" },
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

const INTERNATIONAL_REGIONS = [
  "Western Europe", "Eastern Europe", "Scandinavia", "North America",
  "Latin America", "Middle East", "Asia Pacific", "Africa", "Global",
];

const TONE_OPTIONS = [
  { value: "formal", label: "Formal", desc: "Corporate, traditional business tone" },
  { value: "professional", label: "Professional", desc: "Polished but approachable" },
  { value: "casual", label: "Casual", desc: "Relaxed, conversational style" },
  { value: "friendly", label: "Friendly", desc: "Warm, personable, relationship-first" },
];

const CONTACT_ROLES = [
  "Owner / Founder", "Director / MD", "Sales Manager", "Marketing Manager",
  "Operations Manager", "General Manager", "Consultant", "Other",
];

const STEPS = [
  { icon: Globe, label: "Website" },
  { icon: Building2, label: "Business" },
  { icon: Package, label: "Services" },
  { icon: Target, label: "Markets" },
  { icon: Award, label: "USPs" },
  { icon: Rocket, label: "Launch" },
];

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // Form state
  const [website, setWebsite] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [pricingSummary, setPricingSummary] = useState("");
  const [targetMarkets, setTargetMarkets] = useState<string[]>([]);
  const [geoScope, setGeoScope] = useState("");
  const [geoCountries, setGeoCountries] = useState<string[]>([]);
  const [geoRegions, setGeoRegions] = useState<string[]>([]);
  const [geoCities, setGeoCities] = useState<string[]>([]);
  const [sellingPoints, setSellingPoints] = useState<string[]>([]);
  const [tonePreference, setTonePreference] = useState("professional");
  const [outreachLanguages, setOutreachLanguages] = useState<string[]>(["English"]);

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile-onboarding", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("company_id, companies(name)").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    retry: 3,
  });

  // Pre-fill company name from profile
  useEffect(() => {
    if (profile?.companies && typeof profile.companies === "object" && "name" in profile.companies) {
      setCompanyName((profile.companies as { name: string }).name || "");
    }
  }, [profile]);

  // Refs to flush pending TagInput text before navigating
  const servicesFlushRef = useRef<(() => string) | null>(null);
  const marketsFlushRef = useRef<(() => string) | null>(null);
  const uspsFlushRef = useRef<(() => string) | null>(null);

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

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  /** Flush pending TagInput text, validate step, and advance — or show toast */
  const handleNext = () => {
    // Flush any pending text from the current TagInput (returns what was added)
    let flushed = "";
    if (step === 2) flushed = servicesFlushRef.current?.() ?? "";
    else if (step === 3) flushed = marketsFlushRef.current?.() ?? "";
    else if (step === 4) flushed = uspsFlushRef.current?.() ?? "";

    // Validate — for TagInput steps, count flushed value as already added
    let valid = true;
    switch (step) {
      case 0: valid = website.trim().length > 0; break;
      case 1: valid = companyName.trim().length > 0 && industry.length > 0; break;
      case 2: valid = services.length > 0 || flushed.length > 0; break;
      case 3: {
        const hasMarkets = targetMarkets.length > 0 || flushed.length > 0;
        const hasGeo = geoScope === "local" ? geoCountries.length > 0 && geoCities.length > 0
          : geoScope === "regional" ? geoCountries.length > 0 && geoRegions.length > 0
            : geoScope === "national" ? geoCountries.length > 0
              : geoScope === "international" ? geoRegions.length > 0
                : false;
        valid = hasMarkets && hasGeo;
        break;
      }
      case 4: valid = sellingPoints.length > 0 || flushed.length > 0; break;
    }

    if (!valid) {
      toast({ title: "Missing info", description: "Please complete the required fields before continuing.", variant: "destructive" });
      return;
    }

    setStep((s) => s + 1);
  };

  /** Visual hint: is the current step complete enough to enable the Next button? */
  const canNext = () => {
    switch (step) {
      case 0: return website.trim().length > 0;
      case 1: return companyName.trim().length > 0 && industry.length > 0;
      // TagInput steps: button is always enabled (handleNext does flush + validate)
      case 2: case 3: case 4: return true;
      default: return true;
    }
  };

  const handleLaunch = async () => {
    let companyId = profile?.company_id;

    // Fallback: if cached profile is missing company_id, try a fresh fetch
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in and try again.", variant: "destructive" });
      return;
    }
    if (!companyId) {
      const { data: fresh } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      companyId = fresh?.company_id;
      if (companyId) refetchProfile(); // update the cache for next time
    }
    if (!companyId) {
      toast({ title: "Something went wrong", description: "We couldn't find your company profile. Please refresh and try again.", variant: "destructive" });
      return;
    }
    setSaving(true);

    try {
      const geo = geoSummary();

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
          contact_name: contactName || null,
          contact_role: contactRole || null,
          outreach_languages: outreachLanguages.length > 0 ? outreachLanguages : ["English"],
        })
        .eq("id", companyId);

      if (updateErr) throw updateErr;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);

      if (profileErr) throw profileErr;

      // Log onboarding completion (non-blocking)
      supabase.from("activity_log").insert({
        company_id: companyId,
        action: "onboarding_completed",
        description: `${companyName} completed onboarding — ${industry}, targeting ${targetMarkets.join(", ")}`,
        metadata: { company_name: companyName, industry, services, target_markets: targetMarkets, geographic_range: geo },
      });

      // Invalidate the ProtectedRoute state so it allows navigation to dashboard
      await queryClient.invalidateQueries({ queryKey: ["flowState"] });

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
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-primary/10 text-primary font-medium" :
                      isDone ? "text-foreground cursor-pointer hover:bg-muted/50" :
                        "text-muted-foreground cursor-default"
                    }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? "gradient-primary" :
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
                    <Label htmlFor="website">Website URL or company name</Label>
                    <Input
                      id="website"
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourcompany.com"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">No website? Just type your company name and we'll set you up manually.</p>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Your name</Label>
                      <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. María García" />
                    </div>
                    <div className="space-y-2">
                      <Label>Your role</Label>
                      <Select value={contactRole} onValueChange={setContactRole}>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>
                          {CONTACT_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">The AI will use your name when reaching out on your behalf.</p>
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
                      flushRef={servicesFlushRef}
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
                      flushRef={marketsFlushRef}
                    />
                  </div>
                  {/* Scope selector */}
                  <div className="space-y-2">
                    <Label>Where do you want to find clients?</Label>
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
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${geoScope === s.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                            }`}
                        >
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
                        <Select value={geoCountries[0] || ""} onValueChange={(v) => setGeoCountries([v])}>
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
                              ? "e.g. Marbella, Ronda, Fuengirola, 29600"
                              : geoCountries[0] === "United Kingdom"
                              ? "e.g. Manchester, M1, Leeds, Sheffield S1"
                              : "e.g. Town name, city, or postcode"
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
                        <Select value={geoCountries[0] || ""} onValueChange={(v) => setGeoCountries([v])}>
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
                                className={`cursor-pointer transition-all ${geoRegions.includes(r) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"
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
                                className={`cursor-pointer transition-all ${geoRegions.includes(r) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"
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
                            placeholder="e.g. Andalusia, Catalonia, Bavaria, New South Wales"
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
                      <Select value="" onValueChange={(v) => { if (!geoCountries.includes(v)) setGeoCountries([...geoCountries, v]); }}>
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
                            className={`cursor-pointer transition-all ${geoRegions.includes(r) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"
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

                  {/* Contextual tip */}
                  {geoScope && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs text-muted-foreground">
                        {geoScope === "local" && "Perfect for targeting businesses on specific high streets, business parks, or neighbourhoods. Your AI will search for leads in these exact locations."}
                        {geoScope === "regional" && "Great for covering larger areas like counties or metro regions. Your AI will find businesses across the entire region."}
                        {geoScope === "national" && "Target businesses across entire countries. Best for products or services that aren't location-dependent."}
                        {geoScope === "international" && "Go global. Your AI will adapt outreach language and approach for each market."}
                      </p>
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
                      flushRef={uspsFlushRef}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Outreach language(s)</Label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => (
                        <Badge
                          key={lang}
                          variant={outreachLanguages.includes(lang) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${outreachLanguages.includes(lang) ? "bg-primary text-primary-foreground" : "hover:border-primary/50"}`}
                          onClick={() =>
                            setOutreachLanguages((prev) =>
                              prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                            )
                          }
                        >
                          {lang}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Select all languages your AI should use when contacting leads. For local businesses in Spain, select Spanish.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Outreach tone preference</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {TONE_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTonePreference(t.value)}
                          className={`rounded-xl border p-3 text-left transition-all ${tonePreference === t.value
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
                    {contactName && <ReviewRow label="Primary contact" value={`${contactName}${contactRole ? ` — ${contactRole}` : ""}`} onEdit={() => setStep(1)} />}
                    {description && <ReviewRow label="Description" value={description} onEdit={() => setStep(1)} />}
                    <ReviewRow label="Services" value={services.join(", ")} onEdit={() => setStep(2)} />
                    {pricingSummary && <ReviewRow label="Pricing" value={pricingSummary} onEdit={() => setStep(2)} />}
                    <ReviewRow label="Target markets" value={targetMarkets.join(", ")} onEdit={() => setStep(3)} />
                    <ReviewRow label="Geo scope" value={GEO_SCOPES.find(s => s.value === geoScope)?.label || geoScope} onEdit={() => setStep(3)} />
                    <ReviewRow label="Locations" value={geoSummary()} onEdit={() => setStep(3)} />
                    <ReviewRow label="USPs" value={sellingPoints.join(", ")} onEdit={() => setStep(4)} />
                    <ReviewRow label="Outreach language(s)" value={outreachLanguages.join(", ") || "English"} onEdit={() => setStep(4)} />
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
                  onClick={handleNext}
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
