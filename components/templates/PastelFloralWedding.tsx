"use client";

import { CSSProperties, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { MapPinned, Phone, CalendarOff, Clock } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import type { AnalyticsEventType } from "@/lib/analytics";
import { getEventPhase } from "@/lib/lifecycle";
import { parseInvitationDateParts } from "@/lib/invitationDate";
import { InvitationData, RSVPStatus } from "@/types/invitation";

type Props = {
    invitation: InvitationData;
    accepted?: boolean;
    rsvpStatus?: RSVPStatus | null;
    onAccept?: () => void;
    onDecline?: () => void;
    onChangeRsvp?: () => void;
    onEvent?: (eventType: AnalyticsEventType) => void;
    enableAudio?: boolean;
};

type CountdownValue = {
    days: string;
    hours: string;
    mins: string;
    secs: string;
};

type CelebrationParticle = {
    id: number;
    symbol: string;
    color: string;
    left: number;
    top: number;
    mx: number;
    my: number;
    scale: number;
    rotate: number;
    duration: number;
};

type FallingPetal = {
    id: number;
    symbol: string;
    color: string;
    left: number;
    size: number;
    opacity: number;
    duration: number;
    delay: number;
};

let activeTickAudio: HTMLAudioElement | null = null;
let activeSongAudio: HTMLAudioElement | null = null;

export default function PastelFloralWedding({
    invitation,
    accepted = false,
    rsvpStatus = null,
    onAccept,
    onDecline,
    onChangeRsvp,
    onEvent,
    enableAudio = false,
}: Props) {
    const [isAccepted, setIsAccepted] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [declineOpen, setDeclineOpen] = useState(false);
    const [particles, setParticles] = useState<CelebrationParticle[]>([]);
    const [petals, setPetals] = useState<FallingPetal[]>([]);
    const [isSongPlaying, setIsSongPlaying] = useState(false);
    const songRef = useRef<HTMLAudioElement>(null);
    const tickRef = useRef<HTMLAudioElement>(null);
    const songTimeoutRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    const audioSuspendedRef = useRef(false);
    const shouldPlayCountdownTickRef = useRef(false);
    const hasStartedTickRef = useRef(false);
    const pathname = usePathname();
    const isPublicRoute = useMemo(() => pathname?.startsWith("/i/") || pathname?.startsWith("/invite/"), [pathname]);
    const [isLoading, setIsLoadingState] = useState(isPublicRoute);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (!isPublicRoute) return;

        let isMounted = true;
        const fontPromise = typeof document !== "undefined" ? document.fonts.ready : Promise.resolve();
        const minTimePromise = new Promise((resolve) => setTimeout(resolve, 1200));

        Promise.all([fontPromise, minTimePromise]).then(() => {
            if (isMounted) {
                setIsExiting(true);
                setTimeout(() => {
                    if (isMounted) {
                        setIsLoadingState(false);
                    }
                }, 600);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [isPublicRoute]);
    useEffect(() => {
        if (!isPublicRoute) return;

        if (isLoading) {
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
        };
    }, [isLoading, isPublicRoute]);
    const eventDate = useMemo(
        () => parseEventDate(invitation.eventDate, invitation.eventTime, invitation.eventTimezone),
        [invitation.eventDate, invitation.eventTime, invitation.eventTimezone]
    );

    const eventParts = useMemo(
        () => formatEventParts(eventDate, invitation.eventTime, invitation.eventTimezone),
        [eventDate, invitation.eventTime, invitation.eventTimezone]
    );

    const { countdown, isStarted, now } = useCountdown(eventDate);
    const completed = useMemo(() => {
        return invitation.lifecycleStatus === 'completed' || getEventPhase({
            eventDate: invitation.eventDate,
            eventTime: invitation.eventTime,
            eventTimezone: invitation.eventTimezone,
        }, 0, new Date(now)) === "completed";
    }, [invitation.lifecycleStatus, invitation.eventDate, invitation.eventTime, invitation.eventTimezone, now]);
    const eventPhase = useMemo(() => {
        if (completed) return "completed";
        return getEventPhase({
            eventDate: invitation.eventDate,
            eventTime: invitation.eventTime,
            eventTimezone: invitation.eventTimezone,
        }, 0, new Date(now));
    }, [completed, invitation.eventDate, invitation.eventTime, invitation.eventTimezone, now]);
    const inProgress = eventPhase === "in_progress";

    const countdownTitle = useMemo(() => {
        const isWedding = invitation.category === "wedding";
        if (completed) return "EVENT COMPLETED";
        if (inProgress || isStarted) {
            return isWedding ? "WEDDING IN PROGRESS" : "EVENT IN PROGRESS";
        }
        return isWedding ? "COUNTDOWN TO WEDDING" : "COUNTDOWN TO EVENT";
    }, [completed, inProgress, isStarted, invitation.category]);

    const songUrl = enableAudio ? normalizeAudioUrl(invitation.musicUrl || invitation.defaultMusicUrl) : null;
    const shouldPlayCountdownTick = enableAudio && !completed && !inProgress && !isStarted;
    const tickUrl = shouldPlayCountdownTick ? normalizeAudioUrl(invitation.theme?.tickSoundUrl || invitation.tickSoundUrl || invitation.defaultTickSoundUrl) : null;

    const showAcceptedScreen = accepted || isAccepted;

    useEffect(() => {
        shouldPlayCountdownTickRef.current = shouldPlayCountdownTick;
        if (!shouldPlayCountdownTick) {
            stopAudio(tickRef.current);
            stopAudio(activeTickAudio);
            hasStartedTickRef.current = false;
        }
    }, [shouldPlayCountdownTick]);

    useEffect(() => {
        if (!accepted) {
            stopThisTemplateAudio();
            const frame = window.requestAnimationFrame(() => {
                setIsAccepted(false);
                setIsAccepting(false);
                setDeclineOpen(false);
                setParticles([]);
                setPetals([]);
            });
            return () => window.cancelAnimationFrame(frame);
        }
    }, [accepted]);

    function stopThisTemplateAudio(updateState = true) {
        if (songTimeoutRef.current) {
            window.clearTimeout(songTimeoutRef.current);
            songTimeoutRef.current = null;
        }
        stopAudio(songRef.current);
        stopAudio(tickRef.current);
        stopAudio(activeSongAudio);
        stopAudio(activeTickAudio);
        if (updateState && mountedRef.current) {
            setIsSongPlaying(false);
            hasStartedTickRef.current = false;
        }
    }

    useEffect(() => {
        mountedRef.current = true;
        const handlePageHide = () => stopThisTemplateAudio(false);
        const handlePreviewAudioStart = () => {
            audioSuspendedRef.current = true;
            stopThisTemplateAudio();
        };
        const handlePreviewAudioStop = () => {
            audioSuspendedRef.current = false;
        };
        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("vilique:sound-preview-start", handlePreviewAudioStart);
        window.addEventListener("vilique:sound-preview-stop", handlePreviewAudioStop);
        return () => {
            mountedRef.current = false;
            window.removeEventListener("pagehide", handlePageHide);
            window.removeEventListener("vilique:sound-preview-start", handlePreviewAudioStart);
            window.removeEventListener("vilique:sound-preview-stop", handlePreviewAudioStop);
            stopThisTemplateAudio(false);
        };
    }, [pathname]);

    useEffect(() => {
        if (!shouldPlayCountdownTick || !tickUrl || isSongPlaying) return;

        const startFromGesture = (event: Event) => {
            if (audioSuspendedRef.current || hasStartedTickRef.current || !shouldPlayCountdownTickRef.current) return;
            const target = event.target as Element | null;
            if (target?.closest(".rsvpAcceptBtn")) return;
            hasStartedTickRef.current = true;
            playTick(tickRef.current);
        };

        const gestureEvents = ["click", "touchend", "pointerup", "keydown"];
        gestureEvents.forEach((eventName) =>
            document.addEventListener(eventName, startFromGesture, { passive: true })
        );

        return () => {
            gestureEvents.forEach((eventName) =>
                document.removeEventListener(eventName, startFromGesture)
            );
        };
    }, [isSongPlaying, shouldPlayCountdownTick, tickUrl]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.hidden) {
                stopAudio(tickRef.current);
                return;
            }

            if (shouldPlayCountdownTick && hasStartedTickRef.current && !isSongPlaying) {
                playTick(tickRef.current);
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }, [isSongPlaying, shouldPlayCountdownTick]);

    function handleAccept(event: MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        const sparkleTarget = event.currentTarget.querySelector("b") ?? event.currentTarget;
        const targetRect = sparkleTarget.getBoundingClientRect();
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        const page = event.currentTarget.closest(".pastelWeddingPage") as HTMLElement | null;
        const pageTransform = page ? window.getComputedStyle(page).transform : "none";
        const pageRect = page?.getBoundingClientRect();
        const scaleX = page && pageRect ? pageRect.width / page.offsetWidth : 1;
        const scaleY = page && pageRect ? pageRect.height / page.offsetHeight : 1;
        const hasScaledPage = page && pageRect && pageTransform !== "none" && scaleX > 0 && scaleY > 0;
        const x = hasScaledPage ? (targetX - pageRect.left) / scaleX : targetX;
        const y = hasScaledPage ? (targetY - pageRect.top) / scaleY : targetY;

        setIsAccepting(true);
        createSparkles(x, y, setParticles);
        createPetals(setPetals);
        if (enableAudio) {
            const musicDuration = invitation.theme?.musicDuration ?? 20;
            if (songTimeoutRef.current) {
                window.clearTimeout(songTimeoutRef.current);
            }
            songTimeoutRef.current = playCelebrationSong(
                songRef.current,
                tickRef.current,
                (value) => {
                    if (mountedRef.current) {
                        setIsSongPlaying(value);
                    }
                },
                musicDuration,
                () => shouldPlayCountdownTickRef.current
            );
            onEvent?.("music_play");
        }

        window.setTimeout(() => {
            setIsAccepted(true);
            onAccept?.();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }, 700);

        window.setTimeout(() => setIsAccepting(false), 900);
    }

    function handleDecline() {
        setDeclineOpen(true);
        onDecline?.();
    }

    return (
        <>
            {isLoading && (
                <TemplateLoader
                    invitation={invitation}
                    isExiting={isExiting}
                />
            )}
            <section className={`pastelWeddingPage ${showAcceptedScreen ? "stateAccepted" : ""}`}>
            {songUrl ? <audio ref={songRef} src={songUrl} preload="auto" /> : null}
            {tickUrl ? <audio ref={tickRef} src={tickUrl} preload="auto" loop /> : null}

            <FloatingFlowers />
            <CelebrationLayer petals={petals} particles={particles} />

            <DeclineModal
                invitation={invitation}
                open={declineOpen}
                onClose={() => setDeclineOpen(false)}
            />

            <div className="weddingCardWrapper">
                {!showAcceptedScreen ? (
                    <InviteCard
                        invitation={invitation}
                        eventParts={eventParts}
                        countdown={countdown}
                        isAccepting={isAccepting}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                        rsvpStatus={rsvpStatus}
                        completed={completed}
                        inProgress={inProgress}
                        countdownTitle={countdownTitle}
                    />
                ) : (
                    <ThanksCard
                        invitation={invitation}
                        eventParts={eventParts}
                        countdown={countdown}
                        onEvent={onEvent}
                        onChangeRsvp={onChangeRsvp}
                        completed={completed}
                        inProgress={inProgress}
                        countdownTitle={countdownTitle}
                    />
                )}
            </div>
        </section>
    </>
);
}

function InviteCard({
    invitation,
    eventParts,
    countdown,
    isAccepting,
    onAccept,
    onDecline,
    rsvpStatus,
    completed,
    inProgress,
    countdownTitle,
}: {
    invitation: InvitationData;
    eventParts: ReturnType<typeof formatEventParts>;
    countdown: CountdownValue;
    isAccepting: boolean;
    onAccept: (event: MouseEvent<HTMLButtonElement>) => void;
    onDecline: () => void;
    rsvpStatus?: RSVPStatus | null;
    completed: boolean;
    inProgress: boolean;
    countdownTitle: string;
}) {
    return (
        <section className={`weddingCard inviteScreen active ${isAccepting ? "accepting" : ""} ${completed ? "completed" : ""}`}>
            <CardDecor />

            <p className="weddingTopText">WEDDING INVITATION</p>
            <div className="goldLine">❤</div>

            <h1 className="weddingNames">
                {invitation.primaryName} & {invitation.secondaryName}
            </h1>

            <p className="weddingSubText">TOGETHER WITH LOVE</p>
            <p className="weddingMessage">{invitation.message}</p>

            <div className="dateBox">
                <div>
                    <strong>{eventParts.month}</strong>
                    <span>{eventParts.year}, {eventParts.weekday}</span>
                </div>
                <b>{eventParts.day}</b>
                <div>
                    <strong>{eventParts.startTime}</strong>
                    <span>{eventParts.endTime}</span>
                </div>
            </div>

            <div className="venueBlock">
                <span>⌖</span>
                <h2>{invitation.venueName}</h2>
                <p>{invitation.venueAddress}</p>
            </div>

            <div className="goldLine dividerHeart">❤</div>
            <p className="countdownTitle">
                {countdownTitle}
            </p>
            {!completed && !inProgress ? <CountdownGrid countdown={countdown} /> : null}

            {inProgress ? (
                <EventInProgressMessage category={invitation.category} />
            ) : !completed ? (
                <>
                    <p className="rsvpTitle">WILL YOU ATTEND?</p>
                    {rsvpStatus === "declined" ? (
                        <div className="rsvpPersistedNotice rsvpPersistedNotice--declined">
                            <span>You&apos;ve declined this invitation.</span>
                        </div>
                    ) : null}
                    <div className={`rsvpButtons ${rsvpStatus === "declined" ? "rsvpButtons--single" : ""}`}>
                        <button className="rsvpAcceptBtn" onClick={onAccept}>
                            <span>{rsvpStatus === "declined" ? "Accept Instead" : "Accept"}</span>
                            <b>♡</b>
                        </button>
                        {rsvpStatus === "declined" ? null : (
                            <button className="rsvpDeclineBtn" onClick={onDecline}>
                                <span>Decline</span>
                                <b>♡</b>
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <EventClosedMessage />
            )}
            <WeddingBrandCredit />
        </section>
    );
}

function ThanksCard({
    invitation,
    eventParts,
    countdown,
    onEvent,
    onChangeRsvp,
    completed,
    inProgress,
    countdownTitle,
}: {
    invitation: InvitationData;
    eventParts: ReturnType<typeof formatEventParts>;
    countdown: CountdownValue;
    onEvent?: (eventType: AnalyticsEventType) => void;
    onChangeRsvp?: () => void;
    completed: boolean;
    inProgress: boolean;
    countdownTitle: string;
}) {
    return (
        <section className={`weddingCard thanksCard active ${completed ? "completed" : ""}`}>
            <CardDecor />

            <h1 className="thanksTitle">We Can&apos;t Wait!</h1>
            <div className="goldLine">❤</div>

            <p className="thanksName">
                {invitation.primaryName} & {invitation.secondaryName}
            </p>

            <div className="thanksBox">
                <span>&quot;</span>
                <p>Your RSVP has been received!<br />We look forward to celebrating with you.</p>
                <span>&quot;</span>
            </div>

            <div className="locationCard">
                <div>
                    <b>{eventParts.day}</b>
                    <span>{eventParts.monthShort}</span>
                    <small>WEDDING DAY<br />{eventParts.year}</small>
                </div>
                <div>
                    <h2>{invitation.venueName}</h2>
                    <p>{invitation.venueAddress}</p>
                    <a href={invitation.mapLink} target="_blank" rel="noreferrer" onClick={() => onEvent?.("map_click")}>
                        <MapPinned size={14} aria-hidden="true" />
                        GET DIRECTIONS
                    </a>
                </div>
            </div>

            {invitation.phone ? (
                <a className="phonePill" href={`tel:${invitation.phone}`} onClick={() => onEvent?.("call_click")}>
                    <Phone size={14} aria-hidden="true" />
                    {invitation.phone}
                </a>
            ) : null}

            <div className="goldLine dividerHeart">❤</div>
            <p className="countdownTitle">
                {countdownTitle}
            </p>
            {!completed && !inProgress ? <CountdownGrid countdown={countdown} /> : null}
            {completed ? <EventClosedMessage /> : inProgress ? <EventInProgressMessage category={invitation.category} /> : null}
            {!completed && !inProgress && onChangeRsvp ? (
                <button className="rsvpChangeBtn" type="button" onClick={onChangeRsvp}>
                    Change RSVP
                </button>
            ) : null}
            <WeddingBrandCredit />
        </section>
    );
}

function EventClosedMessage() {
    return (
        <div className="eventStateMessage rsvpCompletedMsg">
            <span className="eventStateIcon rsvpCompletedIcon" aria-hidden="true">
                <CalendarOff size={20} />
            </span>
            <p className="rsvpTitle">RSVP CLOSED</p>
            <p className="eventStateCopy rsvpCompletedSubText">This event has concluded. Thank you!</p>
        </div>
    );
}

function EventInProgressMessage({ category }: { category: string }) {
    const title = category === "wedding" ? "WEDDING STARTED" : "EVENT STARTED";
    const label = category === "wedding"
        ? "The wedding has started. Please join the celebration at the venue."
        : "The event has started. Please join the celebration at the venue.";

    return (
        <div className="eventStateMessage eventInProgressMessage">
            <span className="eventStateIcon eventInProgressIcon" aria-hidden="true">
                <Clock size={20} />
            </span>
            <p className="rsvpTitle">{title}</p>
            <p className="eventStateCopy">{label}</p>
        </div>
    );
}

function WeddingBrandCredit() {
    return (
        <p className="weddingBrandCredit">
            <Image src="/vilique-logo.png" alt="" aria-hidden="true" width={18} height={18} />
            <span>{siteConfig.creatorLabel}</span>
        </p>
    );
}

function CardDecor() {
    return (
        <>
            <div className="floral floralLeft" aria-hidden="true" />
            <div className="floral floralRight" aria-hidden="true" />
            <div className="cornerHeart" aria-hidden="true">♡</div>
        </>
    );
}

function CountdownGrid({ countdown }: { countdown: CountdownValue }) {
    return (
        <div className="countdownGrid">
            <TimeBox value={countdown.days} label="DAYS" />
            <TimeBox value={countdown.hours} label="HOURS" />
            <TimeBox value={countdown.mins} label="MINS" />
            <TimeBox value={countdown.secs} label="SECS" />
        </div>
    );
}

function TimeBox({ value, label }: { value: string; label: string }) {
    return (
        <div className="timeBox">
            <b suppressHydrationWarning>{value}</b>
            <span>{label}</span>
        </div>
    );
}

function FloatingFlowers() {
    return (
        <div className="floatingFlowers" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
                <span key={index}>✿</span>
            ))}
        </div>
    );
}

function CelebrationLayer({
    petals,
    particles,
}: {
    petals: FallingPetal[];
    particles: CelebrationParticle[];
}) {
    return (
        <div className="celebrationLayer" aria-hidden="true">
            {petals.map((petal) => (
                <span
                    className="petal"
                    key={petal.id}
                    style={{
                        left: `${petal.left}%`,
                        color: petal.color,
                        fontSize: `${petal.size}px`,
                        opacity: petal.opacity,
                        animationDuration: `${petal.duration}s`,
                        animationDelay: `${petal.delay}s`,
                    }}
                >
                    {petal.symbol}
                </span>
            ))}
            {particles.map((particle) => (
                <span
                    className="sparkleParticle"
                    key={particle.id}
                    style={{
                        left: `${particle.left}px`,
                        top: `${particle.top}px`,
                        color: particle.color,
                        animationDuration: `${particle.duration}s`,
                        "--mx": `${particle.mx}px`,
                        "--my": `${particle.my}px`,
                        "--ms": particle.scale,
                        "--mrot": `${particle.rotate}deg`,
                    } as CSSProperties}
                >
                    {particle.symbol}
                </span>
            ))}
        </div>
    );
}

function DeclineModal({
    invitation,
    open,
    onClose,
}: {
    invitation: InvitationData;
    open: boolean;
    onClose: () => void;
}) {
    if (!open) return null;

    return (
        <div className="declineModal active" onClick={onClose}>
            <div className="declineCard" onClick={(event) => event.stopPropagation()}>
                <div className="declineEmoji">💔</div>
                <h2>We&apos;ll Miss You</h2>
                <div className="goldLine">❤</div>
                <p>
                    We&apos;re sorry you can&apos;t make it.<br />
                    You&apos;ll always be in our hearts on this special day.
                </p>
                <span>— {invitation.primaryName} & {invitation.secondaryName}</span>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
}

function useCountdown(eventDate: Date) {
    const [now, setNow] = useState(() => Date.now());
    const eventTime = eventDate.getTime();

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, 500);

        return () => window.clearInterval(interval);
    }, [eventTime]);

    const countdown = getCountdown(eventDate, now);
    const isStarted = eventTime <= now;

    return { countdown, isStarted, now };
}

