import Link from "next/link";
import type { Metadata } from "next";
import { CalendarHeart, MapPinned, Music2, Sparkles, Wand2 } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: {
    absolute: "Vilique",
  },
};

const features = [
  {
    icon: Sparkles,
    title: "Animated RSVP",
    text: "Accept screens, celebration petals, decline notes and guest-ready responses.",
  },
  {
    icon: Music2,
    title: "Music & Audio",
    text: "Add a celebration song, ambient ticking, and audio moments triggered by taps.",
  },
  {
    icon: MapPinned,
    title: "Venue Actions",
    text: "Directions, phone, WhatsApp and event details built for mobile guests.",
  },
  {
    icon: Wand2,
    title: "Editable Themes",
    text: "Change names, colors, dates, content and template mood inside the builder.",
  },
];

const stats = [
  ["10+", "template styles"],
  ["44px", "touch targets"],
  ["Mobile", "first builder"],
];

export default function HomePage() {
  return (
    <main className="page homePage">
      <section className="homeHero">
        <div className="homeHeroCopy">
          <AppLogo className="homeHeroLogo" size={42} />

          <p className="eyebrow">Premium invitation websites in minutes</p>

          <h1>Build animated invitations guests remember</h1>

          <p>
            Launch beautiful mobile invitation websites with RSVP, music,
            countdowns, venue actions and polished templates for every event.
          </p>

          <div className="heroActions">
            <Link className="primaryBtn" href="/templates">
              Browse Templates
            </Link>

            <Link className="secondaryBtn" href="/profile">
              My Invitations
            </Link>
          </div>

          <div className="homeStats" aria-label={`${siteConfig.name} highlights`}>
            {stats.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="heroPhonePreview" aria-label="Pastel Floral Wedding preview">
          <div className="heroPhoneCard">
            <div className="heroPhoneTop">
              <span>Wedding Invitation</span>
              <b>♡</b>
            </div>
            <h2>Maya & Arjun</h2>
            <p>Together with love</p>

            <div className="heroDateStrip">
              <span>FEB</span>
              <strong>14</strong>
              <span>5:30</span>
            </div>

            <div className="heroVenueMini">
              <CalendarHeart size={16} aria-hidden="true" />
              <div>
                <strong>Rose Garden Hall</strong>
                <span>Countdown, RSVP, map and music</span>
              </div>
            </div>

            <div className="heroRsvpMini">
              <span>Accept</span>
              <span>Decline</span>
            </div>
          </div>
        </div>
      </section>

      <section className="featureGrid">
        {features.map((item) => {
          const Icon = item.icon;

          return (
          <article className="featureCard" key={item.title}>
            <div className="featureIcon">
              <Icon size={22} aria-hidden="true" />
            </div>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </article>
          );
        })}
      </section>
    </main>
  );
}
