import { FileText } from "lucide-react";

const Proposals = () => {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-2">Proposals</h1>
            <p className="text-muted-foreground mb-6">AI-generated commercial proposals</p>

            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No proposals yet</h3>
                <p className="text-sm text-muted-foreground">The AI will draft commercial proposals based on qualified deals.</p>
            </div>
        </div>
    );
};

export default Proposals;
