import BottomNav from "@/components/BottomNav";
import { AppProviders } from "@/components/AppProviders";

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <AppProviders>
            {children}
            <BottomNav />
        </AppProviders>
    );
}
