import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const Setup = () => {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSetup = async () => {
    setStatus("running");
    setLog([]);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("seed-users");

      if (fnErr) {
        setError(fnErr.message);
        setStatus("error");
        return;
      }

      if (data?.success) {
        setLog(data.log || ["Setup completed successfully."]);
        setStatus("done");
      } else {
        setError(data?.error || "Unknown error");
        setStatus("error");
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Media Sync — Account Setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Creates two test accounts with full dashboard access
          </p>
        </div>

        {/* Account cards */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Super Admin</p>
                <p className="text-xs text-muted-foreground">leewakeman@hotmail.co.uk / test1234</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                /admin dashboard
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Client Admin</p>
                <p className="text-xs text-muted-foreground">test@tes.com / test1234</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                /dashboard
              </span>
            </div>
          </div>
        </div>

        {/* Run button */}
        <Button
          className="w-full gradient-primary border-0 text-white gap-2"
          onClick={runSetup}
          disabled={status === "running"}
        >
          {status === "running" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up accounts...
            </>
          ) : status === "done" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Setup Complete — Run Again?
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Create Both Accounts
            </>
          )}
        </Button>

        {/* Log output */}
        {log.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">Success</p>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {log.join("\n")}
            </pre>
          </div>
        )}

        {/* Error output */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <p className="text-sm font-semibold text-red-400">Error</p>
            </div>
            <p className="text-xs text-red-300 font-mono">{error}</p>
          </div>
        )}

        {/* Post-setup instructions */}
        {status === "done" && (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Go to <a href="/login" className="text-primary underline">/login</a> and sign in with either account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;
