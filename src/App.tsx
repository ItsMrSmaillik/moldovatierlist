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
  Dna
} from 'lucide-react';
import { SkinViewer, WalkingAnimation, RunningAnimation, IdleAnimation, FlyingAnimation } from 'skinview3d';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch
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
}

// --- Constants ---
const CATEGORY_ICONS: Record<string, any> = {
  cpvp: Zap,
  uhc: Shield,
  sword: Sword,
  netheriteop: Trophy,
  macepvp: Zap,
  axe: Sword,
  pot: Shield,
  smp: User,
  global: Crown
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

const LOGO_URL = "https://image2url.com/r2/default/images/1775575217508-aaef880a-c87f-4210-b867-c9da797287b8.png";

const DEFAULT_TIERS: Tier[] = [
  { id: 'HT1', name: 'HT1', color: 'text-red-500 border-red-500 bg-red-500/10', order: 1, points: 100 },
  { id: 'LT1', name: 'LT1', color: 'text-red-400 border-red-400 bg-red-400/10', order: 2, points: 90 },
  { id: 'HT2', name: 'HT2', color: 'text-orange-500 border-orange-500 bg-orange-500/10', order: 3, points: 80 },
  { id: 'LT2', name: 'LT2', color: 'text-orange-400 border-orange-400 bg-orange-400/10', order: 4, points: 70 },
  { id: 'HT3', name: 'HT3', color: 'text-yellow-500 border-yellow-500 bg-yellow-500/10', order: 5, points: 60 },
  { id: 'LT3', name: 'LT3', color: 'text-yellow-400 border-yellow-400 bg-yellow-400/10', order: 6, points: 50 },
  { id: 'HT4', name: 'HT4', color: 'text-green-500 border-green-500 bg-green-500/10', order: 7, points: 40 },
  { id: 'LT4', name: 'LT4', color: 'text-green-400 border-green-400 bg-green-400/10', order: 8, points: 30 },
  { id: 'HT5', name: 'HT5', color: 'text-blue-500 border-blue-500 bg-blue-500/10', order: 9, points: 20 },
  { id: 'LT5', name: 'LT5', color: 'text-blue-400 border-blue-400 bg-blue-400/10', order: 10, points: 10 },
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

const MinecraftSkin = ({ name, pose, width = 300, height = 400, className = "" }: { name: string, pose: string, width?: number, height?: number, className?: string }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewerRef = React.useRef<SkinViewer | null>(null);

  React.useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      skin: `https://mc-heads.net/skin/${name}`
    });

    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;
    viewer.fov = 70;
    viewer.zoom = 0.9;

    switch (pose) {
      case 'walk':
        viewer.animation = new WalkingAnimation();
        break;
      case 'run':
        viewer.animation = new RunningAnimation();
        break;
      case 'fly':
        viewer.animation = new FlyingAnimation();
        break;
      case 'idle':
        viewer.animation = new IdleAnimation();
        break;
      default:
        viewer.autoRotate = false;
        break;
    }

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
    };
  }, [name, pose, width, height]);

  return <canvas ref={canvasRef} className={cn("cursor-grab active:cursor-grabbing", className)} />;
};

