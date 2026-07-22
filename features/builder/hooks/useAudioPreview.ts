"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

let activeSoundPreviewAudio:
    | HTMLAudioElement
    | null = null;

let activeSoundPreviewStop:
    | (() => void)
    | null = null;

function dispatchSoundPreviewState(
    isPlaying: boolean,
) {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(
        new Event(
            isPlaying
                ? "vilique:sound-preview-start"
                : "vilique:sound-preview-stop",
        ),
    );
}

export function stopActiveSoundPreview() {
    activeSoundPreviewStop?.();

    activeSoundPreviewAudio = null;
    activeSoundPreviewStop = null;

    dispatchSoundPreviewState(false);
}

export default function useAudioPreview(
    url: string | undefined,
) {
    const audioRef =
        useRef<HTMLAudioElement | null>(null);

    const [playing, setPlaying] =
        useState(false);

    const stopPreview = useCallback(() => {
        if (!audioRef.current) {
            return;
        }

        audioRef.current.pause();
        audioRef.current.currentTime = 0;

        if (
            activeSoundPreviewAudio ===
            audioRef.current
        ) {
            activeSoundPreviewAudio = null;
            activeSoundPreviewStop = null;
        }

        dispatchSoundPreviewState(false);
        setPlaying(false);
    }, []);

    useEffect(() => {
        return () => {
            if (
                activeSoundPreviewAudio ===
                audioRef.current
            ) {
                activeSoundPreviewAudio = null;
                activeSoundPreviewStop = null;
            }

            audioRef.current?.pause();
        };
    }, []);

    useEffect(() => {
        stopPreview();
    }, [stopPreview, url]);

    const toggle = useCallback(() => {
        if (!url) {
            return;
        }

        if (!audioRef.current) {
            audioRef.current = new Audio(url);
            audioRef.current.volume = 0.5;
            audioRef.current.onended =
                stopPreview;
        }

        if (playing) {
            stopPreview();
            return;
        }

        activeSoundPreviewStop?.();

        activeSoundPreviewAudio =
            audioRef.current;

        activeSoundPreviewStop =
            stopPreview;

        dispatchSoundPreviewState(true);

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = url;

        void audioRef.current
            .play()
            .then(() => {
                setPlaying(true);
            })
            .catch(() => {
                if (
                    activeSoundPreviewAudio ===
                    audioRef.current
                ) {
                    activeSoundPreviewAudio = null;
                    activeSoundPreviewStop = null;
                }

                dispatchSoundPreviewState(false);
                setPlaying(false);
            });
    }, [playing, stopPreview, url]);

    return {
        playing,
        toggle,
    };
}