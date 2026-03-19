import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLeads } from "@/hooks/useLeads";
import { Building2, User, Mail, Phone, Globe, MapPin, Briefcase } from "lucide-react";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddLeadDialog = ({ open, onOpenChange }: AddLeadDialogProps) => {
  const { createLead, isCreating } = useLeads();
  const { toast } = useToast();

  const [form, setForm] = useState({
    business_name: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    city: "",
    country: "",
    contact_name: "",
    contact_email: "",
    contact_role: "",
    description: "",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.business_name.trim()) {
      toast({ title: "Required", description: "Business name is required.", variant: "destructive" });
      return;
    }

    try {
      await createLead({
        business_name: form.business_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        industry: form.industry.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        contact_name: form.contact_name.trim() || undefined,
        contact_email: form.contact_email.trim() || undefined,
        contact_role: form.contact_role.trim() || undefined,
        description: form.description.trim() || undefined,
        source: "manual",
        status: "discovered",
      });

      toast({ title: "Lead added", description: `${form.business_name} has been added.` });
      setForm({
        business_name: "", email: "", phone: "", website: "",
        industry: "", city: "", country: "", contact_name: "",
        contact_email: "", contact_role: "", description: "",
      });
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to create lead.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>Manually add a lead to your pipeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Business Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Business
            </h4>
            <div>
              <Label className="text-xs">Business Name *</Label>
              <Input
                value={form.business_name}
                onChange={(e) => update("business_name", e.target.value)}
                placeholder="Acme Corp"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Industry</Label>
                <Input
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                  placeholder="e.g. Healthcare"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="info@company.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+34 600 000 000"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Madrid"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  placeholder="Spain"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Contact Person
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Contact Name</Label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => update("contact_name", e.target.value)}
                  placeholder="John Doe"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Input
                  value={form.contact_role}
                  onChange={(e) => update("contact_role", e.target.value)}
                  placeholder="CEO"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Contact Email</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
                placeholder="john@company.com"
                className="mt-1"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="pt-2 border-t border-border">
            <Label className="text-xs">Description / Notes</Label>
            <Textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Any notes about this lead..."
              className="mt-1 min-h-[60px]"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="gradient-primary border-0 text-white"
              onClick={handleSubmit}
              disabled={isCreating}
            >
              {isCreating ? "Adding..." : "Add Lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
