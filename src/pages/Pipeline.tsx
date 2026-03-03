import { Columns3 } from "lucide-react";

const Pipeline = () => {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-2">Deal Pipeline</h1>
            <p className="text-muted-foreground mb-6">Manage deals and track revenue</p>

            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
                <Columns3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Kanban board loading...</h3>
                <p className="text-sm text-muted-foreground">The AI deal pipeline is being configured for your workspace.</p>
            </div>
        </div>
    );
};

export default Pipeline;
