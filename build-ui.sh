#!/bin/bash

set -e

echo "🎨 Construction de l'interface MediaHub..."

cd "$(dirname "$0")/frontend"

mkdir -p src/components/layout
mkdir -p src/components/dashboard
mkdir -p src/components/albums
mkdir -p src/components/media
mkdir -p src/pages
mkdir -p src/data
mkdir -p src/types

# ============================================================
# TYPES
# ============================================================

cat > src/types/media.ts <<'EOF'
export type MediaType = "photo" | "video";

export interface Media {
  id: number;
  title: string;
  type: MediaType;
  thumbnail: string;
  date: string;
  album?: string;
  duration?: string;
}

export interface Album {
  id: number;
  title: string;
  cover: string;
  count: number;
  date: string;
  location?: string;
}

export interface Activity {
  id: number;
  user: string;
  action: string;
  target: string;
  time: string;
  avatar: string;
}
EOF

# ============================================================
# MOCK DATA
# ============================================================

cat > src/data/mockData.ts <<'EOF'
import type { Activity, Album, Media } from "../types/media";

export const albums: Album[] = [
  {
    id: 1,
    title: "Vacances Espagne 2026",
    cover:
      "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=900&q=80",
    count: 312,
    date: "Août 2026",
    location: "Espagne",
  },
  {
    id: 2,
    title: "Anniversaire Thomas",
    cover:
      "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=80",
    count: 156,
    date: "Juillet 2026",
  },
  {
    id: 3,
    title: "Soirée chez nous",
    cover:
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=900&q=80",
    count: 98,
    date: "Juillet 2026",
  },
  {
    id: 4,
    title: "Road Trip Alpes",
    cover:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
    count: 124,
    date: "Juin 2026",
  },
  {
    id: 5,
    title: "Weekend Camping",
    cover:
      "https://images.unsplash.com/photo-1475483768296-6163e08872a1?auto=format&fit=crop&w=900&q=80",
    count: 67,
    date: "Mai 2026",
  },
];

export const media: Media[] = [
  {
    id: 1,
    title: "Plage",
    type: "photo",
    thumbnail:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=80",
    date: "22 août 2026",
    album: "Vacances Espagne 2026",
  },
  {
    id: 2,
    title: "Vacances",
    type: "photo",
    thumbnail:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80",
    date: "22 août 2026",
    album: "Vacances Espagne 2026",
  },
  {
    id: 3,
    title: "Road trip",
    type: "photo",
    thumbnail:
      "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80",
    date: "20 août 2026",
    album: "Vacances Espagne 2026",
  },
  {
    id: 4,
    title: "Soirée",
    type: "video",
    thumbnail:
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=700&q=80",
    date: "15 août 2026",
    album: "Soirée chez nous",
    duration: "00:42",
  },
  {
    id: 5,
    title: "Camping",
    type: "photo",
    thumbnail:
      "https://images.unsplash.com/photo-1478827536114-da961b7c8d5c?auto=format&fit=crop&w=700&q=80",
    date: "28 juillet 2026",
    album: "Weekend Camping",
  },
  {
    id: 6,
    title: "Amis",
    type: "photo",
    thumbnail:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=700&q=80",
    date: "28 juillet 2026",
    album: "Anniversaire Thomas",
  },
];

export const activities: Activity[] = [
  {
    id: 1,
    user: "Alex",
    action: "a ajouté",
    target: "24 photos dans Vacances Espagne 2026",
    time: "Il y a 2 h",
    avatar:
      "https://i.pravatar.cc/100?img=12",
  },
  {
    id: 2,
    user: "Sarah",
    action: "a ajouté",
    target: "une vidéo dans Soirée chez nous",
    time: "Il y a 5 h",
    avatar:
      "https://i.pravatar.cc/100?img=47",
  },
  {
    id: 3,
    user: "Lucas",
    action: "a aimé",
    target: "3 photos",
    time: "Il y a 1 jour",
    avatar:
      "https://i.pravatar.cc/100?img=33",
  },
  {
    id: 4,
    user: "Thomas",
    action: "a ajouté",
    target: "12 photos dans Anniversaire Thomas",
    time: "Il y a 1 jour",
    avatar:
      "https://i.pravatar.cc/100?img=11",
  },
];
EOF

