import { InvitationData } from "@/types/invitation";

export interface ProfileDataChangedDetail {
    invitation?: InvitationData;
    previous?: InvitationData | null;
    deletedInvitation?: InvitationData;
}

export function notifyProfileDataChanged(detail?: ProfileDataChangedDetail) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<ProfileDataChangedDetail>("vilique:profile-data-changed", {
            detail,
        })
    );
}
