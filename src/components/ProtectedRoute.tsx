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
  }>({
    loading: true,
    hasSubscription: false,
    onboardingCompleted: false,
  });

  useEffect(() => {
    let mounted = true;

    async function checkFlowState() {
      if (!user) {
        if (mounted) setFlowState((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        // 1. Check profile for company_id and onboarding status
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id, onboarding_completed")
          .eq("id", user.id)
          .single();

        if (!profile?.company_id) {
          if (mounted) setFlowState({ loading: false, hasSubscription: false, onboardingCompleted: false });
          return;
        }

        // 2. Check for active/trial subscription
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("company_id", profile.company_id)
          .in("status", ["active", "trial", "past_due"])
          .maybeSingle();

        if (mounted) {
          setFlowState({
            loading: false,
            hasSubscription: !!sub,
            onboardingCompleted: !!profile.onboarding_completed,
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
  }, [user, authLoading]);

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

  // Handle flow gating
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
