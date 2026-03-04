import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [flowState, setFlowState] = useState<{
    loading: boolean;
    hasSubscription: boolean;
    onboardingCompleted: boolean;
    isAdmin: boolean;
  }>({
    loading: true,
    hasSubscription: false,
    onboardingCompleted: false,
    isAdmin: false,
  });

  useEffect(() => {
    let mounted = true;

    // Reset to loading when route changes so we re-check flow state
    setFlowState((prev) => ({ ...prev, loading: true }));

    async function checkFlowState() {
      if (!user) {
        if (mounted) setFlowState((prev) => ({ ...prev, loading: false }));
        return;
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
          if (mounted) setFlowState({ loading: false, hasSubscription: true, onboardingCompleted: true, isAdmin: true });
          return;
        }

        // 2. Check profile for company_id and onboarding status
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id, onboarding_completed")
          .eq("id", user.id)
          .single();

        if (!profile?.company_id) {
          if (mounted) setFlowState({ loading: false, hasSubscription: false, onboardingCompleted: false, isAdmin: false });
          return;
        }

        // 3. Check for active/trial subscription
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("company_id", profile.company_id)
          .in("status", ["active", "trialing", "trial", "past_due"])
          .maybeSingle();

        if (mounted) {
          setFlowState({
            loading: false,
            hasSubscription: !!sub,
            onboardingCompleted: !!profile.onboarding_completed,
            isAdmin: false,
          });
        }
      } catch (error) {
        console.error("Error checking flow state:", error);
        if (mounted) setFlowState((prev) => ({ ...prev, loading: false }));
      }
    }

    if (!authLoading) {
      checkFlowState();
    }

    return () => {
      mounted = false;
    };
  }, [user, authLoading, location.pathname]);

  if (authLoading || flowState.loading) {
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
    if (!isOnboardingRoute && !isSelectPlanRoute) {
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