# ============================================================
# SIDEBAR
# ============================================================

cat > src/components/layout/Sidebar.tsx <<'EOF'
import {
  Home,
  Image,
  Video,
  FolderOpen,
  Heart,
  Clock3,
  Share2,
  Users,
  Settings,
  HardDrive,
  Cloud,
} from "lucide-react";

interface SidebarProps {
  active: string;
  onNavigate: (page: string) => void;
}

const navigation = [
  { id: "Accueil", icon: Home },
  { id: "Photos", icon: Image },
  { id: "Vidéos", icon: Video },
  { id: "Albums", icon: FolderOpen },
  { id: "Favoris", icon: Heart },
  { id: "Timeline", icon: Clock3 },
  { id: "Partages", icon: Share2 },
  { id: "Groupes", icon: Users },
];

export default function Sidebar({
  active,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#0b0d12] px-4 py-5">
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-600/20">
          <Cloud size={20} />
        </div>

        <div>
          <h1 className="font-bold tracking-tight">MediaHub</h1>
          <p className="text-[10px] text-zinc-500">PRIVATE MEDIA CLOUD</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.id}
            </button>
          );
        })}
      </nav>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-violet-400" />
            <span className="text-xs text-zinc-400">
              Stockage utilisé
            </span>
          </div>

          <span className="text-xs font-semibold">62%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-[62%] rounded-full bg-violet-600" />
        </div>

        <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
          <span>1.24 To utilisés</span>
          <span>2 To</span>
        </div>
      </div>

      <button
        onClick={() => onNavigate("Paramètres")}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
      >
        <Settings size={18} />
        Paramètres
      </button>
    </aside>
  );
}
EOF

# ============================================================
# HEADER
# ============================================================

cat > src/components/layout/Header.tsx <<'EOF'
import {
  Bell,
  Search,
  Sun,
  Menu,
} from "lucide-react";

interface HeaderProps {
  onMenu?: () => void;
}

