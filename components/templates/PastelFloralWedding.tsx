"use client";

import { CSSProperties, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { MapPinned, Phone } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import { InvitationData } from "@/types/invitation";

type Props = {
    invitation: InvitationData;
    accepted?: boolean;
    onAccept?: () => void;
    onDecline?: () => void;
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

const songPlaySeconds = 20;

export default function PastelFloralWedding({
    invitation,
    accepted = false,
    onAccept,
    onDecline,
}: Props) {
    const [isAccepted, setIsAccepted] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [declineOpen, setDeclineOpen] = useState(false);
    const [particles, setParticles] = useState<CelebrationParticle[]>([]);
    const [petals, setPetals] = useState<FallingPetal[]>([]);
    const [hasStartedTick, setHasStartedTick] = useState(false);
    const [isSongPlaying, setIsSongPlaying] = useState(false);
    const songRef = useRef<HTMLAudioElement>(null);
    const tickRef = useRef<HTMLAudioElement>(null);

    const eventDate = useMemo(
        () => parseEventDate(invitation.eventDate, invitation.eventTime),
        [invitation.eventDate, invitation.eventTime]
    );

    const eventParts = useMemo(
        () => formatEventParts(eventDate, invitation.eventTime),
        [eventDate, invitation.eventTime]
    );

    const countdown = useCountdown(eventDate);
    const songUrl = normalizeAudioUrl(invitation.musicUrl);
    const tickUrl = normalizeAudioUrl(invitation.tickSoundUrl);

    const showAcceptedScreen = accepted || isAccepted;

    useEffect(() => {
        const song = songRef.current;
        const tick = tickRef.current;

        return () => {
            stopAudio(song);
            stopAudio(tick);
        };
    }, []);

    useEffect(() => {
        if (!tickUrl || hasStartedTick || isSongPlaying) return;

        const startFromGesture = (event: Event) => {
            const target = event.target as Element | null;
            if (target?.closest(".rsvpAcceptBtn")) return;
            setHasStartedTick(true);
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
    }, [hasStartedTick, isSongPlaying, tickUrl]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.hidden) {
                stopAudio(tickRef.current);
                return;
            }

            if (hasStartedTick && !isSongPlaying) {
                playTick(tickRef.current);
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }, [hasStartedTick, isSongPlaying]);

    function handleAccept(event: MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX || rect.left + rect.width / 2;
        const y = event.clientY || rect.top + rect.height / 2;

        setIsAccepting(true);
        createSparkles(x, y, setParticles);
        createPetals(setPetals);
        playCelebrationSong(songRef.current, tickRef.current, setIsSongPlaying);

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
                    />
                ) : (
                    <ThanksCard
                        invitation={invitation}
                        eventParts={eventParts}
                        countdown={countdown}
                    />
                )}
            </div>
        </section>
    );
}

function InviteCard({
    invitation,
    eventParts,
    countdown,
    isAccepting,
    onAccept,
    onDecline,
}: {
    invitation: InvitationData;
    eventParts: ReturnType<typeof formatEventParts>;
    countdown: CountdownValue;
    isAccepting: boolean;
    onAccept: (event: MouseEvent<HTMLButtonElement>) => void;
    onDecline: () => void;
}) {
    return (
        <section className={`weddingCard inviteScreen active ${isAccepting ? "accepting" : ""}`}>
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
            <p className="countdownTitle">COUNTDOWN TO WEDDING</p>
            <CountdownGrid countdown={countdown} />

            <p className="rsvpTitle">WILL YOU ATTEND?</p>
            <div className="rsvpButtons">
                <button className="rsvpAcceptBtn" onClick={onAccept}>
                    <span>Accept</span>
                    <b>♡</b>
                </button>
                <button className="rsvpDeclineBtn" onClick={onDecline}>
                    <span>Decline</span>
                    <b>♡</b>
                </button>
            </div>
            <p className="weddingBrandCredit">{siteConfig.creatorLabel}</p>
        </section>
    );
}

function ThanksCard({
    invitation,
    eventParts,
    countdown,
}: {
    invitation: InvitationData;
    eventParts: ReturnType<typeof formatEventParts>;
    countdown: CountdownValue;
}) {
    return (
        <section className="weddingCard thanksCard active">
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
                    <a href={invitation.mapLink} target="_blank" rel="noreferrer">
                        <MapPinned size={14} aria-hidden="true" />
                        GET DIRECTIONS
                    </a>
                </div>
            </div>

            {invitation.phone ? (
                <a className="phonePill" href={`tel:${invitation.phone}`}>
                    <Phone size={14} aria-hidden="true" />
                    {invitation.phone}
                </a>
            ) : null}

            <div className="goldLine dividerHeart">❤</div>
            <p className="countdownTitle">COUNTDOWN TO WEDDING</p>
            <CountdownGrid countdown={countdown} />
            <p className="weddingBrandCredit">{siteConfig.creatorLabel}</p>
        </section>
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
            <b>{value}</b>
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

function useCountdown(eventDate: Date): CountdownValue {
    const [now, setNow] = useState(eventDate.getTime());

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, 250);

        return () => window.clearInterval(interval);
    }, []);

    return getCountdown(eventDate, now);
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

function parseEventDate(date: string, time: string) {
    const startTime = time.match(/\d{1,2}:\d{2}\s*(AM|PM)?/i)?.[0] || "00:00";
    return new Date(`${date} ${startTime}`);
}

function formatEventParts(eventDate: Date, eventTime: string) {
    const [startTime = "", endTime = ""] = eventTime.split("-").map((part) => part.trim());

    return {
        day: String(eventDate.getDate()).padStart(2, "0"),
        month: eventDate.toLocaleString("en", { month: "long" }).toUpperCase(),
        monthShort: eventDate.toLocaleString("en", { month: "short" }).toUpperCase(),
        weekday: eventDate.toLocaleString("en", { weekday: "long" }),
        year: String(eventDate.getFullYear()),
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
    audio.volume = 0.45;
    audio.loop = true;
    void audio.play().catch(() => undefined);
}

function stopAudio(audio: HTMLAudioElement | null) {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
}

function playCelebrationSong(
    song: HTMLAudioElement | null,
    tick: HTMLAudioElement | null,
    setIsSongPlaying: (value: boolean) => void
) {
    if (!song) return;

    stopAudio(tick);
    song.pause();
    song.currentTime = 0;
    song.volume = 0.35;
    setIsSongPlaying(true);

    void song.play().catch(() => {
        setIsSongPlaying(false);
        playTick(tick);
    });

    window.setTimeout(() => {
        stopAudio(song);
        setIsSongPlaying(false);
        playTick(tick);
    }, songPlaySeconds * 1000);
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
