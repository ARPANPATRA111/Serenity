'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useRef, useEffect, useState } from 'react';
import { 
  FileSpreadsheet, Shield, Zap, Download, QrCode, ArrowRight, Star,
  ChevronRight, Paintbrush, Check, Sparkles, Globe, Lock, Award, Users, Clock,
  Mail, Verified, BadgeCheck, Layers, Palette, Database, CloudUpload, FileCheck
} from 'lucide-react';

function useStats() {
  const [stats, setStats] = useState({
    certificatesGenerated: 10000,
    usersRegistered: 5000,
  });

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch(() => {
      });
  }, []);

  return stats;
}

const AnimatedBackground = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Static mesh gradient background - uses CSS animations for performance */}
      <div className="absolute inset-0">
        <div 
          className="absolute top-0 -left-1/4 w-[80%] h-[80%] rounded-full blur-3xl animate-blob"
          style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.15) 50%, rgba(236, 72, 153, 0.1) 100%)' }}
        />
        <div 
          className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl animate-blob animation-delay-2000"
          style={{ background: 'linear-gradient(225deg, rgba(34, 211, 238, 0.2) 0%, rgba(99, 102, 241, 0.15) 50%, rgba(168, 85, 247, 0.1) 100%)' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full blur-3xl animate-pulse-slow"
          style={{ background: 'radial-gradient(circle, rgba(251, 146, 60, 0.12) 0%, transparent 70%)' }}
        />
      </div>

      {/* Minimal floating particles - reduced count for performance */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 animate-float"
          style={{
            left: `${(i * 8) + 5}%`,
            top: `${(i * 7) % 100}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${8 + (i % 4) * 2}s`,
          }}
        />
      ))}

      {/* Static geometric shapes with CSS animations */}
      <div className="absolute top-20 right-[10%] w-20 h-20 border-2 border-primary/15 rounded-xl animate-spin-slow hidden sm:block" />
      <div className="absolute bottom-40 left-[15%] w-16 h-16 border-2 border-accent/15 rounded-full animate-pulse-slow hidden sm:block" />
      <div className="absolute top-1/3 right-[20%] w-12 h-12 bg-gradient-to-br from-yellow-400/15 to-orange-500/15 rounded-lg animate-bounce-slow hidden md:block" />

      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
};

const SerenityLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" className="fill-primary"/>
    <path 
      d="M14 16C14 16 18 14 24 14C30 14 34 17 34 21C34 24 31 26 26 26H22C17 26 14 29 14 32C14 36 18 38 24 38C30 38 34 36 34 36" 
      stroke="white" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      fill="none"
    />
    <circle cx="35" cy="16" r="4" fill="white" fillOpacity="0.9"/>
  </svg>
);

const Counter = ({ end, suffix = '' }: { end: number; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let current = 0;
    const increment = end / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 40);
    return () => clearInterval(timer);
  }, [isInView, end]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

const FeatureCard = ({ feature, index }: { feature: typeof features[0]; index: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="group relative"
    >
      <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-primary/30 via-secondary/15 to-accent/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
      <div className="relative h-full p-6 sm:p-7 rounded-3xl bg-card backdrop-blur-sm border border-border hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-lg">
        <div className={`inline-flex p-3 sm:p-3.5 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 sm:mb-5 shadow-lg group-hover:scale-105 transition-transform duration-300`}>
          <feature.icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-base sm:text-lg font-bold mb-2 text-foreground group-hover:text-primary transition-colors">{feature.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
      </div>
    </motion.div>
  );
};

const features = [
  { icon: Paintbrush, title: 'Visual Editor', description: 'Intuitive drag-and-drop interface with real-time preview and pixel-perfect control.', gradient: 'from-violet-500 to-purple-600' },
  { icon: FileSpreadsheet, title: 'Smart Data Import', description: 'AI-powered Excel and CSV parsing with automatic column detection.', gradient: 'from-blue-500 to-cyan-500' },
  { icon: Zap, title: 'Blazing Fast', description: 'Generate 10,000+ certificates in under a minute with parallel processing.', gradient: 'from-amber-500 to-orange-500' },
  { icon: QrCode, title: 'QR Verification', description: 'Unique QR codes that link to secure verification pages instantly.', gradient: 'from-emerald-500 to-teal-500' },
  { icon: Mail, title: 'Email Delivery', description: 'Auto-send certificates with PDF attachments to recipients.', gradient: 'from-pink-500 to-rose-500' },
  { icon: Shield, title: 'Privacy First', description: '100% client-side processing. Your data never leaves your browser.', gradient: 'from-indigo-500 to-blue-600' },
];

const comparisonData = [
  { feature: 'Visual drag-and-drop editor', serenity: true, others: false },
  { feature: 'QR code verification', serenity: true, others: false },
  { feature: 'Bulk email delivery', serenity: true, others: 'Premium' },
  { feature: 'Data stays on device', serenity: true, others: false },
  { feature: 'Free tier', serenity: 'Unlimited', others: 'Limited' },
  { feature: 'PDF attachments in emails', serenity: true, others: false },
];