function getCountdown(eventDate: Date, now = Date.now()): CountdownValue {
    const distance = eventDate.getTime() - now;
    const days = Math.max(0, Math.floor(distance / (1000 * 60 * 60 * 24)));
    const hours = Math.max(0, Math.floor((distance / (1000 * 60 * 60)) % 24));
    const mins = Math.max(0, Math.floor((distance / (1000 * 60)) % 60));
    const secs = Math.max(0, Math.floor((distance / 1000) % 60));

    return {
        days: String(days).padStart(2, "0"),
        hours: String(hours).padStart(2, "0"),
        mins: String(mins).padStart(2, "0"),
        secs: String(secs).padStart(2, "0"),
    };
}

function getUtcTimeInTimezone(
    year: number,
    monthIndex: number,
    day: number,
    hours: number,
    minutes: number,
    timezone: string
): number {
    const localDate = new Date(year, monthIndex, day, hours, minutes, 0);
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
    });

    let guess = localDate.getTime();
    for (let i = 0; i < 3; i++) {
        const parts = formatter.formatToParts(new Date(guess));
        const pv = Object.fromEntries(parts.map((p) => [p.type, p.value]));

        const gYear = parseInt(pv.year, 10);
        const gMonth = parseInt(pv.month, 10) - 1;
        const gDay = parseInt(pv.day, 10);
        const gHour = parseInt(pv.hour, 10) % 24;
        const gMin = parseInt(pv.minute, 10);

        const actualLocal = new Date(year, monthIndex, day, hours, minutes, 0);
        const formatLocal = new Date(gYear, gMonth, gDay, gHour, gMin, 0);

        const diff = formatLocal.getTime() - actualLocal.getTime();
        if (diff === 0) break;
        guess -= diff;
    }
    return guess;
}

