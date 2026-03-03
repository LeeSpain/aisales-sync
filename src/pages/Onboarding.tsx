import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const Onboarding = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary">
          <Zap className="h-7 w-7 text-white" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">AI Onboarding Wizard</h1>
        <p className="mb-6 text-muted-foreground">
          Phase 2 will bring the conversational AI onboarding experience.
        </p>
        <Link to="/dashboard" className="text-sm text-primary hover:underline">
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
};

export default Onboarding;