export default function Header({ onMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 bg-[#08090d]/90 px-4 backdrop-blur-xl lg:px-7">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="relative max-w-xl flex-1">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />

        <input
          type="text"
          placeholder="Rechercher des photos, vidéos, albums..."
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 focus:bg-white/[0.06]"
        />
      </div>

      <button className="hidden rounded-xl p-2.5 text-zinc-400 hover:bg-white/5 hover:text-white sm:block">
        <Sun size={19} />
      </button>

      <button className="relative rounded-xl p-2.5 text-zinc-400 hover:bg-white/5 hover:text-white">
        <Bell size={19} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500" />
      </button>

      <div className="flex items-center gap-2 border-l border-white/10 pl-3">
        <img
          src="https://i.pravatar.cc/100?img=68"
          alt="Kevin"
          className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
        />

        <div className="hidden xl:block">
          <p className="text-sm font-medium">Kevin</p>
          <p className="text-[10px] text-zinc-500">Administrateur</p>
        </div>
      </div>
    </header>
  );
}
EOF

# ============================================================
# MOBILE NAV
# ============================================================

cat > src/components/layout/MobileNav.tsx <<'EOF'
import {
  Home,
  Image,
  Plus,
  FolderOpen,
  User,
} from "lucide-react";

interface MobileNavProps {
  active: string;
  onNavigate: (page: string) => void;
  onUpload: () => void;
}

export default function MobileNav({
  active,
  onNavigate,
  onUpload,
}: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b0d12]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around">
        <button
          onClick={() => onNavigate("Accueil")}
          className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] ${
            active === "Accueil"
              ? "text-violet-400"
              : "text-zinc-500"
          }`}
        >
          <Home size={19} />
          Accueil
        </button>

        <button
          onClick={() => onNavigate("Photos")}
          className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] ${
            active === "Photos"
              ? "text-violet-400"
              : "text-zinc-500"
          }`}
        >
          <Image size={19} />
          Photos
        </button>

        <button
          onClick={onUpload}
          className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl shadow-violet-600/30"
        >
          <Plus size={25} />
        </button>

        <button
          onClick={() => onNavigate("Albums")}
          className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] ${
            active === "Albums"
              ? "text-violet-400"
              : "text-zinc-500"
          }`}
        >
          <FolderOpen size={19} />
          Albums
        </button>

        <button
          onClick={() => onNavigate("Profil")}
          className="flex flex-col items-center gap-1 px-3 py-1 text-[10px] text-zinc-500"
        >
          <User size={19} />
          Profil
        </button>
      </div>
    </nav>
  );
}
EOF

# ============================================================
# STAT CARD
# ============================================================

cat > src/components/dashboard/StatCard.tsx <<'EOF'
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  iconClass?: string;
}

export default function StatCard({
  icon: Icon,
  value,
  label,
  iconClass = "text-violet-400 bg-violet-500/10",
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={19} />
        </div>

        <div>
          <p className="text-xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
EOF

# ============================================================
# ALBUM CARD
# ============================================================

cat > src/components/albums/AlbumCard.tsx <<'EOF'
import { Image as ImageIcon } from "lucide-react";
import type { Album } from "../../types/media";

interface AlbumCardProps {
  album: Album;
}

export default function AlbumCard({ album }: AlbumCardProps) {
  return (
    <button className="group min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:bg-white/[0.05]">
      <div className="relative aspect-[1.35/1] overflow-hidden">
        <img
          src={album.cover}
          alt={album.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold backdrop-blur">
          {album.count}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-semibold">
          {album.title}
        </h3>

        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          <ImageIcon size={12} />
          {album.date}
        </div>
      </div>
    </button>
  );
}
EOF

# ============================================================
# TIMELINE
# ============================================================

cat > src/components/dashboard/TimelinePreview.tsx <<'EOF'
import { Play } from "lucide-react";
import { media } from "../../data/mockData";

export default function TimelinePreview() {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
            Souvenirs
          </p>
          <h2 className="mt-1 text-lg font-semibold">Timeline</h2>
        </div>

        <button className="text-xs font-medium text-zinc-400 hover:text-white">
          Voir tout
        </button>
      </div>

      <div className="space-y-6">
        {["22 août 2026", "20 août 2026", "15 août 2026"].map(
          (date, index) => {
            const items = media.slice(index * 2, index * 2 + 3);

            return (
              <div key={date}>
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-400">
                    {date}
                  </span>

                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900"
                    >
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />

                      {item.type === "video" && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-1 text-[10px] backdrop-blur">
                          <Play size={9} fill="white" />
                          {item.duration}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        )}
      </div>
    </section>
  );
}
EOF

# ============================================================
# ACTIVITY
# ============================================================

cat > src/components/dashboard/ActivityFeed.tsx <<'EOF'
import { activities } from "../../data/mockData";

export default function ActivityFeed() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold">Activité récente</h2>

        <button className="text-xs text-zinc-500 hover:text-white">
          Voir tout
        </button>
      </div>

      <div className="space-y-5">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-3">
            <img
              src={activity.avatar}
              alt={activity.user}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0">
              <p className="text-sm leading-5 text-zinc-300">
                <span className="font-medium text-white">
                  {activity.user}
                </span>{" "}
                {activity.action}{" "}
                <span className="text-zinc-400">
                  {activity.target}
                </span>
              </p>

              <p className="mt-1 text-[11px] text-zinc-600">
                {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
EOF

# ============================================================
# DASHBOARD
# ============================================================

cat > src/pages/Dashboard.tsx <<'EOF'
import {
  Image,
  Video,
  FolderOpen,
  Heart,
  Users,
} from "lucide-react";

import StatCard from "../components/dashboard/StatCard";
import AlbumCard from "../components/albums/AlbumCard";
import TimelinePreview from "../components/dashboard/TimelinePreview";
import ActivityFeed from "../components/dashboard/ActivityFeed";

import { albums } from "../data/mockData";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <section>
        <p className="mb-1 text-sm text-violet-400">
          Voici vos souvenirs
        </p>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Bonjour Kevin 👋
        </h1>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={Image}
          value="1 284"
          label="Photos"
        />

        <StatCard
          icon={Video}
          value="126"
          label="Vidéos"
          iconClass="bg-blue-500/10 text-blue-400"
        />

        <StatCard
          icon={FolderOpen}
          value="46"
          label="Albums"
          iconClass="bg-orange-500/10 text-orange-400"
        />

        <StatCard
          icon={Users}
          value="8"
          label="Groupes"
          iconClass="bg-pink-500/10 text-pink-400"
        />

        <StatCard
          icon={Heart}
          value="352"
          label="Favoris"
          iconClass="bg-red-500/10 text-red-400"
        />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Votre bibliothèque
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              Albums récents
            </h2>
          </div>

          <button className="text-xs text-zinc-400 hover:text-white">
            Voir tout
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <TimelinePreview />
        <ActivityFeed />
      </div>
    </div>
  );
}
EOF

# ============================================================
# PLACEHOLDER PAGES
# ============================================================

cat > src/pages/Placeholder.tsx <<'EOF'
interface PlaceholderProps {
  title: string;
}

export default function Placeholder({
  title,
}: PlaceholderProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-violet-600/10" />

        <h1 className="text-2xl font-bold">{title}</h1>

        <p className="mt-2 text-sm text-zinc-500">
          Cette section sera construite prochainement.
        </p>
      </div>
    </div>
  );
}
EOF

# ============================================================
# APP
# ============================================================

cat > src/App.tsx <<'EOF'
import { useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import MobileNav from "./components/layout/MobileNav";
import Dashboard from "./pages/Dashboard";
import Placeholder from "./pages/Placeholder";

const pages = [
  "Accueil",
  "Photos",
  "Vidéos",
  "Albums",
  "Favoris",
  "Timeline",
  "Partages",
  "Groupes",
  "Paramètres",
];

export default function App() {
  const [activePage, setActivePage] = useState("Accueil");
  const [uploadOpen, setUploadOpen] = useState(false);

  const renderPage = () => {
    if (activePage === "Accueil") {
      return <Dashboard />;
    }

    return <Placeholder title={activePage} />;
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="flex min-h-screen">
        <Sidebar
          active={activePage}
          onNavigate={setActivePage}
        />

        <div className="min-w-0 flex-1">
          <Header />

          <main className="px-4 pb-24 pt-7 sm:px-6 lg:px-8 lg:pb-10">
            <div className="mx-auto max-w-[1700px]">
              {renderPage()}
            </div>
          </main>
        </div>
      </div>

      <MobileNav
        active={activePage}
        onNavigate={setActivePage}
        onUpload={() => setUploadOpen(true)}
      />

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#11141b] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Ajouter des médias
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Photos et vidéos
                </p>
              </div>

              <button
                onClick={() => setUploadOpen(false)}
                className="rounded-xl px-3 py-2 text-zinc-500 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center transition hover:border-violet-500/50 hover:bg-violet-500/[0.03]">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
              />

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 text-2xl">
                ☁️
              </div>

              <p className="font-medium">
                Sélectionner des fichiers
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                JPG, PNG, WEBP, MP4, MOV, MKV...
              </p>
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setUploadOpen(false)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:bg-white/5"
              >
                Annuler
              </button>

              <button
                onClick={() => setUploadOpen(false)}
                className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-medium transition hover:bg-violet-500"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
EOF

# ============================================================
# GLOBAL CSS
# ============================================================

cat > src/index.css <<'EOF'
@import "tailwindcss";

:root {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color-scheme: dark;
  background: #08090d;
  color: #f5f5f5;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

html {
  background: #08090d;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

::selection {
  background: rgba(124, 58, 237, 0.4);
}
EOF

echo ""
echo "========================================"
echo "✅ Interface MediaHub construite !"
echo "========================================"
echo ""
echo "Lance maintenant :"
echo ""
echo "cd frontend"
echo "npm run dev"
echo ""
