import BottomNav from "@/components/BottomNav";

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            {children}
            <BottomNav />
        </>
    );
}
