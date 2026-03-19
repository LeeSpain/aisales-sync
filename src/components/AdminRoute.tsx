import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading: authLoading } = useAuth();
    const { isAdmin, isLoading: roleLoading } = useRole();

    if (authLoading || roleLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
