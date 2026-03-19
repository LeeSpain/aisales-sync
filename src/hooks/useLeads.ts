import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | "discovered"
  | "researched"
  | "scored"
  | "qualified"
  | "outreach_pending"
  | "sequence_active"
  | "contacted"
  | "replied"
  | "in_conversation"
  | "call_scheduled"
  | "call_completed"
  | "meeting_booked"
  | "proposal_sent"
  | "negotiating"
  | "converted"
  | "rejected"
  | "unresponsive";

export const ALL_STATUSES: LeadStatus[] = [
  "discovered", "researched", "scored", "qualified",
  "outreach_pending", "sequence_active", "contacted", "replied",
  "in_conversation", "call_scheduled", "call_completed",
  "meeting_booked", "proposal_sent", "negotiating",
  "converted", "rejected", "unresponsive",
];

export const STATUS_GROUPS = {
  new: ["discovered", "researched", "scored"],
  active: ["qualified", "outreach_pending", "sequence_active", "contacted"],
  engaged: ["replied", "in_conversation", "call_scheduled", "call_completed"],
  closing: ["meeting_booked", "proposal_sent", "negotiating"],
  won: ["converted"],
  lost: ["rejected", "unresponsive"],
} as const;

export type SortField = "score" | "business_name" | "created_at" | "updated_at" | "status";
export type SortDirection = "asc" | "desc";

export interface LeadFilters {
  search: string;
  statuses: string[];
  industries: string[];
  sources: string[];
  scoreMin: number | null;
  scoreMax: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  sizeEstimate: string | null;
  hasContact: boolean | null;
  hasEmail: boolean | null;
  country: string | null;
}

export const DEFAULT_FILTERS: LeadFilters = {
  search: "",
  statuses: [],
  industries: [],
  sources: [],
  scoreMin: null,
  scoreMax: null,
  dateFrom: null,
  dateTo: null,
  sizeEstimate: null,
  hasContact: null,
  hasEmail: null,
  country: null,
};

export interface LeadStats {
  total: number;
  byStatus: Record<string, number>;
  avgScore: number;
  withContact: number;
  withEmail: number;
  newThisWeek: number;
  qualifiedCount: number;
  convertedCount: number;
}

