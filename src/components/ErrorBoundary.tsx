import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[AI Sales Sync] Runtime error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0a0b0f",
                    color: "#f1f1f4",
                    fontFamily: "system-ui, sans-serif",
                    padding: "2rem",
                }}>
                    <div style={{ maxWidth: 480, textAlign: "center" }}>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                            Something went wrong
                        </h1>
                        <p style={{ color: "#8b8ca0", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                            {this.state.error?.message || "An unexpected error occurred."}
                        </p>
                        <p style={{ color: "#5a5b6e", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
                            If this persists, check that your environment variables are set correctly
                            (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY).
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
                                color: "white",
                                border: "none",
                                padding: "0.625rem 1.5rem",
                                borderRadius: "0.75rem",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
