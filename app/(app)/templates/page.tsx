import TemplatesCatalog from "@/components/TemplatesCatalog";
import { getActiveTemplates } from "@/features/invitations/data";

export default async function TemplatesPage() {
    const templates = await getActiveTemplates();

    return (
        <main className="page templatesPage">
            <TemplatesCatalog templates={templates} />
        </main>
    );
}