const testimonials = [
  { name: 'Sarah Chen', role: 'Training Director', company: 'TechCorp', content: 'Generated 5,000 certificates in under 2 minutes. The QR verification feature saved us hours of manual work.', avatar: 'SC', rating: 5 },
  { name: 'Michael Rivera', role: 'Event Manager', company: 'Global Events', content: 'The email delivery with PDF attachments is incredible. Our attendees love getting their certificates instantly.', avatar: 'MR', rating: 5 },
  { name: 'Emily Watson', role: 'HR Lead', company: 'StartupXYZ', content: 'Beautiful templates, intuitive editor, and zero learning curve. We switched from three other tools to Serenity.', avatar: 'EW', rating: 5 },
];

const typingWords = ['Certificates', 'Awards', 'Badges'];

const TypingText = () => {
  const [currentWord, setCurrentWord] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const word = typingWords[currentWord];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < word.length) {
          setDisplayText(word.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 1500);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(word.slice(0, displayText.length - 1));
        } else {
          setIsDeleting(false);
          setCurrentWord((prev) => (prev + 1) % typingWords.length);
        }
      }
    }, isDeleting ? 50 : 100);
    
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentWord]);
  
  return (
    <span className="inline">
      {displayText}
      <span className="animate-pulse text-primary">|</span>
    </span>
  );
};

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.4], [1, 0.95]);
  const stats = useStats();

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      <AnimatedBackground />
      
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 pt-3"
      >
        <nav className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 rounded-xl bg-background/80 backdrop-blur-xl border border-border shadow-lg shadow-black/5">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <Award className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">Serenity</span>
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <Link href="/login" className="px-2.5 sm:px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                Log in
              </Link>
              <Link href="/signup" className="px-3 sm:px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </motion.header>

      <section ref={heroRef} className="min-h-screen flex items-center justify-center pt-24 sm:pt-20 pb-16 sm:pb-24 px-5 sm:px-4">
        <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          {/* Animated Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/30 mb-8 shadow-lg shadow-primary/10"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
            <span className="text-xs sm:text-sm font-bold text-primary uppercase tracking-wide">Version 2.0 — QR Verification</span>
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </motion.div>

          {/* Headline with typing animation - inline layout */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.8, type: "spring" }}
            className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 leading-tight"
          >
            <span className="text-foreground drop-shadow-sm">Create Certificates</span>
            <span className="bg-gradient-to-r from-primary via-purple-500 to-accent bg-clip-text text-transparent">
              {/* <TypingText /> */}
              
            </span>
            <br />
            <span className="text-gradient-shift">
              at Lightning Speed
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Design stunning certificates, import your data, and generate 
            <span className="text-foreground font-semibold"> thousands of verifiable documents </span>
            in seconds.
          </motion.p>

          {/* CTA Buttons with enhanced styling */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <motion.div 
              whileHover={{ scale: 1.03, y: -2 }} 
              whileTap={{ scale: 0.98 }}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-accent rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
              <Link href="/dashboard" className="relative flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold shadow-2xl transition-all">
                Start Creating Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link href="/verify" className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white/80 dark:bg-slate-800/80 text-foreground font-bold border-2 border-border hover:border-primary/60 transition-all backdrop-blur-sm shadow-lg">
                <QrCode className="w-5 h-5 text-primary" />
                Verify Certificate
              </Link>
            </motion.div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground mb-16"
          >
            {[
              { icon: Check, text: 'No credit card required' },
              { icon: Lock, text: '100% private & secure' },
              { icon: Globe, text: 'Works everywhere' },
            ].map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-slate-800/60 border border-border shadow-sm backdrop-blur-sm"
              >
                <item.icon className="w-4 h-4 text-green-500" />
                <span className="font-medium">{item.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Product Preview Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-purple-500/20 to-accent/20 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border-2 border-border bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Browser Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-slate-100/80 dark:bg-slate-800/80">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="max-w-sm mx-auto px-4 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-xs text-muted-foreground text-center">
                    serenity.app/editor
                  </div>
                </div>
              </div>
              {/* Editor Preview */}
              <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="flex gap-4">
                  {/* Sidebar */}
                  <div className="hidden sm:flex flex-col gap-2 w-12">
                    {[Paintbrush, FileSpreadsheet, QrCode, Download].map((Icon, i) => (
                      <motion.div 
                        key={i}
                        className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-border flex items-center justify-center shadow-sm"
                        whileHover={{ scale: 1.05 }}
                      >
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
                    ))}
                  </div>
                  {/* Canvas */}
                  <div className="flex-1 aspect-[16/10] rounded-xl bg-white dark:bg-slate-800 border border-border shadow-inner flex items-center justify-center">
                    <div className="text-center p-8">
                      <motion.div 
                        className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity }}
                      >
                        <Award className="w-8 h-8 text-white" />
                      </motion.div>
                      <div className="text-lg font-bold text-foreground">Certificate Preview</div>
                      <div className="text-sm text-muted-foreground mt-1">Your design appears here</div>
                    </div>
                  </div>
                  {/* Properties */}
                  <div className="hidden md:flex flex-col gap-2 w-40">
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-border">
                      <div className="text-xs font-semibold mb-2 text-foreground">Properties</div>
                      <div className="space-y-2">
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-border">
                      <div className="text-xs font-semibold mb-2 text-foreground">Data</div>
                      <div className="space-y-2">
                        <div className="h-2 bg-primary/30 rounded w-full" />
                        <div className="h-2 bg-accent/30 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="py-20 border-y border-border/30 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
            {[
              { value: stats.certificatesGenerated, suffix: '+', label: 'Certificates Generated', icon: Award },
              { value: stats.usersRegistered, suffix: '+', label: 'Happy Users', icon: Users },
              { value: 99, suffix: '%', label: 'Uptime Guarantee', icon: Clock },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 sm:bg-transparent sm:border-none sm:p-0"
              >
                <div className="inline-flex p-3 rounded-xl bg-primary/15 mb-4">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-2 text-foreground">
                  <Counter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-28">
        <div className="max-w-5xl mx-auto px-5 sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-4 uppercase tracking-wide">
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 text-foreground">Everything you need</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-base sm:text-lg">Powerful tools to create and distribute certificates at any scale.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-28 bg-muted/30 relative">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wide">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold">Three simple steps</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 relative">
            <div className="hidden md:block absolute top-14 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            
            {[
              { num: '01', title: 'Design', desc: 'Create your template visually with our drag-and-drop editor' },
              { num: '02', title: 'Import', desc: 'Upload your Excel or CSV data with smart column detection' },
              { num: '03', title: 'Generate', desc: 'Download all certificates as PDF or ZIP in seconds' },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="text-center p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 md:bg-transparent md:border-none md:p-0"
              >
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary to-accent text-white text-xl md:text-2xl font-bold mb-4 md:mb-6 shadow-xl shadow-primary/30"
                >
                  {step.num}
                </motion.div>
                <h3 className="text-lg md:text-xl font-bold mb-2 text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-28">
        <div className="max-w-5xl mx-auto px-5 sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-4 uppercase tracking-wide">
              Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground">Loved by teams worldwide</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {testimonials.map((t, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-5 sm:p-6 rounded-2xl bg-card backdrop-blur-sm border border-border hover:border-primary/40 transition-all shadow-sm hover:shadow-md group"
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm sm:text-base mb-5 text-foreground leading-relaxed">&ldquo;{t.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shadow-md group-hover:scale-105 transition-transform">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role} at {t.company}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-28 bg-muted/30">
        <div className="max-w-4xl mx-auto px-5 sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-4 uppercase tracking-wide">
              Why Serenity
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-4">The smarter choice</h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">See how Serenity compares to traditional certificate tools</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg"
          >
            <div className="grid grid-cols-3 gap-px bg-border">
              <div className="p-4 sm:p-5 bg-card font-semibold text-foreground">Feature</div>
              <div className="p-4 sm:p-5 bg-gradient-to-br from-primary/10 to-accent/10 text-center">
                <span className="font-bold text-primary">Serenity</span>
              </div>
              <div className="p-4 sm:p-5 bg-card text-center text-muted-foreground font-medium">Others</div>
            </div>
            {comparisonData.map((row, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="grid grid-cols-3 gap-px bg-border"
              >
                <div className="p-4 sm:p-5 bg-card text-sm text-foreground">{row.feature}</div>
                <div className="p-4 sm:p-5 bg-gradient-to-br from-primary/5 to-accent/5 text-center">
                  {row.serenity === true ? (
                    <BadgeCheck className="w-5 h-5 mx-auto text-green-500" />
                  ) : (
                    <span className="text-sm font-semibold text-green-600">{row.serenity}</span>
                  )}
                </div>
                <div className="p-4 sm:p-5 bg-card text-center">
                  {row.others === false ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{row.others}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-16 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,white/20,transparent_50%)]" />
            
            <div className="relative px-6 sm:px-8 py-12 sm:py-16 text-center text-white">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4">Ready to get started?</h2>
              <p className="text-white/90 mb-8 max-w-md mx-auto text-sm sm:text-base">Join thousands of creators making professional certificates with Serenity.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link href="/signup" className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-primary font-semibold shadow-xl">
                    Get Started Free <ChevronRight className="w-4 h-4" />
                  </Link>
                </motion.div>
                <Link href="/templates" className="px-7 py-3.5 rounded-xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-all">
                  Browse Templates
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 sm:py-10 border-t border-border/40 bg-muted/20">
        <div className="max-w-5xl mx-auto px-5 sm:px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <Award className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Serenity</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
              <Link href="/templates" className="hover:text-foreground transition-colors">Templates</Link>
              <Link href="/verify" className="hover:text-foreground transition-colors">Verify</Link>
              <span className="hidden sm:inline">•</span>
              <span>© 2026 Serenity</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
