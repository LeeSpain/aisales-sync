import { BarChart3 } from "lucide-react";

const Reports = () => {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-2">Weekly Reports</h1>
            <p className="text-muted-foreground mb-6">AI performance analysis and strategic guidance</p>

            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No reports gathered</h3>
                <p className="text-sm text-muted-foreground">The AI will produce strategy summaries at the end of the week.</p>
            </div>
        </div>
    );
};

export default Reports;
