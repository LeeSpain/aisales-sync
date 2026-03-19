import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Users, TrendingUp, UserCheck, Mail, Star,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Download,
  Plus, MoreHorizontal, Trash2, RefreshCw, Building2,
  Phone, Globe, ChevronLeft, ChevronRight, SlidersHorizontal,
  Target, Zap, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { leadStatusColors } from "@/lib/constants";
import { useLeads, ALL_STATUSES, STATUS_GROUPS } from "@/hooks/useLeads";
import type { SortField } from "@/hooks/useLeads";
import { useToast } from "@/hooks/use-toast";
import AddLeadDialog from "@/components/leads/AddLeadDialog";

const statusGroupLabels: Record<string, string> = {
  new: "New",
  active: "Active",
  engaged: "Engaged",
  closing: "Closing",
  won: "Won",
  lost: "Lost",
};

const Leads = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const {
    leads, totalCount, totalPages, page, stats, filterOptions,
    isLoading, filters, activeFilterCount, updateFilter, resetFilters,
    sortField, sortDir, toggleSort, setPage, selectedIds,
    toggleSelect, selectAll, deselectAll, updateStatus,
    bulkUpdateStatus, bulkDelete, exportCSV, isMutating,
  } = useLeads();

  const handleExport = async () => {
    const csv = await exportCSV();
    if (!csv) {
      toast({ title: "No data", description: "No leads match current filters.", variant: "destructive" });
      return;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${totalCount} leads exported to CSV.` });
  };

  const handleBulkStatus = (status: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    bulkUpdateStatus({ ids, status });
    toast({ title: "Updated", description: `${ids.length} lead(s) moved to ${status.replace(/_/g, " ")}.` });
  };

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    bulkDelete(ids);
    toast({ title: "Deleted", description: `${ids.length} lead(s) deleted.` });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="p-4 md:p-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground text-sm">
            {totalCount} lead{totalCount !== 1 ? "s" : ""} across all campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" className="gradient-primary border-0 text-white gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Lead
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 mb-6">
          <div className="card-glow rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="card-glow rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">New This Week</span>
            </div>
            <p className="text-2xl font-bold">{stats.newThisWeek}</p>
          </div>
          <div className="card-glow rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Qualified</span>
            </div>
            <p className="text-2xl font-bold">{stats.qualifiedCount}</p>
          </div>
          <div className="card-glow rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Avg Score</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgScore.toFixed(1)}</p>
          </div>
          <div className="card-glow rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">With Contact</span>
            </div>
            <p className="text-2xl font-bold">{stats.withContact}</p>
          </div>
          <div className="card-glow rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Converted</span>
            </div>
            <p className="text-2xl font-bold">{stats.convertedCount}</p>
          </div>
        </div>
      )}

      {/* ── Search + Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, industry, city..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter("search", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
            <RefreshCw className="h-3 w-3" /> Clear all
          </Button>
        )}
      </div>

      {/* ── Status Quick Filters ── */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => updateFilter("statuses", [])}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            filters.statuses.length === 0
              ? "gradient-primary text-white"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {Object.entries(STATUS_GROUPS).map(([group, statuses]) => {
          const isActive = statuses.every((s) => filters.statuses.includes(s));
          return (
            <button
              key={group}
              onClick={() => updateFilter("statuses", isActive ? [] : [...statuses])}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                isActive
                  ? "gradient-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {statusGroupLabels[group]}
              {stats?.byStatus && (
                <span className="ml-1 opacity-60">
                  ({statuses.reduce((sum, s) => sum + (stats.byStatus[s] || 0), 0)})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Advanced Filters Panel ── */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status multi-select */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
            <Select
              value={filters.statuses.length === 1 ? filters.statuses[0] : ""}
              onValueChange={(v) => updateFilter("statuses", v ? [v] : [])}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize text-xs">
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Industry */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Industry</label>
            <Select
              value={filters.industries.length === 1 ? filters.industries[0] : ""}
              onValueChange={(v) => updateFilter("industries", v ? [v] : [])}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Any industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {filterOptions?.industries.map((ind) => (
                  <SelectItem key={ind} value={ind} className="text-xs">{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Source</label>
            <Select
              value={filters.sources.length === 1 ? filters.sources[0] : ""}
              onValueChange={(v) => updateFilter("sources", v ? [v] : [])}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Any source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {filterOptions?.sources.map((src) => (
                  <SelectItem key={src} value={src} className="capitalize text-xs">
                    {src.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Country</label>
            <Select
              value={filters.country || ""}
              onValueChange={(v) => updateFilter("country", v || null)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Any country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {filterOptions?.countries.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Score range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Score</label>
            <Input
              type="number"
              min={0}
              max={5}
              step={0.5}
              placeholder="0"
              value={filters.scoreMin ?? ""}
              onChange={(e) => updateFilter("scoreMin", e.target.value ? Number(e.target.value) : null)}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Score</label>
            <Input
              type="number"
              min={0}
              max={5}
              step={0.5}
              placeholder="5"
              value={filters.scoreMax ?? ""}
              onChange={(e) => updateFilter("scoreMax", e.target.value ? Number(e.target.value) : null)}
              className="h-9 text-xs"
            />
          </div>

          {/* Date range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">From Date</label>
            <Input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(e) => updateFilter("dateFrom", e.target.value || null)}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To Date</label>
            <Input
              type="date"
              value={filters.dateTo || ""}
              onChange={(e) => updateFilter("dateTo", e.target.value || null)}
              className="h-9 text-xs"
            />
          </div>

          {/* Size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Business Size</label>
            <Select
              value={filters.sizeEstimate || ""}
              onValueChange={(v) => updateFilter("sizeEstimate", v || null)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Any size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                {filterOptions?.sizes.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={filters.hasContact === true}
                onCheckedChange={(v) => updateFilter("hasContact", v ? true : null)}
              />
              Has contact
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={filters.hasEmail === true}
                onCheckedChange={(v) => updateFilter("hasEmail", v ? true : null)}
              />
              Has email
            </label>
          </div>
        </div>
      )}

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  Move to <ArrowUpDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {ALL_STATUSES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleBulkStatus(s)} className="capitalize text-xs">
                    {s.replace(/_/g, " ")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-1.5 text-xs">
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Leads Table ── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : leads.length > 0 ? (
        <>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={selectedIds.size === leads.length && leads.length > 0}
                      onCheckedChange={(v) => (v ? selectAll() : deselectAll())}
                    />
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("score")}
                  >
                    <span className="flex items-center gap-1">Score <SortIcon field="score" /></span>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("business_name")}
                  >
                    <span className="flex items-center gap-1">Business <SortIcon field="business_name" /></span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">
                    Contact
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    Location
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    Source
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("status")}
                  >
                    <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden md:table-cell"
                    onClick={() => toggleSort("created_at")}
                  >
                    <span className="flex items-center gap-1">Added <SortIcon field="created_at" /></span>
                  </th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      selectedIds.has(lead.id) && "bg-primary/5"
                    )}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                        (lead.score ?? 0) >= 4 ? "bg-emerald-500/10 text-emerald-400" :
                        (lead.score ?? 0) >= 3 ? "bg-primary/10 text-primary" :
                        (lead.score ?? 0) >= 2 ? "bg-amber-500/10 text-amber-400" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {lead.score?.toFixed(1) || "\u2014"}
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 cursor-pointer"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <p className="text-sm font-medium hover:text-primary transition-colors">{lead.business_name}</p>
                      <p className="text-xs text-muted-foreground">{lead.industry}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {(lead.contact_name || lead.contact_email || lead.email) ? (
                        <div>
                          {lead.contact_name && (
                            <p className="text-xs font-medium flex items-center gap-1">
                              <UserCheck className="h-3 w-3 text-muted-foreground" />
                              {lead.contact_name}
                            </p>
                          )}
                          {(lead.contact_email || lead.email) && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" />
                              {lead.contact_email || lead.email}
                            </p>
                          )}
                          {(lead.contact_phone || lead.phone) && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {lead.contact_phone || lead.phone}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">No contact</span>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {[lead.city, lead.country].filter(Boolean).join(", ") || "\u2014"}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground capitalize">
                        {lead.source?.replace(/_/g, " ") || "\u2014"}
                      </span>
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.status || "discovered"}
                        onValueChange={(v) => updateStatus({ id: lead.id, status: v })}
                      >
                        <SelectTrigger className={cn(
                          "h-7 w-auto min-w-[100px] text-[10px] font-medium capitalize border-0 rounded-full px-2.5",
                          leadStatusColors[lead.status || ""] || "bg-muted text-muted-foreground"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize text-xs">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          {lead.website && (
                            <DropdownMenuItem onClick={() => window.open(lead.website as string, "_blank")}>
                              <Globe className="h-3.5 w-3.5 mr-2" /> Visit Website
                            </DropdownMenuItem>
                          )}
                          {(lead.email || lead.contact_email) && (
                            <DropdownMenuItem onClick={() => window.open(`mailto:${lead.contact_email || lead.email}`)}>
                              <Mail className="h-3.5 w-3.5 mr-2" /> Send Email
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Delete this lead?")) {
                                // Direct delete via supabase — deleteLead comes from the hook
                                updateStatus({ id: lead.id, status: "rejected" });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * 25) + 1}&ndash;{Math.min(page * 25, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {activeFilterCount > 0 ? "No leads match your filters" : "No leads found"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {activeFilterCount > 0
              ? "Try broadening your search or clearing filters."
              : "Leads will appear once your campaigns start discovering prospects, or add one manually."}
          </p>
          {activeFilterCount > 0 ? (
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Clear Filters
            </Button>
          ) : (
            <Button size="sm" className="gradient-primary border-0 text-white gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Your First Lead
            </Button>
          )}
        </div>
      )}

      {/* ── Add Lead Dialog ── */}
      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
};

export default Leads;
