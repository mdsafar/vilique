export const globalAudioDefaults = {
    tickSoundUrl: "https://ircfiebqcmunsqdroxdl.supabase.co/storage/v1/object/public/template-assets/pastel-floral-wedding/tick-tock.mp3",
} as const;

export const templateAudioDefaults: Record<
    string,
    {
        musicUrl?: string;
        tickSoundUrl?: string;
    }
> = {
    "pastel-floral-wedding": {
        musicUrl: "https://ircfiebqcmunsqdroxdl.supabase.co/storage/v1/object/public/template-assets/pastel-floral-wedding/celebration-song.mp3",
        tickSoundUrl: globalAudioDefaults.tickSoundUrl,
    },
};

export function getTemplateAudioDefaults(templateId: string) {
    return {
        tickSoundUrl: globalAudioDefaults.tickSoundUrl,
        ...(templateAudioDefaults[templateId] || {}),
    };
}
