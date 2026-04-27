/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Sword, 
  Shield, 
  Zap, 
  Trophy, 
  User, 
  LogOut, 
  LogIn,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  Menu,
  X,
  Plus,
  Trash2,
  Database,
  Star,
  ExternalLink,
  Crown,
  Info,
  Globe,
  Settings,
  ArrowRight,
  Sparkles,
  Award,
  Flame,
  Target,
  Dna,
  Heart,
  Hammer,
  FlaskConical,
  TrendingUp,
  History,
  ThumbsUp,
  ThumbsDown,
  Users,
  Activity as ActivityIcon,
  Medal
} from 'lucide-react';
import { SkinViewer, WalkingAnimation, RunningAnimation, IdleAnimation, FlyingAnimation } from 'skinview3d';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from './firebase';
import { cn } from './lib/utils';

// --- Types ---
interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  order: number;
}

interface Tier {
  id: string;
  name: string;
  color: string;
  order: number;
  points: number;
}

interface Player {
  id: string;
  name: string;
  uuid: string;
  skinUrl: string;
  pose?: string;
  rankings: Record<string, string>; // categoryId -> tierId
  badges?: string[];
  history?: { date: string; points: number }[];
  votes?: { up: number; down: number };
}

interface Activity {
  id: string;
  playerId: string;
  playerName: string;
  type: 'rank_up' | 'rank_down' | 'new_player' | 'badge_earned';
  details: string;
  timestamp: any;
}

