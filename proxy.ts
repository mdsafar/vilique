import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (pathname === "/templates" || pathname === "/templates/") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url, 308);
    }
    return updateSession(request);
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|mp3|wav|ogg|mp4)$|api/webhooks|api/payments/reconcile).*)",
    ],
};