function parseEventDate(
    dateStr: string | null | undefined,
    timeStr: string | null | undefined,
    timezone: string = "Asia/Kolkata"
): Date {
    const dateParts = parseInvitationDateParts(dateStr);
    if (!dateParts) return new Date();
    const { year, month, day } = dateParts;

    let hours = 0;
    let minutes = 0;

    if (timeStr) {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (match) {
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const period = match[3]?.toUpperCase();

            if (period === "PM" && h < 12) h += 12;
            if (period === "AM" && h === 12) h = 0;

            hours = h;
            minutes = m;
        }
    }

    const utcMs = getUtcTimeInTimezone(year, month - 1, day, hours, minutes, timezone);
    return new Date(utcMs);
}

function formatEventParts(eventDate: Date, eventTime: string, timezone: string = "Asia/Kolkata") {
    const [startTime = "", endTime = ""] = eventTime.split("-").map((part) => part.trim());

    const formatter = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone });

    const day = formatter({ day: "2-digit" }).format(eventDate);
    const month = formatter({ month: "long" }).format(eventDate).toUpperCase();
    const monthShort = formatter({ month: "short" }).format(eventDate).toUpperCase();
    const weekday = formatter({ weekday: "long" }).format(eventDate);
    const year = formatter({ year: "numeric" }).format(eventDate);

    return {
        day,
        month,
        monthShort,
        weekday,
        year,
        startTime: startTime.replace(/\s+/g, " "),
        endTime: endTime ? `– ${endTime.replace(/\s+/g, " ")}` : "",
    };
}

