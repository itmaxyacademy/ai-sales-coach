// D:\sales-ai-coach\sales-ai-coach\Frontend\config\themes.ts
import { 
  Sun, Moon, Zap, Leaf, GraduationCap, Award, Flame, Snowflake, 
  Database, Bot, BrainCircuit, Cpu, BookOpen, MessageCircle, Send, Camera 
} from "lucide-react";

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  previewColors: {
    bg: string;
    surface: string;
    accent: string;
    text: string;
  };
}

export const AVAILABLE_THEMES: ThemePreset[] = [
  {
    id: "light",
    label: "Antigravity Light",
    description: "Nuansa putih bersih dengan sentuhan biru lembut yang nyaman di siang hari.",
    icon: Sun,
    iconClass: "text-amber-500",
    previewColors: { bg: "#f8f9fa", surface: "#ffffff", accent: "#5c8bd6", text: "#111827" }
  },
  {
    id: "dark",
    label: "Deep Dark",
    description: "Nuansa gelap arang netral untuk mengurangi ketegangan mata di malam hari.",
    icon: Moon,
    iconClass: "text-indigo-400",
    previewColors: { bg: "#1a1a1a", surface: "#222222", accent: "#4a9eff", text: "#e8e8e8" }
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk Neon",
    description: "Tema futuristik retro dengan aksen warna pink neon dan ungu tua.",
    icon: Zap,
    iconClass: "text-pink-500",
    previewColors: { bg: "#0b0914", surface: "#130f26", accent: "#ff007f", text: "#ffffff" }
  },
  {
    id: "forest",
    label: "Forest Emerald",
    description: "Warna hijau botol dan sage yang menenangkan dengan estetika organik.",
    icon: Leaf,
    iconClass: "text-emerald-500",
    previewColors: { bg: "#0f1712", surface: "#16221a", accent: "#10b981", text: "#ecfdf5" }
  },
  {
    id: "maxy",
    label: "Maxy Academy",
    description: "Palet korporat premium Maxy Academy dengan kombinasi Deep Navy dan Bright Gold.",
    icon: GraduationCap,
    iconClass: "text-amber-400",
    previewColors: { bg: "#0a1128", surface: "#101f42", accent: "#f4b905", text: "#ffffff" }
  },
  {
    id: "teal-neon",
    label: "Teal Matrix",
    description: "Ekstraksi palet warna dari avatar profil, memadukan Dark Teal dengan aksen Electric Cyan.",
    icon: Award,
    iconClass: "text-cyan-400",
    previewColors: { bg: "#061314", surface: "#0d2527", accent: "#00e5ff", text: "#e0f7fa" }
  },
  {
    id: "dracula",
    label: "Dracula Vampire",
    description: "Tema legendaris para developer dengan latar belakang gothic dan aksen ungu-pink lembut.",
    icon: Flame,
    iconClass: "text-purple-400",
    previewColors: { bg: "#282a36", surface: "#343746", accent: "#ff79c6", text: "#f8f8f2" }
  },
  {
    id: "nordic",
    label: "Nordic Frost",
    description: "Palet dingin khas hawa kutub es, menyejukkan mata dengan paduan warna biru pastel.",
    icon: Snowflake,
    iconClass: "text-sky-300",
    previewColors: { bg: "#2e3440", surface: "#3b4252", accent: "#88c0d0", text: "#eceff4" }
  },
  
  // --- TEMA BARU (SANTAI & KALEM) ---
  {
    id: "mongo-leaf",
    label: "Mongo Leaf",
    description: "Gelap natural khas MongoDB. Menggunakan hijau daun yang kalem pada background dark teal.",
    icon: Database,
    iconClass: "text-[#00ed64]",
    previewColors: { bg: "#001e2b", surface: "#002a3a", accent: "#00ed64", text: "#e8eee6" }
  },
  {
    id: "gpt-slate",
    label: "GPT Slate",
    description: "Abu-abu netral nan elegan terinspirasi ChatGPT, cocok untuk fokus mengetik berjam-jam.",
    icon: Bot,
    iconClass: "text-[#10a37f]",
    previewColors: { bg: "#212121", surface: "#2f2f2f", accent: "#10a37f", text: "#ececec" }
  },
  {
    id: "claude-anthracite",
    label: "Claude Anthracite",
    description: "Estetika hangat khas Claude. Paduan abu-abu kecokelatan (warm gray) dengan aksen clay peach.",
    icon: BrainCircuit,
    iconClass: "text-[#d97757]",
    previewColors: { bg: "#292524", surface: "#332f2d", accent: "#d97757", text: "#f5f5f4" }
  },
  {
    id: "cerebras-coral",
    label: "Cerebras Coral",
    description: "Hitam tech-sleek ala AI Cerebras dengan letupan warna coral (salmon pink) yang futuristik.",
    icon: Cpu,
    iconClass: "text-[#ff5a5f]",
    previewColors: { bg: "#0f0f0f", surface: "#1a1a1a", accent: "#ff5a5f", text: "#f1f1f1" }
  },
  {
    id: "notebook-calm",
    label: "Notebook Calm",
    description: "Mode terang super lembut ala Google NotebookLM. Bersih bak kertas dengan aksen biru edukasi.",
    icon: BookOpen,
    iconClass: "text-[#4285f4]",
    previewColors: { bg: "#f9fbfd", surface: "#ffffff", accent: "#4285f4", text: "#202124" }
  },
  {
    id: "wa-emerald",
    label: "WA Emerald Night",
    description: "Dark mode familiar ala WhatsApp. Nuansa hijau-biru tua (slate-teal) yang tidak menyilaukan mata.",
    icon: MessageCircle,
    iconClass: "text-[#00a884]",
    previewColors: { bg: "#111b21", surface: "#202c33", accent: "#00a884", text: "#e9edef" }
  },
  {
    id: "tele-night",
    label: "Tele Sky Night",
    description: "Biru dongker khas Telegram dengan aksen biru langit yang bersih dan sangat responsif.",
    icon: Send,
    iconClass: "text-[#3390ec]",
    previewColors: { bg: "#0e1621", surface: "#17212b", accent: "#3390ec", text: "#f5f5f5" }
  },
  {
    id: "insta-twilight",
    label: "Insta Twilight",
    description: "Solid black ala Instagram dengan sentuhan gradasi pink-magenta yang pop out.",
    icon: Camera,
    iconClass: "text-[#E1306C]",
    previewColors: { bg: "#000000", surface: "#121212", accent: "#E1306C", text: "#fafafa" }
  }
];