interface Badge {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

// --- Constants ---
const LOGO_URL = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/netherite_upgrade_smithing_template.png";

const CATEGORY_ICONS: Record<string, string> = {
  cpvp: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/end_crystal.png",
  uhc: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/golden_apple.png",
  sword: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_sword.png",
  netheriteop: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/netherite_chestplate.png",
  macepvp: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/item/mace.png",
  axe: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_axe.png",
  pot: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/potion.png",
  smp: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/block/grass_block_side.png",
  global: "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/netherite_upgrade_smithing_template.png"
};

const POSES = [
  { id: 'idle', name: 'Idle (Dynamic)' },
  { id: 'walk', name: 'Walking (Dynamic)' },
  { id: 'run', name: 'Running (Dynamic)' },
  { id: 'fly', name: 'Flying (Dynamic)' },
  { id: 'body', name: 'Frontal (Static)' },
  { id: 'player', name: '3D Isometric (Static)' },
  { id: 'head', name: '3D Head (Static)' },
  { id: 'combo', name: 'Combo (Static)' },
  { id: 'avatar', name: 'Flat Avatar (Static)' },
  { id: 'bust', name: 'Bust (Static)' },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cpvp', name: 'Crystal PvP', icon: 'cpvp', description: 'End crystal combat', order: 1 },
  { id: 'uhc', name: 'UHC', icon: 'uhc', description: 'Ultra Hardcore combat', order: 2 },
  { id: 'sword', name: 'Sword', icon: 'sword', description: 'Classic sword combat', order: 3 },
  { id: 'netheriteop', name: 'Netherite OP', icon: 'netheriteop', description: 'Full netherite combat', order: 4 },
  { id: 'macepvp', name: 'Mace PvP', icon: 'macepvp', description: 'Mace combat', order: 5 },
  { id: 'axe', name: 'Axe', icon: 'axe', description: 'Axe and shield combat', order: 6 },
  { id: 'pot', name: 'Pot', icon: 'pot', description: 'Potion PvP', order: 7 },
  { id: 'smp', name: 'SMP', icon: 'smp', description: 'Survival Multiplayer combat', order: 8 },
];

const BADGES: Badge[] = [
  { id: 'crystal_legend', name: 'Crystal Legend', icon: <Sparkles className="w-3 h-3" />, color: 'text-purple-400 border-purple-400/30 bg-purple-400/10', description: 'Held HT1 in Crystal PvP for a long time' },
  { id: 'universal', name: 'Universal', icon: <Globe className="w-3 h-3" />, color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10', description: 'Top 3 in 3+ categories' },
  { id: 'veteran', name: 'Veteran', icon: <History className="w-3 h-3" />, color: 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10', description: 'Member of the top for over a year' },
  { id: 'rising_star', name: 'Rising Star', icon: <TrendingUp className="w-3 h-3" />, color: 'text-green-400 border-green-400/30 bg-green-400/10', description: 'Rapidly climbing the ranks' },
  { id: 'community_fav', name: 'Community Favorite', icon: <Heart className="w-3 h-3" />, color: 'text-pink-400 border-pink-400/30 bg-pink-400/10', description: 'Highly voted by the community' },
  { id: 'owner', name: 'Owner', icon: <Crown className="w-3 h-3" />, color: 'text-amber-400 border-amber-400/50 bg-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.4)]', description: 'The creator and owner of Moldova PvP' },
];

const DEFAULT_TIERS: Tier[] = [
  { id: 'HT1', name: 'HT1', color: 'text-amber-400 border-amber-400/50 bg-amber-400/10', order: 1, points: 100 },
  { id: 'LT1', name: 'LT1', color: 'text-blue-400 border-blue-400/50 bg-blue-400/10', order: 2, points: 90 },
  { id: 'HT2', name: 'HT2', color: 'text-amber-400 border-amber-400/50 bg-amber-400/10', order: 3, points: 80 },
  { id: 'LT2', name: 'LT2', color: 'text-blue-400 border-blue-400/50 bg-blue-400/10', order: 4, points: 70 },
  { id: 'HT3', name: 'HT3', color: 'text-amber-400 border-amber-400/50 bg-amber-400/10', order: 5, points: 60 },
  { id: 'LT3', name: 'LT3', color: 'text-blue-400 border-blue-400/50 bg-blue-400/10', order: 6, points: 50 },
  { id: 'HT4', name: 'HT4', color: 'text-amber-400 border-amber-400/50 bg-amber-400/10', order: 7, points: 40 },
  { id: 'LT4', name: 'LT4', color: 'text-blue-400 border-blue-400/50 bg-blue-400/10', order: 8, points: 30 },
  { id: 'HT5', name: 'HT5', color: 'text-amber-400 border-amber-400/50 bg-amber-400/10', order: 9, points: 20 },
  { id: 'LT5', name: 'LT5', color: 'text-blue-400 border-blue-400/50 bg-blue-400/10', order: 10, points: 10 },
];

// --- Translations ---
type Language = 'ru' | 'en' | 'ro';

const TRANSLATIONS = {
  ru: {
    tierlist: "ТИР-ЛИСТ",
    globalLeaderboard: "Глобальный топ",
    categories: "Категории",
    adminPanel: "Админ-панель",
    login: "Войти",
    logout: "Выйти",
    searchPlaceholder: "Поиск игрока...",
    totalPoints: "Всего баллов",
    rank: "Место",
    player: "Игрок",
    title: "Звание",
    points: "Баллы",
    highTier: "Высший тир (HT)",
    lowTier: "Низший тир (LT)",
    totalPlayers: "Всего игроков",
    activeModes: "Активные режимы",
    noPlayers: "Игроки не найдены",
    noPlayersDesc: "Попробуйте другой ник или выберите другую категорию.",
    addNewPlayer: "Добавить нового игрока",
    nicknamePlaceholder: "Никнейм игрока...",
    add: "Добавить",
    adding: "Добавление...",
    updateSeed: "Обновить базу (Seed)",
    managePlayers: "Управление игроками",
    pose: "Поза",
    actions: "Действия",
    deleteConfirmTitle: "Удалить игрока?",
    deleteConfirmDesc: "Вы уверены, что хотите удалить игрока {name}? Это нельзя отменить.",
    cancel: "Отмена",
    delete: "Удалить",
    titles: {
      legend: "Легенда",
      elite: "Элита",
      master: "Мастер",
      experienced: "Опытный",
      beginner: "Новичок"
    },
    status: {
      added: "Игрок {name} успешно добавлен!",
      deleted: "Игрок {name} удален.",
      errorAdd: "Ошибка при добавлении",
      errorDelete: "Ошибка при удалении",
      seedSuccess: "Данные успешно обновлены!"
    },
    footer: {
      copyright: "© 2026 Moldova PvP. Все права защищены.",
      legal: "Правовая информация",
      privacy: "Конфиденциальность",
      terms: "Условия использования"
    },
    legalPage: {
      title: "Правовая информация и Конфиденциальность",
      intro: "Этот сайт является независимым рейтингом игроков Minecraft PvP в Молдове.",
      copyrightTitle: "Интеллектуальная собственность",
      copyrightText: "Все уникальные идеи, концепции дизайна и структура данного проекта являются интеллектуальной собственностью автора. Копирование, воспроизведение или использование этих идей без явного разрешения владельца запрещено.",
      disclaimer: "Отказ от ответственности",
      disclaimerText: "Мы не связаны с Mojang AB или Microsoft. Все торговые марки принадлежат их владельцам. Данные игроков собираются из открытых источников и предоставляются исключительно в информационных целях.",
      privacyTitle: "Политика конфиденциальности",
      privacyText: "Мы не собираем личные данные обычных посетителей. Для администраторов мы используем Google Auth только для проверки прав доступа. Мы не передаем ваши данные третьим лицам.",
      cookiesTitle: "Cookies",
      cookiesText: "Мы используем локальное хранилище браузера только для сохранения ваших настроек (например, выбранного языка)."
    }
  },
  en: {
    tierlist: "TIERLIST",
    globalLeaderboard: "Global Leaderboard",
    categories: "Categories",
    adminPanel: "Admin Panel",
    login: "Login",
    logout: "Logout",
    searchPlaceholder: "Search player...",
    totalPoints: "Total Points",
    rank: "Rank",
    player: "Player",
    title: "Title",
    points: "Points",
    highTier: "High Tier (HT)",
    lowTier: "Low Tier (LT)",
    totalPlayers: "Total Players",
    activeModes: "Active Modes",
    noPlayers: "No players found",
    noPlayersDesc: "Try searching for a different name or select another category.",
    addNewPlayer: "Add new player",
    nicknamePlaceholder: "Player nickname...",
    add: "Add",
    adding: "Adding...",
    updateSeed: "Update DB (Seed)",
    managePlayers: "Manage Players",
    pose: "Pose",
    actions: "Actions",
    deleteConfirmTitle: "Delete player?",
    deleteConfirmDesc: "Are you sure you want to delete player {name}? This cannot be undone.",
    cancel: "Cancel",
    delete: "Delete",
    titles: {
      legend: "Legend",
      elite: "Elite",
      master: "Master",
      experienced: "Experienced",
      beginner: "Beginner"
    },
    status: {
      added: "Player {name} successfully added!",
      deleted: "Player {name} deleted.",
      errorAdd: "Error adding player",
      errorDelete: "Error deleting player",
      seedSuccess: "Data successfully updated!"
    },
    footer: {
      copyright: "© 2026 Moldova PvP. All rights reserved.",
      legal: "Legal Information",
      privacy: "Privacy Policy",
      terms: "Terms of Service"
    },
    legalPage: {
      title: "Legal Information & Privacy",
      intro: "This site is an independent ranking system for Minecraft PvP players in Moldova.",
      copyrightTitle: "Intellectual Property",
      copyrightText: "All unique ideas, design concepts, and the structure of this project are the intellectual property of the author. Copying, reproducing, or using these ideas without explicit permission from the owner is prohibited.",
      disclaimer: "Disclaimer",
      disclaimerText: "We are not affiliated with Mojang AB or Microsoft. All trademarks belong to their respective owners. Player data is collected from public sources and provided for informational purposes only.",
      privacyTitle: "Privacy Policy",
      privacyText: "We do not collect personal data from regular visitors. For administrators, we use Google Auth only to verify access rights. We do not share your data with third parties.",
      cookiesTitle: "Cookies",
      cookiesText: "We use local browser storage only to save your preferences (e.g., selected language)."
    }
  },
  ro: {
    tierlist: "TIERLIST",
    globalLeaderboard: "Clasament Global",
    categories: "Categorii",
    adminPanel: "Panou Admin",
    login: "Autentificare",
    logout: "Ieșire",
    searchPlaceholder: "Caută jucător...",
    totalPoints: "Total Puncte",
    rank: "Loc",
    player: "Jucător",
    title: "Titlu",
    points: "Puncte",
    highTier: "Tier Înalt (HT)",
    lowTier: "Tier Jos (LT)",
    totalPlayers: "Total Jucători",
    activeModes: "Moduri Active",
    noPlayers: "Niciun jucător găsit",
    noPlayersDesc: "Încearcă alt nume sau alege o altă categorie.",
    addNewPlayer: "Adaugă jucător nou",
    nicknamePlaceholder: "Nickname jucător...",
    add: "Adaugă",
    adding: "Se adaugă...",
    updateSeed: "Actualizează baza (Seed)",
    managePlayers: "Gestionare jucători",
    pose: "Poză",
    actions: "Acțiuni",
    deleteConfirmTitle: "Ștergi jucătorul?",
    deleteConfirmDesc: "Ești sigur că vrei să ștergi jucătorul {name}? Această acțiune este ireversibilă.",
    cancel: "Anulează",
    delete: "Șterge",
    titles: {
      legend: "Legendă",
      elite: "Elită",
      master: "Maestru",
      experienced: "Experimentat",
      beginner: "Începător"
    },
    status: {
      added: "Jucătorul {name} a fost adăugat cu succes!",
      deleted: "Jucătorul {name} a fost șters.",
      errorAdd: "Eroare la adăugare",
      errorDelete: "Eroare la ștergere",
      seedSuccess: "Datele au fost actualizate cu succes!"
    },
    footer: {
      copyright: "© 2026 Moldova PvP. Toate drepturile rezervate.",
      legal: "Informații Legale",
      privacy: "Confidențialitate",
      terms: "Termeni și Condiții"
    },
    legalPage: {
      title: "Informații Legale și Confidențialitate",
      intro: "Acest site este un sistem independent de clasament pentru jucătorii de Minecraft PvP din Moldova.",
      copyrightTitle: "Proprietate Intelectuală",
      copyrightText: "Toate ideile unice, conceptele de design și structura acestui proiect sunt proprietatea intelectuală a autorului. Copierea, reproducerea sau utilizarea acestor idei fără permisiunea explicită a proprietarului este interzisă.",
      disclaimer: "Declinarea responsabilității",
      disclaimerText: "Nu suntem afiliați cu Mojang AB sau Microsoft. Toate mărcile comerciale aparțin proprietarilor respectivi. Datele jucătorilor sunt colectate din surse publice și sunt furnizate doar în scop informativ.",
      privacyTitle: "Politica de Confidențialitate",
      privacyText: "Nu colectăm date personale de la vizitatorii obișnuiți. Pentru administratori, folosim Google Auth doar pentru a verifica drepturile de acces. Nu partajăm datele dvs. cu terți.",
      cookiesTitle: "Cookie-uri",
      cookiesText: "Folosim stocarea locală a browserului doar pentru a salva preferințele dvs. (de exemplu, limba selectată)."
    }
  }
};

const TITLES = [
  { id: 'legend', min: 1001, color: 'text-red-500 shadow-red-500/50' },
  { id: 'elite', min: 601, color: 'text-orange-500 shadow-orange-500/50' },
  { id: 'master', min: 301, color: 'text-yellow-500 shadow-yellow-500/50' },
  { id: 'experienced', min: 101, color: 'text-green-500 shadow-green-500/50' },
  { id: 'beginner', min: 0, color: 'text-zinc-500 shadow-zinc-500/50' },
];

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error (${operationType}) at ${path}:`, error);
  alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
}

// --- Components ---

const MinecraftSkin = ({ 
  name, 
  width = 300, 
  height = 400, 
  className = "", 
  animated = true, 
  rotationY = 0,
  zoom = 0.9,
  offsetY = -12,
  style = {}
}: { 
  name: string, 
  width?: number, 
  height?: number, 
  className?: string, 
  animated?: boolean, 
  rotationY?: number,
  zoom?: number,
  offsetY?: number,
  style?: React.CSSProperties
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewerRef = React.useRef<SkinViewer | null>(null);

  React.useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: width * 2,
      height: height * 2,
      alpha: true,
    } as any);

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [width, height]);

  React.useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const skinUrl = name ? `https://mc-heads.net/skin/${name}` : 'https://mc-heads.net/skin/Steve';
    viewer.loadSkin(skinUrl)
      .catch(() => viewer.loadSkin('https://mc-heads.net/skin/Steve'));
  }, [name]);

  React.useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.autoRotate = animated;
    viewer.autoRotateSpeed = 0.5;
    viewer.fov = 70;
    viewer.zoom = zoom;
    viewer.playerObject.rotation.y = rotationY;
    viewer.playerObject.position.y = offsetY;
    viewer.playerObject.position.z = 0;

    if (animated) {
      viewer.animation = new WalkingAnimation();
    } else {
      viewer.animation = null;
      viewer.playerObject.skin.leftLeg.rotation.x = 0.5;
      viewer.playerObject.skin.rightLeg.rotation.x = -0.5;
      viewer.playerObject.skin.leftArm.rotation.x = -0.5;
      viewer.playerObject.skin.rightArm.rotation.x = 0.5;
    }
  }, [animated, zoom, offsetY, rotationY]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ width: `${width}px`, height: `${height}px`, ...style }}
      className={cn("cursor-grab active:cursor-grabbing", className)} 
    />
  );
};