const PlayerModal = ({ player, tiers, categories, onClose, t, lang }: { 
  player: Player | null, 
  tiers: Tier[], 
  categories: Category[],
  onClose: () => void,
  t: any,
  lang: Language
}) => {
  if (!player) return null;

  const totalPoints = Object.entries(player.rankings).reduce((sum, [catId, tierId]) => {
    // Fallback to DEFAULT_TIERS if DB tier is missing points
    const tier = tiers.find(t => t.id === tierId) || DEFAULT_TIERS.find(t => t.id === tierId);
    return sum + (tier?.points || 0);
  }, 0);

  const titleData = TITLES.find(t => totalPoints >= t.min) || TITLES[TITLES.length - 1];
  const titleName = (t.titles as any)[titleData.id];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-[#0f0f0f] border border-zinc-800 rounded-[2rem] sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto"
      >
        <div className="relative h-32 sm:h-48 bg-gradient-to-br from-red-600/20 via-black to-zinc-900/40 overflow-hidden">
          <div className="tricolor-line absolute top-0 left-0 z-20">
            <div className="tricolor-blue" />
            <div className="tricolor-yellow" />
            <div className="tricolor-red" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-50" />
          <button 
            onClick={onClose}
            className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-zinc-400 hover:text-white transition-all border border-white/5 z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 sm:px-10 pb-8 sm:pb-10 -mt-12 sm:mt-[-5rem] relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-8 mb-8 sm:mb-10">
            <div className="relative group">
              <div className="absolute -inset-4 bg-red-600/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {['idle', 'walk', 'run', 'fly'].includes(player.pose) ? (
                <MinecraftSkin 
                  name={player.name} 
                  pose={player.pose} 
                  width={200} 
                  height={250} 
                  className="drop-shadow-[0_20px_50px_rgba(220,38,38,0.3)]"
                />
              ) : (
                <img 
                  src={`https://mc-heads.net/${player.pose || 'body'}/${player.name}/200`} 
                  alt={player.name} 
                  className="w-32 sm:w-40 h-auto drop-shadow-[0_20px_50px_rgba(220,38,38,0.3)] transform group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left pb-0 sm:pb-4">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tighter drop-shadow-sm">{player.name}</h2>
              <div className={cn(
                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-xl", 
                titleData.color
              )}>
                <Star className="w-3 h-3 fill-current" />
                {titleName}
              </div>
            </div>
            <div className="text-center sm:text-right pb-0 sm:pb-4">
              <p className="text-[8px] sm:text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-1">{t.totalPoints}</p>
              <p className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-red-500 to-red-800 bg-clip-text text-transparent drop-shadow-lg">{totalPoints}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {categories.map(cat => {
              const tierId = player.rankings[cat.id];
              const tier = tiers.find(t => t.id === tierId);
              return (
                <div key={cat.id} className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col items-center text-center group hover:bg-zinc-800/40 transition-all duration-300 hover:border-red-500/20">
                  <p className="text-[8px] sm:text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2 sm:mb-3 truncate w-full group-hover:text-zinc-400">{cat.name}</p>
                  <div className={cn(
                    "px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black border transition-all duration-300 shadow-lg",
                    tier ? tier.color : "text-zinc-700 border-zinc-800 bg-zinc-900/50"
                  )}>
                    {tier ? tier.name : "--"}
                  </div>
                </div>
              );
            })}
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
  const [activeCategory, setActiveCategory] = useState<string>('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email) {
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || "matvey.zingaliuk@gmail.com";
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

    return () => {
      unsubCategories();
      unsubTiers();
      unsubPlayers();
    };
  }, []);

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
    const base = activeCategory === 'global' ? leaderboard : players.filter(p => p.rankings[activeCategory]);
    
    return base
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (activeCategory === 'global') return (b as any).totalPoints - (a as any).totalPoints;
        const tierA = tiers.find(t => t.id === a.rankings[activeCategory])?.order || 999;
        const tierB = tiers.find(t => t.id === b.rankings[activeCategory])?.order || 999;
        return tierA - tierB;
      });
  }, [players, leaderboard, activeCategory, searchQuery, tiers]);

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

  const updateRank = async (playerId: string, categoryId: string, tierId: string) => {
    const player = players.find((p: any) => p.id === playerId);
    if (!player) return;
    const newRankings = { ...player.rankings, [categoryId]: tierId };
    try {
      await setDoc(doc(db, 'players', playerId), { ...player, rankings: newRankings }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${playerId}`);
    }
  };

  const updatePose = async (playerId: string, pose: string) => {
    try {
      await setDoc(doc(db, 'players', playerId), { pose }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${playerId}/pose`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse text-red-500 font-mono text-xl">LOADING MOLDOVA PVP...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-red-500/30">
        <AnimatePresence>
          {selectedPlayer && (
            <PlayerModal 
              player={selectedPlayer} 
              tiers={tiers} 
              categories={categories} 
              onClose={() => setSelectedPlayer(null)} 
              t={t}
              lang={lang}
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
              />
            } />
            <Route path="/admin-secret-access" element={
              isAdmin ? <Admin tiers={tiers} categories={categories} players={players} seedData={seedData} updateRank={updateRank} updatePose={updatePose} t={t} /> : (
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
          </Routes>
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
            <Crown className={cn("w-5 h-5 relative z-10", activeCategory === 'global' ? "text-white" : "text-zinc-600 group-hover:text-red-400")} />
            <span className="font-black text-sm relative z-10 tracking-tight">{t.globalLeaderboard}</span>
          </button>

          <div className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] px-5 mb-4">{t.categories}</div>
          <div className="space-y-1.5">
            {categories.map((cat: any) => {
              const Icon = CATEGORY_ICONS[cat.icon] || LayoutGrid;
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
                  <Icon className={cn("w-5 h-5 relative z-10 transition-colors", isActive ? "text-red-500" : "text-zinc-600 group-hover:text-zinc-400")} />
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
          <h2 className="text-xl sm:text-3xl font-black tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent truncate max-w-[150px] sm:max-w-none">
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

const Home = ({ activeCategory, tiers, filteredPlayers, playersByTier, onPlayerClick, t, players, categories }: any) => {
  if (activeCategory === 'global') {
    const leaderboard = [...filteredPlayers].sort((a, b) => b.totalPoints - a.totalPoints);
    
    return (
      <div className="p-4 sm:p-10 max-w-7xl mx-auto">
        {/* Hero Section for Global View */}
        <div className="mb-8 sm:mb-16 relative overflow-hidden rounded-[2rem] sm:rounded-[3rem] bg-gradient-to-br from-red-600/20 via-zinc-900/40 to-black border border-white/5 p-6 sm:p-12">
          <div className="absolute top-0 left-0 w-full h-1 flex">
            <div className="h-full w-1/3 bg-[#0046ae]" />
            <div className="h-full w-1/3 bg-[#ffd100]" />
            <div className="h-full w-1/3 bg-[#cc092f]" />
          </div>
          
          <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_top_right,_rgba(220,38,38,0.15),_transparent_70%)]" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] mb-6">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0046ae]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#ffd100]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#cc092f]" />
              </div>
              Moldova PvP Official
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white mb-4 sm:mb-6 leading-[0.9]">
              ULTIMATE <br />
              <span className="bg-gradient-to-r from-red-500 to-red-800 bg-clip-text text-transparent">LEADERBOARD</span>
            </h1>
            <p className="text-zinc-400 text-sm sm:text-lg font-medium leading-relaxed mb-6 sm:mb-8">
              The most accurate and up-to-date ranking of the best PvP players in Moldova. 
              Compete, climb the ranks, and become a legend.
            </p>
            <div className="flex gap-3 sm:gap-4">
              <div className="px-4 sm:px-6 py-2 sm:py-3 bg-white/5 border border-white/5 rounded-xl sm:rounded-2xl backdrop-blur-md">
                <p className="text-[8px] sm:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">{t.totalPlayers}</p>
                <p className="text-xl sm:text-2xl font-black text-white">{players.length}</p>
              </div>
              <div className="px-4 sm:px-6 py-2 sm:py-3 bg-white/5 border border-white/5 rounded-xl sm:rounded-2xl backdrop-blur-md">
                <p className="text-[8px] sm:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">{t.activeModes}</p>
                <p className="text-xl sm:text-2xl font-black text-white">{categories.length}</p>
              </div>
            </div>
          </div>
          
          {/* Decorative Player Skin */}
          {leaderboard.length > 0 && (
            <div className="absolute bottom-0 right-12 w-64 h-auto pointer-events-none hidden md:block">
              {['idle', 'walk', 'run', 'fly'].includes(leaderboard[0].pose) ? (
                <div className="transform translate-y-12 rotate-[-5deg]">
                  <MinecraftSkin 
                    name={leaderboard[0].name} 
                    pose={leaderboard[0].pose} 
                    width={350} 
                    height={500} 
                    className="drop-shadow-[0_20px_50px_rgba(220,38,38,0.4)]"
                  />
                </div>
              ) : (
                <img 
                  src={`https://mc-heads.net/${leaderboard[0].pose || 'body'}/${leaderboard[0].name}/400`} 
                  alt="Top Player" 
                  className="w-full h-auto drop-shadow-[0_20px_50px_rgba(220,38,38,0.4)] transform translate-y-12 rotate-[-5deg]"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          )}
        </div>

        <div className="bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-6 sm:p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h3 className="font-black text-lg sm:text-xl tracking-tight flex items-center gap-3">
              <Crown className="w-5 h-5 sm:w-6 h-6 text-yellow-500" />
              {t.globalLeaderboard}
            </h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 sm:px-8 py-4 sm:py-5 text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] w-16 sm:w-20">{t.rank}</th>
                  <th className="px-6 sm:px-8 py-4 sm:py-5 text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t.player}</th>
                  <th className="px-6 sm:px-8 py-4 sm:py-5 text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] hidden sm:table-cell">{t.title}</th>
                  <th className="px-6 sm:px-8 py-4 sm:py-5 text-right text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t.points}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player: any, index: number) => (
                  <tr 
                    key={player.id} 
                    onClick={() => onPlayerClick(player)}
                    className="border-b border-zinc-800/50 hover:bg-red-600/5 transition-all duration-300 cursor-pointer group"
                  >
                    <td className="px-6 sm:px-8 py-4 sm:py-6">
                      <span className={cn(
                        "inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm transition-all duration-300 group-hover:scale-110",
                        index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]" :
                        index === 1 ? "bg-gradient-to-br from-zinc-200 to-zinc-400 text-black" :
                        index === 2 ? "bg-gradient-to-br from-orange-500 to-orange-700 text-white" : "bg-zinc-800/50 text-zinc-500"
                      )}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 sm:px-8 py-4 sm:py-6">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-red-600/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                          <img 
                            src={`https://visage.surgeplay.com/${player.pose === 'head' || player.pose === 'avatar' ? 'face' : player.pose === 'bust' ? 'bust' : 'player'}/128/${player.name}`} 
                            className="w-8 h-8 sm:w-10 sm:h-10 object-contain relative z-10 drop-shadow-md group-hover:scale-110 transition-transform duration-300" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-sm sm:text-lg tracking-tight group-hover:text-white transition-colors">{player.name}</span>
                          <span className={cn("sm:hidden text-[8px] font-black uppercase tracking-widest", player.title.color)}>
                            {player.title.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-4 sm:py-6 hidden sm:table-cell">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-black/20 border border-white/5 text-[10px] font-black uppercase tracking-widest shadow-sm", 
                        player.title.color
                      )}>
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {player.title.name}
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-4 sm:py-6 text-right">
                      <span className="text-xl sm:text-2xl font-black bg-gradient-to-br from-red-400 to-red-600 bg-clip-text text-transparent drop-shadow-md">
                        {player.totalPoints}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Category View - 5 Column Table
  const htTiers = tiers.filter((t: any) => t.id.startsWith('HT'));
  const ltTiers = tiers.filter((t: any) => t.id.startsWith('LT'));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 sm:space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* HT Column */}
        <div className="space-y-4 sm:space-y-6">
          <h3 className="text-xl sm:text-2xl font-black text-red-500 uppercase tracking-tighter flex items-center gap-3">
            <Zap className="w-5 h-5 sm:w-6 h-6 fill-current" />
            {t.highTier}
          </h3>
          <div className="space-y-4">
            {htTiers.map((tier: any) => (
              <div key={tier.id} className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 hover:bg-zinc-800/40 transition-all duration-300 hover:border-red-500/20 shadow-xl">
                <div className={cn("inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black border mb-4 sm:mb-6 shadow-lg uppercase tracking-widest", tier.color)}>
                  <Zap className="w-3 h-3 fill-current" />
                  {tier.name}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {playersByTier[tier.id]?.map((player: any) => (
                    <div 
                      key={player.id} 
                      onClick={() => onPlayerClick(player)}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-black/40 border border-white/5 rounded-xl sm:rounded-2xl hover:border-red-500/50 transition-all duration-300 cursor-pointer group hover:bg-red-500/5"
                    >
                      <img 
                        src={`https://visage.surgeplay.com/${player.pose === 'head' || player.pose === 'avatar' ? 'face' : player.pose === 'bust' ? 'bust' : 'player'}/64/${player.name}`} 
                        className="w-6 h-6 sm:w-8 sm:h-8 object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300" 
                        referrerPolicy="no-referrer" 
                      />
                      <span className="text-[10px] sm:text-xs font-black truncate group-hover:text-red-400 transition-colors">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LT Column */}
        <div className="space-y-4 sm:space-y-6">
          <h3 className="text-xl sm:text-2xl font-black text-zinc-500 uppercase tracking-tighter flex items-center gap-3">
            <Shield className="w-5 h-5 sm:w-6 h-6" />
            {t.lowTier}
          </h3>
          <div className="space-y-4">
            {ltTiers.map((tier: any) => (
              <div key={tier.id} className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 hover:bg-zinc-800/40 transition-all duration-300 hover:border-zinc-500/20 shadow-xl">
                <div className={cn("inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black border mb-4 sm:mb-6 shadow-lg uppercase tracking-widest", tier.color)}>
                  <Shield className="w-3 h-3" />
                  {tier.name}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {playersByTier[tier.id]?.map((player: any) => (
                    <div 
                      key={player.id} 
                      onClick={() => onPlayerClick(player)}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-black/40 border border-white/5 rounded-xl sm:rounded-2xl hover:border-zinc-500/50 transition-all duration-300 cursor-pointer group hover:bg-zinc-500/5"
                    >
                      <img 
                        src={`https://visage.surgeplay.com/${player.pose === 'head' || player.pose === 'avatar' ? 'face' : player.pose === 'bust' ? 'bust' : 'player'}/64/${player.name}`} 
                        className="w-6 h-6 sm:w-8 sm:h-8 object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300" 
                        referrerPolicy="no-referrer" 
                      />
                      <span className="text-[10px] sm:text-xs font-black truncate group-hover:text-zinc-300 transition-colors">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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

const Admin = ({ tiers, categories, players, seedData, updateRank, updatePose, t }: any) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string, name: string } | null>(null);

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

      <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
          <h3 className="text-2xl sm:text-3xl font-black flex items-center gap-4 tracking-tighter">
            <div className="p-3 bg-red-600/10 rounded-2xl border border-red-500/20">
              <Plus className="w-6 h-6 text-red-500" />
            </div>
            {t.addNewPlayer}
          </h3>
          <button 
            onClick={async () => {
              const success = await seedData();
              if (success) setStatus({ type: 'success', message: t.status.seedSuccess });
            }}
            className="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all border border-white/5 uppercase tracking-widest"
            title={t.updateSeed}
          >
            <Database className="w-4 h-4 text-red-500" />
            {t.updateSeed}
          </button>
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
                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center">{t.pose}</th>
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
                      <img src={`https://visage.surgeplay.com/face/64/${player.name}`} className="w-8 h-8 object-contain drop-shadow-md group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                      <span className="font-black text-sm tracking-tight group-hover:text-white transition-colors">{player.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <select 
                      className="bg-black/40 border border-white/5 text-[10px] font-black rounded-xl p-2 outline-none focus:border-red-500/50 transition-all w-full appearance-none text-center cursor-pointer hover:bg-black/60"
                      value={player.pose || 'body'}
                      onChange={(e) => updatePose(player.id, e.target.value)}
                    >
                      {POSES.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
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
    </div>
  );
};