function normalizeAudioUrl(url?: string) {
    const trimmed = url?.trim();
    return trimmed ? trimmed : null;
}

function playTick(audio: HTMLAudioElement | null) {
    if (!audio) return;
    if (activeSongAudio && !activeSongAudio.paused) return;
    if (activeTickAudio && activeTickAudio !== audio) {
        activeTickAudio.pause();
        activeTickAudio.currentTime = 0;
    }
    activeTickAudio = audio;
    audio.volume = 0.45;
    audio.loop = true;
    void audio.play().catch(() => undefined);
}

function stopAudio(audio: HTMLAudioElement | null) {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    if (activeTickAudio === audio) {
        activeTickAudio = null;
    }
    if (activeSongAudio === audio) {
        activeSongAudio = null;
    }
}

function playCelebrationSong(
    song: HTMLAudioElement | null,
    tick: HTMLAudioElement | null,
    setIsSongPlaying: (value: boolean) => void,
    musicDuration: number,
    shouldResumeTick: () => boolean
) {
    if (!song) return null;

    if (activeSongAudio && activeSongAudio !== song) {
        stopAudio(activeSongAudio);
    }
    activeSongAudio = song;
    stopAudio(activeTickAudio);
    stopAudio(tick);
    song.pause();
    song.currentTime = 0;
    song.volume = 0.35;
    setIsSongPlaying(true);

    void song.play().catch(() => {
        if (activeSongAudio !== song) return;
        setIsSongPlaying(false);
        if (shouldResumeTick()) {
            playTick(tick);
        }
    });

    if (musicDuration > 0) {
        return window.setTimeout(() => {
            if (activeSongAudio !== song) return;
            stopAudio(song);
            setIsSongPlaying(false);
            if (shouldResumeTick()) {
                playTick(tick);
            }
        }, musicDuration * 1000);
    }

    song.loop = true;
    return null;
}