const Footer = ({ t }: { t: any }) => {
  return (
    <footer className="mt-20 py-12 px-4 sm:px-10 border-t border-white/5 bg-black/20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-4">
          <img src={LOGO_URL} className="w-10 h-10 object-contain opacity-50 grayscale" alt="Logo" referrerPolicy="no-referrer" />
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">{t.footer.copyright}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
          <Link to="/legal" className="text-zinc-500 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">{t.footer.legal}</Link>
          <Link to="/legal" className="text-zinc-500 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">{t.footer.privacy}</Link>
          <Link to="/legal" className="text-zinc-500 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">{t.footer.terms}</Link>
        </div>
      </div>
    </footer>
  );
};

const Legal = ({ t }: { t: any }) => {
  return (
    <div className="p-4 sm:p-10 max-w-4xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 sm:p-16 shadow-2xl"
      >
        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white mb-8 sm:mb-12 leading-none">
          {t.legalPage.title}
        </h1>
        
        <div className="space-y-12 text-zinc-400 font-medium leading-relaxed">
          <section>
            <p className="text-lg text-zinc-300">{t.legalPage.intro}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-2 h-8 bg-red-600 rounded-full" />
              {t.legalPage.copyrightTitle}
            </h2>
            <p>{t.legalPage.copyrightText}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-2 h-8 bg-red-600 rounded-full" />
              {t.legalPage.disclaimer}
            </h2>
            <p>{t.legalPage.disclaimerText}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-2 h-8 bg-red-600 rounded-full" />
              {t.legalPage.privacyTitle}
            </h2>
            <p>{t.legalPage.privacyText}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-2 h-8 bg-red-600 rounded-full" />
              {t.legalPage.cookiesTitle}
            </h2>
            <p>{t.legalPage.cookiesText}</p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5">
          <Link 
            to="/" 
            className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all border border-white/5"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад на главную
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

const PlayerModal = ({ player, tiers, categories, onClose, t, lang, isAdmin, updateBadges, votePlayer, voteStatus }: any) => {
  if (!player) return null;

  const isOwner = player.badges?.includes('owner');

  const totalPoints = Object.entries(player.rankings).reduce((sum, [catId, tierId]) => {
    const tier = tiers.find((t: any) => t.id === tierId) || DEFAULT_TIERS.find((t: any) => t.id === tierId);
    return sum + (tier?.points || 0);
  }, 0);

  const radarData = categories.slice(0, 6).map((cat: any) => {
    const tierId = player.rankings[cat.id];
    const tier = tiers.find((t: any) => t.id === tierId) || DEFAULT_TIERS.find((t: any) => t.id === tierId);
    return {
      subject: cat.name,
      value: tier?.points || 10,
      fullMark: 100
    };
  });

  const chartData = player.history || [
    { date: 'Initial', points: 0 },
    { date: 'Current', points: totalPoints }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="absolute top-0 left-0 w-full h-1 flex">
          <div className="h-full w-1/3 bg-[#0046ae]" />
          <div className="h-full w-1/3 bg-[#ffd100]" />
          <div className="h-full w-1/3 bg-[#cc092f]" />
        </div>

        <div className="p-4 sm:p-10">
          <div className="flex flex-col lg:flex-row gap-8 sm:gap-12 items-center lg:items-start">
            {/* Left: Skin and Basic Info */}
            <div className="w-full lg:w-1/3 space-y-6">
              <div className="aspect-[3/4] bg-zinc-800 rounded-[2rem] border border-white/5 overflow-hidden relative group flex items-center justify-center">
                <div className={cn(
                  "absolute inset-0 transition-all duration-1000",
                  isOwner ? "bg-gradient-to-b from-amber-400/20 via-amber-400/5 to-transparent" : "bg-gradient-to-b from-red-600/10 to-transparent"
                )} />
                
                {/* Particles for Owner */}
                {isOwner && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ 
                          x: Math.random() * 300 - 150, 
                          y: 400, 
                          opacity: 0, 
                          scale: Math.random() * 0.5 + 0.5 
                        }}
                        animate={{ 
                          y: -100, 
                          opacity: [0, 1, 0.8, 0],
                          x: (Math.random() * 300 - 150) + (Math.sin(i) * 50)
                        }}
                        transition={{ 
                          duration: Math.random() * 2 + 2, 
                          repeat: Infinity, 
                          delay: Math.random() * 5,
                          ease: "linear"
                        }}
                        className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full blur-[1px] shadow-[0_0_8px_#fbbf24]"
                      />
                    ))}
                  </div>
                )}

                <MinecraftSkin 
                  name={player.name} 
                  width={400} 
                  height={500}
                  zoom={0.35}
                  offsetY={-12}
                  className="relative z-10 translate-y-12"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={() => votePlayer(player.id, 'up')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600/10 hover:bg-green-600/20 border border-green-600/20 rounded-2xl text-green-500 transition-all"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <motion.span 
                      key={player.votes?.up}
                      initial={{ scale: 1.5, color: '#22c55e' }}
                      animate={{ scale: 1, color: '#22c55e' }}
                      className="text-xs font-black"
                    >
                      {player.votes?.up || 0}
                    </motion.span>
                  </button>
                  <button 
                    onClick={() => votePlayer(player.id, 'down')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 rounded-2xl text-red-500 transition-all"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <motion.span 
                      key={player.votes?.down}
                      initial={{ scale: 1.5, color: '#ef4444' }}
                      animate={{ scale: 1, color: '#ef4444' }}
                      className="text-xs font-black"
                    >
                      {player.votes?.down || 0}
                    </motion.span>
                  </button>
                </div>
                <AnimatePresence>
                  {voteStatus && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-[10px] font-black text-red-500 text-center uppercase tracking-widest"
                    >
                      {voteStatus}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right: Stats and Charts */}
            <div className="flex-1 space-y-8 w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tighter mb-2">{player.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {player.badges?.map((badgeId: string) => {
                      const badge = BADGES.find(b => b.id === badgeId);
                      return badge ? (
                        <div key={badgeId} className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest", badge.color)}>
                          {badge.icon}
                          {badge.name}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all self-end sm:self-auto"><X className="w-6 h-6" /></button>
              </div>

              {/* Progress Chart */}
              <div className="bg-black/40 rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-red-500" />
                    Progress History
                  </h3>
                  <div className="text-2xl font-black text-white">{totalPoints} <span className="text-xs text-zinc-500">PTS</span></div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        itemStyle={{ color: '#ef4444', fontWeight: 'bold' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="points" 
                        stroke="#ef4444" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ranks and Radar Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-500" />
                    Tier Distribution
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((cat: any) => {
                      const tierId = player.rankings[cat.id];
                      const tier = tiers.find((t: any) => t.id === tierId);
                      return (
                        <div key={cat.id} className="bg-zinc-800/50 border border-white/5 rounded-2xl p-4 group hover:border-red-500/20 transition-all">
                          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">{cat.name}</p>
                          <div className={cn(
                            "inline-flex px-3 py-1 rounded-lg text-[10px] font-black border",
                            tier ? tier.color : "text-zinc-700 border-zinc-800"
                          )}>
                            {tier ? tier.name : "--"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-black/40 rounded-3xl p-6 border border-white/5 overflow-hidden">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Dna className="w-4 h-4 text-amber-500" />
                    Ability Spectrum
                  </h3>
                  <div className="h-[250px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="#ffffff10" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 9, fontWeight: '900' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} hide />
                        <Radar
                          name="Ability"
                          dataKey="value"
                          stroke={isOwner ? "#fbbf24" : "#ef4444"}
                          fill={isOwner ? "#fbbf24" : "#ef4444"}
                          fillOpacity={0.3}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="pt-6 border-t border-white/5">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Admin: Manage Badges</p>
                  <div className="flex flex-wrap gap-2">
                    {BADGES.map(badge => {
                      const hasBadge = player.badges?.includes(badge.id);
                      return (
                        <button
                          key={badge.id}
                          onClick={() => {
                            const newBadges = hasBadge 
                              ? player.badges.filter((id: string) => id !== badge.id)
                              : [...(player.badges || []), badge.id];
                            updateBadges(player.id, newBadges);
                          }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase transition-all",
                            hasBadge ? badge.color : "text-zinc-600 border-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          {badge.icon}
                          {badge.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('lang');
    return (saved as Language) || 'ru';
  });

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [compareList, setCompareList] = useState<Player[]>([]);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [skinConfig, setSkinConfig] = useState({
    global: {
      zoom: 0.9,
      offsetY: -9,
      width: 200,
      height: 69,
      scale: 1.2,
      translateY: 30
    },
    category: {
      zoom: 0.9,
      offsetY: -9,
      width: 200,
      height: 70,
      rotationY: 0.458407346410207,
      scale: 1.2,
      translateY: 0
    },
    mvp: {
      zoom: 0.45,
      offsetY: -10,
      width: 200,
      height: 200,
      scale: 1.2,
      translateY: 30
    }
  });

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email) {
        const adminEmail = (import.meta as any).env?.VITE_ADMIN_EMAIL || "matvey.zingaliuk@gmail.com";
        const isAdminUser = u.email.toLowerCase() === adminEmail.toLowerCase();
        setIsAdmin(isAdminUser);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    const unsubCategories = onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snap) => {
      setCategories(snap.docs.map(doc => doc.data() as Category));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubTiers = onSnapshot(query(collection(db, 'tiers'), orderBy('order')), (snap) => {
      setTiers(snap.docs.map(doc => doc.data() as Tier));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tiers'));

    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
      setPlayers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'players'));

    const unsubActivities = onSnapshot(query(collection(db, 'activity'), orderBy('timestamp', 'desc'), limit(10)), (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activity'));

    const unsubSkinConfig = onSnapshot(doc(db, 'settings', 'skinConfig'), (snap) => {
      if (snap.exists()) {
        setSkinConfig(snap.data() as any);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/skinConfig'));

    return () => {
      unsubCategories();
      unsubTiers();
      unsubPlayers();
      unsubActivities();
      unsubSkinConfig();
    };
  }, []);

  const saveSkinConfig = async (config: any) => {
    if (!isAdmin) return false;
    try {
      await setDoc(doc(db, 'settings', 'skinConfig'), config);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/skinConfig');
      return false;
    }
  };

  // --- Leaderboard Logic ---
  const leaderboard = useMemo(() => {
    return players.map(p => {
      const totalPoints = Object.entries(p.rankings).reduce((sum, [catId, tierId]) => {
        const tier = tiers.find(t => t.id === tierId) || DEFAULT_TIERS.find(t => t.id === tierId);
        return sum + (tier?.points || 0);
      }, 0);
      const titleData = TITLES.find(t => totalPoints >= t.min) || TITLES[TITLES.length - 1];
      const titleName = (t.titles as any)[titleData.id];
      return { ...p, totalPoints, title: { ...titleData, name: titleName } };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [players, tiers, t]);

  const filteredPlayers = useMemo(() => {
    const base = activeCategory === 'global' ? leaderboard : leaderboard.filter(p => p.rankings[activeCategory]);
    
    return base
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (activeCategory === 'global') return (b as any).totalPoints - (a as any).totalPoints;
        const tierA = tiers.find(t => t.id === a.rankings[activeCategory])?.order || 999;
        const tierB = tiers.find(t => t.id === b.rankings[activeCategory])?.order || 999;
        return tierA - tierB;
      });
  }, [leaderboard, activeCategory, searchQuery, tiers]);

  const seedData = async () => {
    if (!isAdmin) return false;
    const batch = writeBatch(db);

    DEFAULT_CATEGORIES.forEach(cat => {
      batch.set(doc(db, 'categories', cat.id), cat);
    });

    DEFAULT_TIERS.forEach(tier => {
      batch.set(doc(db, 'tiers', tier.id), tier);
    });

    try {
      await batch.commit();
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch-seed');
      return false;
    }
  };

  const notifyDiscord = async (embed: any) => {
    const webhookUrl = (import.meta as any).env?.VITE_DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1495840157688139866/CRwyP5bvYQyOFNy1-TzS1nUl-6T_6RCybiEv7te85malF1rYXqrgSycCFpA6k0BmGAMn";
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            ...embed,
            color: 14427686, // #dc2626
            timestamp: new Date().toISOString(),
            footer: { text: "Moldova PvP Tracker" },
            thumbnail: { url: "https://www.image2url.com/r2/default/images/1776355660052-7fa46551-71ad-4f14-8d8b-b1b2d8f102bb.png" }
          }]
        })
      });
    } catch (e) {
      console.error("Discord Notification Failed:", e);
    }
  };

  const updateRank = async (playerId: string, categoryId: string, tierId: string) => {
    const player = players.find((p: any) => p.id === playerId);
    if (!player) return;
    
    const oldTierId = player.rankings[categoryId];
    const oldTier = tiers.find(t => t.id === oldTierId);
    const newTier = tiers.find(t => t.id === tierId);
    
    const newRankings = { ...player.rankings, [categoryId]: tierId };
    
    // Calculate new total points for history
    const newTotalPoints = Object.entries(newRankings).reduce((sum, [catId, tId]) => {
      const t = tiers.find(tier => tier.id === tId);
      return sum + (t?.points || 0);
    }, 0);

    const historyEntry = {
      date: new Date().toISOString(),
      points: newTotalPoints
    };

    const newHistory = [...(player.history || []), historyEntry].slice(-20); // Keep last 20 entries

    try {
      await setDoc(doc(db, 'players', playerId), { 
        ...player, 
        rankings: newRankings, 
        history: newHistory,
        updatedAt: serverTimestamp() 
      }, { merge: true });

      // Log activity
      if (oldTierId !== tierId) {
        const type = (newTier?.order || 0) < (oldTier?.order || 999) ? 'rank_up' : 'rank_down';
        await addDoc(collection(db, 'activity'), {
          playerId,
          playerName: player.name,
          type,
          details: `${categoryId.toUpperCase()}: ${oldTierId || '--'} -> ${tierId}`,
          timestamp: serverTimestamp()
        });

        // Discord Notify
        notifyDiscord({
          title: type === 'rank_up' ? "Rank Up! 🚀" : "Rank Update 📋",
          description: `**${player.name}** rank in **${categoryId.toUpperCase()}** has been updated.`,
          fields: [
            { name: "Old Tier", value: oldTierId || "None", inline: true },
            { name: "New Tier", value: tierId, inline: true },
            { name: "Total Points", value: `${newTotalPoints}`, inline: true }
          ]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${playerId}`);
    }
  };

  const updateBadges = async (playerId: string, badgeIds: string[]) => {
    try {
      await setDoc(doc(db, 'players', playerId), { badges: badgeIds }, { merge: true });
      
      // Log activity for new badges
      const player = players.find(p => p.id === playerId);
      const newBadges = badgeIds.filter(id => !player?.badges?.includes(id));
      const removedBadges = player?.badges?.filter(id => !badgeIds.includes(id)) || [];
      
      for (const badgeId of newBadges) {
        const badge = BADGES.find(b => b.id === badgeId);
        await addDoc(collection(db, 'activity'), {
          playerId,
          playerName: player?.name || 'Unknown',
          type: 'badge_earned',
          details: `Earned badge: ${badge?.name}`,
          timestamp: serverTimestamp()
        });

        // Discord Notify
        notifyDiscord({
          title: "New Badge Assigned! ✨",
          description: `Player **${player?.name}** just earned the **${badge?.name}** badge!`,
          fields: [
            { name: "Description", value: badge?.description || "No description" }
          ]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${playerId}/badges`);
    }
  };

  const votePlayer = async (playerId: string, type: 'up' | 'down') => {
    const lastVoteKey = `last_vote_${playerId}`;
    const lastVote = localStorage.getItem(lastVoteKey);
    const now = Date.now();

    if (lastVote && now - parseInt(lastVote) < 24 * 60 * 60 * 1000) {
      setVoteStatus("Вы уже голосовали за этого игрока сегодня!");
      setTimeout(() => setVoteStatus(null), 3000);
      return;
    }

    // Optimistic update
    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        const currentVotes = p.votes || { up: 0, down: 0 };
        return {
          ...p,
          votes: {
            ...currentVotes,
            [type]: (currentVotes[type] || 0) + 1
          }
        };
      }
      return p;
    }));

    localStorage.setItem(lastVoteKey, now.toString());

    try {
      await setDoc(doc(db, 'players', playerId), {
        votes: {
          [type]: increment(1)
        }
      }, { merge: true });
    } catch (error) {
      // Rollback on error
      setPlayers(prev => prev.map(p => {
        if (p.id === playerId) {
          const currentVotes = p.votes || { up: 0, down: 0 };
          return {
            ...p,
            votes: {
              ...currentVotes,
              [type]: Math.max(0, (currentVotes[type] || 0) - 1)
            }
          };
        }
        return p;
      }));
      handleFirestoreError(error, OperationType.WRITE, `players/${playerId}/votes`);
    }
  };

  const resetAllVotes = async () => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      players.forEach(player => {
        batch.set(doc(db, 'players', player.id), {
          votes: { up: 0, down: 0 }
        }, { merge: true });
      });
      await batch.commit();
      setPlayers(prev => prev.map(p => ({ ...p, votes: { up: 0, down: 0 } })));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'players/all/votes');
      return false;
    }
  };

  const updatePose = async (playerId: string, pose: string) => {
    try {
      await setDoc(doc(db, 'players', playerId), { pose }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${playerId}/pose`);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-red-500/30">
        <AnimatePresence>
          {selectedPlayer && (
            <PlayerModal 
              player={players.find(p => p.id === selectedPlayer.id) || selectedPlayer} 
              tiers={tiers} 
              categories={categories} 
              onClose={() => setSelectedPlayer(null)} 
              t={t}
              lang={lang}
              isAdmin={isAdmin}
              updateBadges={updateBadges}
              votePlayer={votePlayer}
              voteStatus={voteStatus}
            />
          )}
        </AnimatePresence>

        <Sidebar 
          categories={categories} 
          activeCategory={activeCategory} 
          setActiveCategory={setActiveCategory} 
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          t={t}
        />

        <main className={cn(
          "transition-all duration-300 min-h-screen",
          isSidebarOpen ? "lg:pl-72" : "pl-0"
        )}>
          <Header 
            activeCategory={activeCategory} 
            categories={categories} 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery} 
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            isAdmin={isAdmin}
            t={t}
            lang={lang}
            setLang={setLang}
          />

          <Routes>
            <Route path="/" element={
              <Home 
                activeCategory={activeCategory}
                tiers={tiers}
                filteredPlayers={filteredPlayers}
                playersByTier={playersByTier(filteredPlayers, tiers, activeCategory)}
                onPlayerClick={setSelectedPlayer}
                t={t}
                players={players}
                categories={categories}
                activities={activities}
                skinConfig={skinConfig}
                compareList={compareList}
                setCompareList={setCompareList}
              />
            } />
            <Route path="/admin-secret-access" element={
              isAdmin ? <Admin tiers={tiers} categories={categories} players={players} seedData={seedData} updateRank={updateRank} updatePose={updatePose} t={t} skinConfig={skinConfig} setSkinConfig={setSkinConfig} saveSkinConfig={saveSkinConfig} resetAllVotes={resetAllVotes} /> : (
                <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
                  <img src={LOGO_URL} className="w-24 h-24 mb-8" alt="Logo" />
                  <h2 className="text-2xl font-bold mb-6">Admin Access</h2>
                  {!user ? (
                    <button 
                      onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                      className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-900/20 flex items-center gap-2"
                    >
                      <LogIn className="w-5 h-5" />
                      Login as Admin
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-red-500 font-bold">Access Denied: {user.email} is not an admin.</p>
                      <button onClick={() => signOut(auth)} className="text-zinc-500 hover:text-white underline">Logout</button>
                    </div>
                  )}
                </div>
              )
            } />
            <Route path="/legal" element={<Legal t={t} />} />
          </Routes>
          <Footer t={t} />
        </main>
      </div>
    </BrowserRouter>
  );
}

// --- Sub-components ---

function playersByTier(players: Player[], tiers: Tier[], activeCategory: string) {
  if (activeCategory === 'global') return {};
  const groups: Record<string, Player[]> = {};
  tiers.forEach(t => groups[t.id] = []);
  players.forEach(p => {
    const tierId = p.rankings[activeCategory];
    if (groups[tierId]) groups[tierId].push(p);
  });
  return groups;
}

const Sidebar = ({ categories, activeCategory, setActiveCategory, isSidebarOpen, setIsSidebarOpen, t }: any) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-72 bg-black/40 backdrop-blur-xl border-r border-white/5 transition-transform duration-500 ease-in-out shadow-[20px_0_50px_rgba(0,0,0,0.5)]",
      isSidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="tricolor-line absolute top-0 left-0 z-20">
        <div className="tricolor-blue" />
        <div className="tricolor-yellow" />
        <div className="tricolor-red" />
      </div>
      
      <div className="p-8 flex flex-col h-full relative">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-red-600/10 to-transparent pointer-events-none" />
        
        <div className="flex items-center justify-between mb-12 relative">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-2 bg-red-600/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src={LOGO_URL} className="w-14 h-14 object-contain relative z-10 drop-shadow-2xl" alt="Moldova PvP Logo" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="font-black text-2xl leading-none tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">MOLDOVA</h1>
              <p className="text-[10px] text-red-500 font-black tracking-[0.3em] uppercase mt-1">{t.tierlist}</p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 bg-white/5 rounded-xl text-zinc-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar relative">
          <button
            onClick={() => { setActiveCategory('global'); navigate('/'); }}
            className={cn(
              "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group mb-6 relative overflow-hidden",
              activeCategory === 'global' && location.pathname === '/'
                ? "bg-red-600 text-white shadow-[0_10px_30px_rgba(220,38,38,0.3)]" 
                : "hover:bg-white/5 text-zinc-500 hover:text-zinc-100"
            )}
          >
            {activeCategory === 'global' && location.pathname === '/' && (
              <motion.div 
                layoutId="sidebar-active"
                className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-700"
              />
            )}
            <img 
              src={CATEGORY_ICONS.global} 
              className={cn("w-6 h-6 relative z-10 object-contain", activeCategory === 'global' ? "brightness-200" : "opacity-50 group-hover:opacity-100")} 
              style={{ imageRendering: 'pixelated' }}
              alt="Global"
              referrerPolicy="no-referrer"
            />
            <span className="font-black text-sm relative z-10 tracking-tight">{t.globalLeaderboard}</span>
          </button>

          <div className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] px-5 mb-4">{t.categories}</div>
          <div className="space-y-1.5">
            {categories.map((cat: any) => {
              const iconUrl = CATEGORY_ICONS[cat.id] || CATEGORY_ICONS.global;
              const isActive = activeCategory === cat.id && location.pathname === '/';
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); navigate('/'); }}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                    isActive 
                      ? "text-white" 
                      : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                  )}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-white/10"
                    />
                  )}
                  <img 
                    src={iconUrl} 
                    className={cn("w-5 h-5 relative z-10 object-contain transition-all", isActive ? "scale-110" : "opacity-50 group-hover:opacity-100")} 
                    style={{ imageRendering: 'pixelated' }}
                    alt={cat.name}
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-bold text-sm relative z-10 tracking-tight">{cat.name}</span>
                  {isActive && <div className="absolute right-4 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] relative z-10" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
};

const Header = ({ activeCategory, categories, searchQuery, setSearchQuery, isSidebarOpen, setIsSidebarOpen, isAdmin, t, lang, setLang }: any) => {
  return (
    <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-xl border-b border-white/5 px-4 sm:px-10 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center justify-between w-full sm:w-auto gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all border border-white/5"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h2 className="text-xl sm:text-3xl font-black tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent truncate max-w-[150px] sm:max-w-none flex items-center gap-3">
            <img 
              src={CATEGORY_ICONS[activeCategory] || CATEGORY_ICONS.global} 
              className="w-6 h-6 sm:w-8 sm:h-8 object-contain" 
              style={{ imageRendering: 'pixelated' }}
              alt="Icon"
              referrerPolicy="no-referrer"
            />
            {activeCategory === 'global' ? t.globalLeaderboard : categories.find((c: any) => c.id === activeCategory)?.name}
          </h2>
        </div>
        
        {/* Mobile Language Switcher */}
        <div className="flex sm:hidden items-center bg-white/5 border border-white/5 rounded-2xl p-1 backdrop-blur-md">
          {(['ru', 'en', 'ro'] as Language[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "px-2 py-1 rounded-xl text-[8px] font-black uppercase transition-all duration-300",
                lang === l ? "bg-red-600 text-white" : "text-zinc-500"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
        <div className="hidden sm:flex items-center bg-white/5 border border-white/5 rounded-2xl p-1.5 backdrop-blur-md">
          {(['ru', 'en', 'ro'] as Language[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                lang === l ? "bg-red-600 text-white shadow-lg shadow-red-900/40" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="relative group flex-1 sm:flex-none">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
          <input 
            type="text" 
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 w-full sm:w-72 transition-all backdrop-blur-md placeholder:text-zinc-600"
          />
        </div>
      </div>
    </header>
  );
};

const RecentActivity = ({ activities, t }: { activities: Activity[], t: any }) => {
  return (
    <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-600/10 rounded-xl border border-red-600/20">
          <ActivityIcon className="w-5 h-5 text-red-500" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Recent Activity</h3>
      </div>
      
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4 group">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-2 h-2 rounded-full mt-2",
                activity.type === 'rank_up' ? "bg-green-500" : 
                activity.type === 'rank_down' ? "bg-red-500" : 
                activity.type === 'badge_earned' ? "bg-purple-500" : "bg-blue-500"
              )} />
              <div className="w-px h-full bg-white/5" />
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-white group-hover:text-red-500 transition-colors">{activity.playerName}</span>
                <span className="text-[9px] font-black text-zinc-600 uppercase">
                  {activity.timestamp?.toDate ? new Date(activity.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                {activity.type === 'rank_up' && <span className="text-green-500 font-bold">Ranked Up! </span>}
                {activity.type === 'rank_down' && <span className="text-red-500 font-bold">Ranked Down. </span>}
                {activity.type === 'badge_earned' && <span className="text-purple-500 font-bold">New Badge! </span>}
                {activity.details}
              </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="py-10 text-center opacity-20">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">No recent activity</span>
          </div>
        )}
      </div>
    </div>
  );
};

const CompareModal = ({ players, onClose, t, categories, tiers }: { players: Player[], onClose: () => void, t: any, categories: Category[], tiers: Tier[] }) => {
  if (players.length < 2) return null;
  const [p1, p2] = players;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-5xl bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-y-auto max-h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.8)] custom-scrollbar"
      >
        <div className="p-6 sm:p-12 flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <Sword className="w-6 h-6 sm:w-8 h-8 text-red-500" />
              Player Comparison
            </h2>
            <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex overflow-x-auto gap-8 pb-4 sm:grid sm:grid-cols-2 sm:gap-12 relative custom-scrollbar snap-x snap-mandatory">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 hidden sm:block" />
            
            {[p1, p2].map((p, idx) => (
              <div key={p.id} className="space-y-8 min-w-[280px] sm:min-w-0 snap-center flex-shrink-0 sm:flex-shrink">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-32 h-32 rounded-3xl bg-zinc-800 border border-white/5 overflow-hidden relative group">
                    <img 
                      src={`https://visage.surgeplay.com/player/128/${p.name}`} 
                      className="w-full h-full object-contain object-top translate-y-4 scale-125" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{p.name}</h3>
                    <p className="text-red-500 font-black text-sm uppercase tracking-widest">Rank #{idx + 1} in Battle</p>
                  </div>
                </div>

                <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Total Points</span>
                    <span className="text-2xl font-black text-white">{(p as any).totalPoints}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-600" 
                      style={{ width: `${Math.min(100, ((p as any).totalPoints / 1000) * 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Tier Comparison Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-2">Tier Breakdown</h4>
                  <div className="grid gap-2">
                    {categories.map(cat => {
                      const tierId = p.rankings[cat.id];
                      const tier = tiers.find(t => t.id === tierId);
                      return (
                        <div key={cat.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">{cat.name}</span>
                          <span className={cn(
                            "text-xs font-black px-2 py-0.5 rounded-md border",
                            tier?.color || "border-zinc-800 text-zinc-600"
                          )}>
                            {tierId || "N/A"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Home = ({ activeCategory, tiers, filteredPlayers, playersByTier, onPlayerClick, t, players, categories, activities, skinConfig, compareList, setCompareList }: any) => {
  const [showCompare, setShowCompare] = useState(false);

  const toggleCompare = (player: Player) => {
    if (compareList.find(p => p.id === player.id)) {
      setCompareList(compareList.filter(p => p.id !== player.id));
    } else {
      if (compareList.length < 2) {
        setCompareList([...compareList, player]);
      } else {
        setCompareList([compareList[1], player]);
      }
    }
  };

  if (activeCategory === 'global') {
    const leaderboard = [...filteredPlayers].sort((a, b) => b.totalPoints - a.totalPoints);
    
    return (
      <div className="p-3 sm:p-10 max-w-7xl mx-auto space-y-8 sm:space-y-12">
        <AnimatePresence>
          {showCompare && <CompareModal players={compareList} onClose={() => setShowCompare(false)} t={t} categories={categories} tiers={tiers} />}
        </AnimatePresence>

        {/* Hero Section for Global View */}
        <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[3rem] bg-gradient-to-br from-red-600/20 via-zinc-900/40 to-black border border-white/5 p-5 sm:p-12">
          <div className="absolute top-0 left-0 w-full h-1 flex">
            <div className="h-full w-1/3 bg-[#0046ae]" />
            <div className="h-full w-1/3 bg-[#ffd100]" />
            <div className="h-full w-1/3 bg-[#cc092f]" />
          </div>
          
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_top_right,_rgba(220,38,38,0.15),_transparent_70%)]" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] mb-4 sm:mb-6">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0046ae]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#ffd100]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#cc092f]" />
              </div>
              Moldova PvP Official
            </div>
            <h1 className="text-3xl sm:text-6xl font-black tracking-tighter text-white mb-4 sm:mb-6 leading-[0.9]">
              ULTIMATE <br />
              <span className="bg-gradient-to-r from-red-500 to-red-800 bg-clip-text text-transparent">LEADERBOARD</span>
            </h1>
            <p className="text-zinc-400 text-xs sm:text-lg font-medium leading-relaxed mb-6 sm:mb-8">
              The most accurate and up-to-date ranking of the best PvP players in Moldova. 
              Compete, climb the ranks, and become a legend.
            </p>
            
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl px-4 sm:px-6 py-3 sm:py-4">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                <div>
                  <div className="text-lg sm:text-xl font-black text-white">{players.length}</div>
                  <div className="text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest">Players</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl px-4 sm:px-6 py-3 sm:py-4">
                <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                <div>
                  <div className="text-lg sm:text-xl font-black text-white">{categories.length}</div>
                  <div className="text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest">Categories</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Community MVP / Player of the Week Section */}
        {players.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(() => {
              const mvp = [...players].sort((a, b) => (b.votes?.up || 0) - (a.votes?.up || 0))[0];
              if (!mvp) return null;
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  onClick={() => onPlayerClick(mvp)}
                  className="group relative overflow-hidden rounded-[2rem] bg-zinc-900/40 border border-white/5 p-8 flex items-center gap-8 cursor-pointer hover:bg-zinc-900/60 transition-all border-amber-500/20"
                >
                  <div className="absolute top-0 right-0 p-4">
                    <Sparkles className="w-24 h-24 text-amber-500/10 absolute -top-8 -right-8 rotate-12" />
                  </div>
                  <div className="relative z-10 flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-zinc-800 rounded-3xl border border-white/5 overflow-hidden flex items-end justify-center">
                    <MinecraftSkin 
                      name={mvp.name} 
                      width={skinConfig.mvp?.width ?? 200} 
                      height={skinConfig.mvp?.height ?? 200}
                      animated={true}
                      zoom={skinConfig.mvp?.zoom ?? 0.45}
                      offsetY={skinConfig.mvp?.offsetY ?? -10}
                      className="pointer-events-none"
                      style={{ 
                        transform: `scale(${skinConfig.mvp?.scale ?? 1.2}) translateY(${skinConfig.mvp?.translateY ?? 30}px)` 
                      }}
                    />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-2">
                      <Flame className="w-4 h-4" />
                      Community MVP
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 group-hover:text-amber-400 transition-colors uppercase italic tracking-tighter">
                      {mvp.name}
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-green-500 text-xs font-black">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {mvp.votes?.up || 0}
                      </div>
                      <div className="w-px h-3 bg-white/10" />
                      <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Most Loved this week</div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-[2rem] bg-gradient-to-br from-red-600 to-red-900/50 p-8 flex flex-col justify-center relative overflow-hidden"
            >
              <Zap className="absolute -top-12 -right-12 w-48 h-48 text-white/10 rotate-12" />
              <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter leading-tight relative z-10">
                WANT TO BE <br />IN THE TOP?
              </h3>
              <p className="text-white/70 text-xs font-medium max-w-[200px] mb-4 relative z-10">
                Compete in our official events and climb the tiers to get noticed.
              </p>
              <div className="flex relative z-10">
                 <div className="px-5 py-2 bg-white text-red-600 text-[10px] font-black uppercase rounded-full shadow-lg">Join Community</div>
              </div>
            </motion.div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-400" />
                Global Rankings
              </h3>
              {compareList.length > 0 && (
                <button 
                  onClick={() => setShowCompare(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-red-900/20"
                >
                  <Sword className="w-4 h-4" />
                  Compare ({compareList.length}/2)
                </button>
              )}
            </div>
            
            {/* Global Top Table - Scrollable on mobile */}
            <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-[2rem] overflow-x-auto shadow-2xl custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px] sm:min-w-0">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-3 sm:px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]"># Rank</th>
                    <th className="px-3 sm:px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Player</th>
                    <th className="px-3 sm:px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] hidden sm:table-cell">Title</th>
                    <th className="px-3 sm:px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-right">Points</th>
                    <th className="px-3 sm:px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center">Compare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leaderboard.map((player, index) => {
                    const isComparing = compareList.find(p => p.id === player.id);
                    const isOwner = player.badges?.includes('owner');
                    return (
                      <tr 
                        key={player.id} 
                        className={cn(
                          "group transition-all duration-300 cursor-pointer relative",
                          isOwner ? "bg-amber-400/5 hover:bg-amber-400/10" : "hover:bg-white/5"
                        )}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('.compare-btn')) return;
                          onPlayerClick(player);
                        }}
                      >
                        <td className="px-3 sm:px-6 py-5 relative">
                          {isOwner && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 via-yellow-600 to-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                          )}
                          <div className={cn(
                            "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-black",
                            index === 0 ? "bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.5)]" :
                            index === 1 ? "bg-zinc-300 text-black" :
                            index === 2 ? "bg-amber-700 text-white" : "text-zinc-500"
                          )}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-5">
                          <div className="flex items-center gap-2 sm:gap-4">
                            <div 
                              className="flex items-end justify-center overflow-hidden relative flex-shrink-0"
                              style={{ width: `${skinConfig.global.width}px`, height: `${skinConfig.global.height}px` }}
                            >
                              <MinecraftSkin 
                                name={player.name} 
                                width={skinConfig.global.width} 
                                height={skinConfig.global.height}
                                animated={true}
                                zoom={skinConfig.global.zoom}
                                offsetY={skinConfig.global.offsetY}
                                className="pointer-events-none"
                                style={{ 
                                  transform: `scale(${skinConfig.global.scale}) translateY(${skinConfig.global.translateY}px)` 
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className={cn(
                                "text-xs sm:text-sm font-black transition-colors truncate flex items-center gap-2",
                                isOwner ? "text-amber-400 group-hover:text-amber-300" : "text-white group-hover:text-red-500"
                              )}>
                                {player.name}
                                {isOwner && <Crown className="w-3 h-3 text-amber-400 animate-pulse" />}
                              </div>
                              <div className="flex gap-1 mt-1">
                                {player.badges?.slice(0, 3).map(badgeId => {
                                  const badge = BADGES.find(b => b.id === badgeId);
                                  return badge ? (
                                    <div key={badgeId} className={cn("p-0.5 sm:p-1 rounded-md border", badge.color)}>
                                      {React.cloneElement(badge.icon as React.ReactElement, { className: "w-2.5 h-2.5 sm:w-3 sm:h-3" })}
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-5 hidden sm:table-cell">
                          <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border", (player as any).title.color)}>
                            {(player as any).title.name}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-5 text-right">
                          <span className="text-sm sm:text-lg font-black text-white">{(player as any).totalPoints}</span>
                        </td>
                        <td className="px-3 sm:px-6 py-5 text-center">
                          <button 
                            onClick={() => toggleCompare(player)}
                            className={cn(
                              "compare-btn p-1.5 sm:p-2 rounded-xl border transition-all",
                              isComparing ? "bg-red-600 border-red-600 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                            )}
                          >
                            <Sword className="w-3.5 h-3.5 sm:w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-8">
            <RecentActivity activities={activities} t={t} />
          </div>
        </div>
      </div>
    );
  }

  // Category View - Horizontal Tier Columns
  const tierNumbers = [1, 2, 3, 4, 5];

  return (
    <div className="p-4 sm:p-8 max-w-full mx-auto space-y-8 sm:space-y-12">
      <div className="flex overflow-x-auto gap-6 sm:gap-8 pb-8 custom-scrollbar scroll-smooth">
        {tierNumbers.map((num) => {
          const htPlayers = playersByTier[`HT${num}`] || [];
          const ltPlayers = playersByTier[`LT${num}`] || [];
          
          // Sort HT and LT separately by total points, then combine (HT first)
          const allPlayersInTier = [
            ...htPlayers.sort((a: any, b: any) => b.totalPoints - a.totalPoints),
            ...ltPlayers.sort((a: any, b: any) => b.totalPoints - a.totalPoints)
          ];

          return (
            <div key={num} className="min-w-[300px] sm:min-w-[380px] flex-shrink-0 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">
                  Tier {num}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{allPlayersInTier.length} Players</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-[2rem] p-3 sm:p-4 hover:bg-zinc-800/40 transition-all duration-300 shadow-xl min-h-[500px]">
                <div className="space-y-2">
                  {allPlayersInTier.map((player: any) => {
                    const tierId = player.rankings[activeCategory];
                    const isHT = tierId?.startsWith('HT');
                    const isOwner = player.badges?.includes('owner');
                    
                    return (
                      <div 
                        key={player.id} 
                        onClick={() => onPlayerClick(player)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-2xl border transition-all duration-500 cursor-pointer group relative overflow-hidden",
                          isOwner ? "bg-amber-400/10 border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.2)]" :
                          isHT 
                            ? "bg-amber-400/5 border-amber-400/10 hover:border-amber-400/40 hover:bg-amber-400/10" 
                            : "bg-blue-400/5 border-blue-400/10 hover:border-blue-400/40 hover:bg-blue-400/10"
                        )}
                      >
                        {/* Background Glow */}
                        <div className={cn(
                          "absolute -right-4 -top-4 w-16 h-16 blur-2xl opacity-20 transition-opacity group-hover:opacity-40",
                          isOwner || isHT ? "bg-amber-400" : "bg-blue-400"
                        )} />

                        <div className="flex items-center gap-3 relative z-10">
                          {isOwner && (
                            <motion.div 
                              animate={{ opacity: [0.2, 0.5, 0.2] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute inset-x-0 -bottom-2 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"
                            />
                          )}
                          <div 
                            className="flex items-end justify-center relative overflow-hidden rounded-xl bg-white/5"
                            style={{ width: `${skinConfig.category.width}px`, height: `${skinConfig.category.height}px` }}
                          >
                            <MinecraftSkin 
                              name={player.name} 
                              width={skinConfig.category.width} 
                              height={skinConfig.category.height}
                              animated={false}
                              rotationY={skinConfig.category.rotationY}
                              zoom={skinConfig.category.zoom}
                              offsetY={skinConfig.category.offsetY}
                              className="pointer-events-none"
                              style={{ 
                                transform: `scale(${skinConfig.category.scale}) translateY(${skinConfig.category.translateY}px)` 
                              }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-sm font-black tracking-tight group-hover:text-white transition-colors flex items-center gap-1.5",
                              isOwner ? "text-amber-400" : "text-white"
                            )}>
                              {player.name}
                              {isOwner && <Crown className="w-3 h-3 text-amber-400 animate-pulse" />}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
                                isHT ? "text-amber-400 border-amber-400/20 bg-amber-400/10" : "text-blue-400 border-blue-400/20 bg-blue-400/10"
                              )}>
                                {tierId}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right relative z-10">
                          <div className="text-xs font-black text-white mb-0.5">{player.totalPoints}</div>
                          <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Points</div>
                        </div>
                      </div>
                    );
                  })}
                  {allPlayersInTier.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center opacity-20">
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-700 mb-4" />
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Empty Tier</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredPlayers.length === 0 &&
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800">
            <Search className="w-10 h-10 text-zinc-700" />
          </div>
          <h3 className="text-xl font-bold text-zinc-300 mb-2">{t.noPlayers}</h3>
          <p className="text-zinc-500 max-w-xs">
            {t.noPlayersDesc}
          </p>
        </div>
      }
    </div>
  );
};

const Admin = ({ tiers, categories, players, seedData, updateRank, updatePose, t, skinConfig, setSkinConfig, saveSkinConfig, resetAllVotes }: any) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string, name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'skins'>('players');

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || isAdding) return;
    
    setIsAdding(true);
    const name = newPlayerName.trim();
    const uuid = name.toLowerCase().replace(/\s+/g, '_');
    const skinUrl = `https://mc-heads.net/player/${name}/100`;

    try {
      await setDoc(doc(db, 'players', uuid), {
        name,
        uuid,
        skinUrl,
        rankings: {},
        updatedAt: new Date().toISOString()
      });
      setNewPlayerName('');
      setStatus({ type: 'success', message: t.status.added.replace('{name}', name) });
    } catch (error) {
      setStatus({ type: 'error', message: `${t.status.errorAdd}: ${error instanceof Error ? error.message : '?'}` });
    } finally {
      setIsAdding(false);
    }
  };

  const confirmDelete = async () => {
    if (!playerToDelete) return;
    try {
      await deleteDoc(doc(db, 'players', playerToDelete.id));
      setStatus({ type: 'success', message: t.status.deleted.replace('{name}', playerToDelete.name) });
    } catch (error) {
      setStatus({ type: 'error', message: `${t.status.errorDelete}: ${error instanceof Error ? error.message : '?'}` });
    } finally {
      setPlayerToDelete(null);
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-12">
      {/* Status Message */}
      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className={cn(
              "fixed top-28 right-10 z-[60] px-8 py-4 rounded-2xl font-black shadow-2xl border backdrop-blur-xl uppercase tracking-widest text-xs",
              status.type === 'success' ? "bg-green-500/10 border-green-500/50 text-green-500" : "bg-red-500/10 border-red-500/50 text-red-500"
            )}
          >
            {status.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {playerToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-red-600" />
              <div className="w-20 h-20 bg-red-600/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black mb-3 tracking-tight">{t.deleteConfirmTitle}</h3>
              <p className="text-zinc-500 mb-10 leading-relaxed">{t.deleteConfirmDesc.replace('{name}', playerToDelete.name)}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setPlayerToDelete(null)}
                  className="flex-1 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl font-black transition-all border border-white/5"
                >
                  {t.cancel}
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-8 py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-black transition-all shadow-lg shadow-red-900/20"
                >
                  {t.delete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('players')}
          className={cn(
            "px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border",
            activeTab === 'players' ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/20" : "bg-white/5 border-white/5 text-zinc-500 hover:text-white"
          )}
        >
          Manage Players
        </button>
        <button 
          onClick={() => setActiveTab('skins')}
          className={cn(
            "px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border",
            activeTab === 'skins' ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/20" : "bg-white/5 border-white/5 text-zinc-500 hover:text-white"
          )}
        >
          Skin Tuning
        </button>
      </div>

      {activeTab === 'players' ? (
        <>
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
              <h3 className="text-2xl sm:text-3xl font-black flex items-center gap-4 tracking-tighter">
                <div className="p-3 bg-red-600/10 rounded-2xl border border-red-500/20">
                  <Plus className="w-6 h-6 text-red-500" />
                </div>
                {t.addNewPlayer}
              </h3>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button 
                  onClick={async () => {
                    const success = await seedData();
                    if (success) setStatus({ type: 'success', message: t.status.seedSuccess });
                  }}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all border border-white/5 uppercase tracking-widest"
                  title={t.updateSeed}
                >
                  <Database className="w-4 h-4 text-red-500" />
                  {t.updateSeed}
                </button>
                <button 
                  onClick={async () => {
                    const success = await resetAllVotes();
                    if (success) setStatus({ type: 'success', message: 'Все голоса сброшены!' });
                  }}
                  className="px-6 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all border border-red-500/20 uppercase tracking-widest"
                >
                  <Trash2 className="w-4 h-4" />
                  Сбросить голоса
                </button>
              </div>
            </div>
            <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                placeholder={t.nicknamePlaceholder}
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="flex-1 bg-black/40 border border-white/5 rounded-[1.5rem] px-8 py-5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all font-bold placeholder:text-zinc-700"
              />
              <button 
                type="submit"
                disabled={isAdding}
                className="w-full sm:w-auto px-10 py-5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white font-black rounded-[1.5rem] transition-all shadow-xl shadow-red-900/20 uppercase tracking-widest text-sm"
              >
                {isAdding ? t.adding : t.add}
              </button>
            </form>
          </div>

          <div className="bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <h3 className="font-black text-xl tracking-tight">{t.managePlayers} <span className="text-red-500 ml-2 opacity-50">{players.length}</span></h3>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t.player}</th>
                    {categories.map((cat: any) => (
                      <th key={cat.id} className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center">{cat.name}</th>
                    ))}
                    <th className="px-8 py-5 text-right text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player: any) => (
                    <tr key={player.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <img 
                            src={`https://visage.surgeplay.com/face/64/${player.name || 'Steve'}`} 
                            className="w-8 h-8 object-contain drop-shadow-md group-hover:scale-110 transition-transform" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://visage.surgeplay.com/face/64/Steve'; }}
                          />
                          <span className="font-black text-sm tracking-tight group-hover:text-white transition-colors">{player.name}</span>
                        </div>
                      </td>
                      {categories.map((cat: any) => (
                        <td key={cat.id} className="px-8 py-6">
                          <select 
                            className="bg-black/40 border border-white/5 text-[10px] font-black rounded-xl p-2 outline-none focus:border-red-500/50 transition-all w-full appearance-none text-center cursor-pointer hover:bg-black/60"
                            value={player.rankings[cat.id] || ''}
                            onChange={(e) => updateRank(player.id, cat.id, e.target.value)}
                          >
                            <option value="">--</option>
                            {tiers.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => setPlayerToDelete({ id: player.id, name: player.name })}
                          className="p-3 bg-red-500/5 hover:bg-red-500/20 text-zinc-600 hover:text-red-500 rounded-xl transition-all border border-white/5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SkinTuner 
            title="Global Top Settings" 
            config={skinConfig.global} 
            onChange={(newVal: any) => setSkinConfig({ ...skinConfig, global: newVal })} 
          />
          <SkinTuner 
            title="Category Settings" 
            config={skinConfig.category} 
            isCategory 
            onChange={(newVal: any) => setSkinConfig({ ...skinConfig, category: newVal })} 
          />
          <SkinTuner 
            title="Community MVP Settings" 
            config={skinConfig.mvp ?? { zoom: 0.45, offsetY: -10, width: 200, height: 200, scale: 1.2, translateY: 30 }} 
            onChange={(newVal: any) => setSkinConfig({ ...skinConfig, mvp: newVal })} 
          />
          
          <div className="lg:col-span-2 bg-zinc-900/40 border border-white/5 rounded-[2rem] p-8">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-black uppercase tracking-widest">Current Config JSON</h4>
              <button 
                onClick={async () => {
                  const success = await saveSkinConfig(skinConfig);
                  if (success) setStatus({ type: 'success', message: 'Settings saved to database!' });
                }}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                Save to Database
              </button>
            </div>
            <pre className="bg-black/40 p-6 rounded-2xl text-[10px] font-mono text-zinc-400 overflow-x-auto">
              {JSON.stringify(skinConfig, null, 2)}
            </pre>
            <p className="mt-4 text-xs text-zinc-500">Click "Save to Database" to apply these settings for all users permanently.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const SkinTuner = ({ title, config, onChange, isCategory = false }: any) => {
  const updateField = (field: string, value: number) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
      <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
        <Settings className="w-5 h-5 text-red-500" />
        {title}
      </h3>
      
      <div className="space-y-4">
        <TunerField label="3D Zoom" value={config.zoom} min={0.1} max={10} step={0.1} onChange={(v) => updateField('zoom', v)} />
        <TunerField label="3D Offset Y (Vertical)" value={config.offsetY} min={-400} max={400} step={1} onChange={(v) => updateField('offsetY', v)} />
        <TunerField label="Canvas Width" value={config.width} min={10} max={500} step={1} onChange={(v) => updateField('width', v)} />
        <TunerField label="Canvas Height" value={config.height} min={10} max={500} step={1} onChange={(v) => updateField('height', v)} />
        <TunerField label="CSS Scale" value={config.scale} min={0.1} max={5} step={0.1} onChange={(v) => updateField('scale', v)} />
        <TunerField label="CSS Y Position" value={config.translateY} min={-200} max={200} step={1} onChange={(v) => updateField('translateY', v)} />
        {isCategory && (
          <TunerField label="3D Rotation Y" value={config.rotationY} min={-Math.PI} max={Math.PI} step={0.1} onChange={(v) => updateField('rotationY', v)} />
        )}
      </div>

      <div className="pt-6 border-t border-white/5 flex items-center justify-center">
        <div 
          className="bg-black/40 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5 relative"
          style={{ width: `${config.width}px`, height: `${config.height}px` }}
        >
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/5 pointer-events-none" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/5 pointer-events-none" />
          <MinecraftSkin 
            name="Steve" 
            width={config.width} 
            height={config.height}
            animated={!isCategory}
            rotationY={config.rotationY || 0}
            zoom={config.zoom}
            offsetY={config.offsetY}
            style={{ 
              transform: `scale(${config.scale}) translateY(${config.translateY}px)` 
            }}
          />
        </div>
      </div>
    </div>
  );
};

const TunerField = ({ label, value, min, max, step, onChange }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
    <div className="flex gap-4 items-center">
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-red-600 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
      />
      <input 
        type="number" 
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[10px] font-mono text-center focus:outline-none focus:border-red-500/50"
      />
    </div>
  </div>
);
