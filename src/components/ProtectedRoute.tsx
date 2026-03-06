import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const { data: flowState = { loading: true, hasSubscription: false, onboardingCompleted: false, isAdmin: false }, isLoading: queryLoading } = useQuery({
    queryKey: ["flowState", user?.id],
    queryFn: async () => {
      if (!user) {
        return { loading: false, hasSubscription: false, onboardingCompleted: false, isAdmin: false };
      }

      try {
        // 1. Check if user is admin
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const isAdmin = roles?.some((r) => r.role === "admin") || false;

        // Admins skip subscription/onboarding checks
        if (isAdmin) {
          return { loading: false, hasSubscription: true, onboardingCompleted: true, isAdmin: true };
        }

        // 2. Check profile for company_id and onboarding status
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id, onboarding_completed")
          .eq("id", user.id)
          .single();

        if (!profile?.company_id) {
          return { loading: false, hasSubscription: false, onboardingCompleted: false, isAdmin: false };
        }

        // 3. Check for active/trial subscription
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("company_id", profile.company_id)
          .in("status", ["active", "trialing", "trial", "past_due"])
          .maybeSingle();

        return {
          loading: false,
          hasSubscription: !!sub,
          onboardingCompleted: !!profile.onboarding_completed,
          isAdmin: false,
        };
      } catch (error) {
        console.error("Error checking flow state:", error);
        return { loading: false, hasSubscription: false, onboardingCompleted: false, isAdmin: false };
      }
    },
    enabled: !authLoading && !!user,
  });

  if (authLoading || queryLoading || flowState.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admins bypass subscription/onboarding flow entirely
  if (flowState.isAdmin) {
    return <>{children}</>;
  }

  // Handle flow gating for regular users
  const isSelectPlanRoute = location.pathname === "/select-plan";
  const isOnboardingRoute = location.pathname === "/onboarding";

  // If no subscription, FORCE them to /select-plan
  if (!flowState.hasSubscription) {
    if (!isSelectPlanRoute) {
      return <Navigate to="/select-plan" replace />;
    }
    return <>{children}</>;
  }

  // If they have a subscription but haven't finished onboarding, FORCE them to /onboarding
  if (!flowState.onboardingCompleted) {
    if (!isOnboardingRoute) {
      return <Navigate to="/onboarding" replace />;
    }
    return <>{children}</>;
  }

  // If they finished onboarding, block them from going BACK to select-plan or onboarding
  if (isSelectPlanRoute || isOnboardingRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
