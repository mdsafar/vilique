import { redirect } from "next/navigation";

type Props = {
    searchParams: Promise<{
        next?: string;
    }>;
};

export default async function SignupPage({ searchParams }: Props) {
    const { next = "/profile" } = await searchParams;
    const safeNext = next.startsWith("/") ? next : "/profile";

    redirect(`/login?next=${encodeURIComponent(safeNext)}`);
}