function createPetals(setPetals: (value: FallingPetal[]) => void) {
    const symbols = ["❀", "✿", "❁", "♡", "✦"];
    const colors = ["#9b9aa5", "#b99aad", "#c9a96e", "#c07090", "#7c5fa0"];

    const nextPetals = Array.from({ length: 90 }).map((_, index) => ({
        id: Date.now() + index,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        left: Math.random() * 100,
        size: 14 + Math.random() * 18,
        opacity: 0.3 + Math.random() * 0.5,
        duration: 5 + Math.random() * 6,
        delay: Math.random() * 2.5,
    }));

    setPetals(nextPetals);
    window.setTimeout(() => setPetals([]), 14000);
}

function createSparkles(
    startX: number,
    startY: number,
    setParticles: (value: CelebrationParticle[]) => void
) {
    const colors = ["#c9a96e", "#e8cc94", "#7c5fa0", "#c49abf", "#e8a0b0", "#6aab94"];
    const shapes = ["✦", "✧", "★", "☆", "♡", "❤", "✨"];

    const nextParticles = Array.from({ length: 45 }).map((_, index) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 220;

        return {
            id: Date.now() + index,
            symbol: shapes[Math.floor(Math.random() * shapes.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            left: startX,
            top: startY,
            mx: Math.cos(angle) * distance,
            my: Math.sin(angle) * distance,
            scale: 0.5 + Math.random() * 1.5,
            rotate: Math.random() * 720 - 360,
            duration: 0.6 + Math.random() * 0.6,
        };
    });

    setParticles(nextParticles);
    window.setTimeout(() => setParticles([]), 1200);
}

function TemplateLoader({ invitation, isExiting }: { invitation: InvitationData; isExiting: boolean }) {
    const isWedding = invitation.category === "wedding";
    return (
        <div className={`templateLoaderOverlay pastelWeddingPage ${isExiting ? "exiting" : ""}`} aria-hidden="true">
            <div className="templateLoaderCard">
                <div className="templateLoaderRings">
                    <div className="ring1" />
                    <div className="ring2" />
                    <div className="heartCenter">❤</div>
                </div>
                
                <p className="loaderCoupleName">
                    {invitation.primaryName} {invitation.secondaryName ? `& ${invitation.secondaryName}` : ""}
                </p>
                
                <p className="loaderStatusText">
                    {isWedding ? "Opening Wedding Invitation" : "Opening Invitation"}
                </p>
                <div className="loaderLine" />
            </div>
        </div>
    );
}