const PAGE_SIZE = 25;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_FILTERS);
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Profile (company_id) ──
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_id, full_name")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const companyId = profile?.company_id;

  // ── Stats query (all leads, lightweight) ──
  const { data: stats } = useQuery<LeadStats>({
    queryKey: ["lead-stats", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, status, score, contact_name, contact_email, email, created_at")
        .eq("company_id", companyId!);

      if (error) throw error;
      const leads = data || [];

      const byStatus: Record<string, number> = {};
      let scoreSum = 0;
      let scoreCount = 0;
      let withContact = 0;
      let withEmail = 0;
      let newThisWeek = 0;
      let qualifiedCount = 0;
      let convertedCount = 0;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      for (const l of leads) {
        const s = l.status || "unknown";
        byStatus[s] = (byStatus[s] || 0) + 1;
        if (l.score != null) { scoreSum += l.score; scoreCount++; }
        if (l.contact_name || l.contact_email) withContact++;
        if (l.email || l.contact_email) withEmail++;
        if (new Date(l.created_at) >= weekAgo) newThisWeek++;
        if (s === "qualified") qualifiedCount++;
        if (s === "converted") convertedCount++;
      }

      return {
        total: leads.length,
        byStatus,
        avgScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
        withContact,
        withEmail,
        newThisWeek,
        qualifiedCount,
        convertedCount,
      };
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  // ── Filter options (unique industries, sources, countries) ──
  const { data: filterOptions } = useQuery({
    queryKey: ["lead-filter-options", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("industry, source, country, size_estimate")
        .eq("company_id", companyId!);

      const industries = new Set<string>();
      const sources = new Set<string>();
      const countries = new Set<string>();
      const sizes = new Set<string>();

      for (const l of data || []) {
        if (l.industry) industries.add(l.industry);
        if (l.source) sources.add(l.source);
        if (l.country) countries.add(l.country);
        if (l.size_estimate) sizes.add(l.size_estimate);
      }

      return {
        industries: [...industries].sort(),
        sources: [...sources].sort(),
        countries: [...countries].sort(),
        sizes: [...sizes].sort(),
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  // ── Main leads query with server-side filtering + pagination ──
  const { data: leadsData, isLoading, error } = useQuery({
    queryKey: ["leads", companyId, filters, sortField, sortDir, page],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .eq("company_id", companyId!);

      // Server-side search across multiple fields using OR
      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(
          `business_name.ilike.${term},email.ilike.${term},phone.ilike.${term},contact_name.ilike.${term},contact_email.ilike.${term},industry.ilike.${term},city.ilike.${term},country.ilike.${term},description.ilike.${term}`
        );
      }

      // Status filter
      if (filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }

      // Industry filter
      if (filters.industries.length > 0) {
        query = query.in("industry", filters.industries);
      }

      // Source filter
      if (filters.sources.length > 0) {
        query = query.in("source", filters.sources);
      }

      // Score range
      if (filters.scoreMin != null) {
        query = query.gte("score", filters.scoreMin);
      }
      if (filters.scoreMax != null) {
        query = query.lte("score", filters.scoreMax);
      }

      // Date range
      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59");
      }

      // Size estimate
      if (filters.sizeEstimate) {
        query = query.eq("size_estimate", filters.sizeEstimate);
      }

      // Has contact info
      if (filters.hasContact === true) {
        query = query.not("contact_name", "is", null);
      }

      // Has email
      if (filters.hasEmail === true) {
        query = query.or("email.not.is.null,contact_email.not.is.null");
      }

      // Country
      if (filters.country) {
        query = query.eq("country", filters.country);
      }

      // Sort
      const ascending = sortDir === "asc";
      query = query.order(sortField, { ascending, nullsFirst: false });

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return { leads: data || [], totalCount: count || 0 };
    },
    enabled: !!companyId,
    keepPreviousData: true,
  });

  const leads = leadsData?.leads || [];
  const totalCount = leadsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ── Active filter count ──
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.statuses.length) count++;
    if (filters.industries.length) count++;
    if (filters.sources.length) count++;
    if (filters.scoreMin != null) count++;
    if (filters.scoreMax != null) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.sizeEstimate) count++;
    if (filters.hasContact != null) count++;
    if (filters.hasEmail != null) count++;
    if (filters.country) count++;
    return count;
  }, [filters]);

  // ── Mutations ──

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (lead: {
      business_name: string;
      email?: string;
      phone?: string;
      contact_name?: string;
      contact_email?: string;
      contact_role?: string;
      industry?: string;
      city?: string;
      country?: string;
      website?: string;
      source?: string;
      status?: string;
      description?: string;
    }) => {
      const { error } = await supabase.from("leads").insert({
        ...lead,
        company_id: companyId!,
        status: lead.status || "discovered",
        source: lead.source || "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
      queryClient.invalidateQueries({ queryKey: ["lead-filter-options"] });
    },
  });

  // ── Selection helpers ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(leads.map((l) => l.id)));
  }, [leads]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Filter helpers ──
  const updateFilter = useCallback(<K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  // ── Sort helper ──
  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "business_name" ? "asc" : "desc");
    }
    setPage(1);
  }, [sortField]);

  // ── CSV export ──
  const exportCSV = useCallback(async () => {
    let query = supabase
      .from("leads")
      .select("business_name, email, phone, contact_name, contact_email, contact_phone, contact_role, industry, city, country, website, source, status, score, score_reasoning, size_estimate, description, created_at")
      .eq("company_id", companyId!);

    // Apply same filters as current view
    if (filters.statuses.length > 0) query = query.in("status", filters.statuses);
    if (filters.industries.length > 0) query = query.in("industry", filters.industries);
    if (filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(
        `business_name.ilike.${term},email.ilike.${term},contact_name.ilike.${term},industry.ilike.${term}`
      );
    }

    query = query.order(sortField, { ascending: sortDir === "asc" });

    const { data } = await query;
    if (!data || data.length === 0) return null;

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((h) => {
          const val = (row as Record<string, unknown>)[h];
          if (val == null) return "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
        }).join(",")
      ),
    ];

    return csvRows.join("\n");
  }, [companyId, filters, sortField, sortDir]);

  return {
    // Data
    leads,
    totalCount,
    totalPages,
    page,
    stats,
    filterOptions,
    isLoading,
    error,

    // Filters
    filters,
    activeFilterCount,
    updateFilter,
    resetFilters,
    setFilters,

    // Sort
    sortField,
    sortDir,
    toggleSort,

    // Pagination
    setPage,
    pageSize: PAGE_SIZE,

    // Selection
    selectedIds,
    toggleSelect,
    selectAll,
    deselectAll,

    // Mutations
    updateStatus: updateStatusMutation.mutate,
    bulkUpdateStatus: bulkUpdateStatusMutation.mutate,
    deleteLead: deleteLeadMutation.mutate,
    bulkDelete: bulkDeleteMutation.mutate,
    createLead: createLeadMutation.mutateAsync,
    isCreating: createLeadMutation.isPending,
    isMutating:
      updateStatusMutation.isPending ||
      bulkUpdateStatusMutation.isPending ||
      deleteLeadMutation.isPending ||
      bulkDeleteMutation.isPending,

    // Export
    exportCSV,

    // Company
    companyId,
  };
}
