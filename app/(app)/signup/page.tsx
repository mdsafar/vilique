import AuthRequiredModal from "@/components/AuthRequiredModal";

type Props = {
    searchParams: Promise<{
        next?: string;
    }>;
};

export default async function SignupPage({ searchParams }: Props) {
    const { next = "/profile" } = await searchParams;
    const safeNext = next.startsWith("/") ? next : "/profile";

    return (
        <main className="profilePage">
            <AuthRequiredModal next={safeNext} forceOpen />
        </main>
    );
}
