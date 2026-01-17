'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useRef, useEffect, useState, useCallback } from 'react';
import { 
  FileSpreadsheet, Shield, Zap, Download, QrCode, ArrowRight, Star,
  ChevronRight, Paintbrush, Check, Sparkles, Globe, Lock, Award, Users, Clock, MousePointer2
} from 'lucide-react';

const InteractiveDotsBackground = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const dots = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    opacity: Math.random() * 0.4 + 0.15,
  }));

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full bg-indigo-500 dark:bg-indigo-400"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            opacity: dot.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 10, 0],
            opacity: [dot.opacity, dot.opacity * 1.8, dot.opacity],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 3,
          }}
        />
      ))}
      
      {/* Mouse follower spotlight */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
          left: mousePosition.x - 250,
          top: mousePosition.y - 250,
        }}
        animate={{
          left: mousePosition.x - 250,
          top: mousePosition.y - 250,
        }}
        transition={{ type: "spring", damping: 25, stiffness: 150 }}
      />
      
      {/* Gradient orbs */}
      <motion.div 
        className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 60%)' }}
        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute -bottom-1/4 -left-1/4 w-[700px] h-[700px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 60%)' }}
        animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(34, 211, 238, 0.06) 0%, transparent 60%)' }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Soft grid */}
      <div 
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(rgb(var(--color-foreground)) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
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
      <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-primary/20 via-secondary/10 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
      <div className="relative h-full p-7 rounded-3xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/40 transition-all duration-300">
        <div className={`inline-flex p-3.5 rounded-xl bg-gradient-to-br ${feature.gradient} mb-5 shadow-lg group-hover:scale-105 transition-transform duration-300`}>
          <feature.icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
      </div>
    </motion.div>
  );
};

const features = [
  { icon: Paintbrush, title: 'Visual Editor', description: 'Drag-and-drop interface with real-time preview.', gradient: 'from-violet-500 to-purple-600' },
  { icon: FileSpreadsheet, title: 'Smart Import', description: 'AI-powered Excel and CSV column detection.', gradient: 'from-blue-500 to-cyan-500' },
  { icon: Zap, title: 'Lightning Fast', description: 'Generate thousands of certificates in seconds.', gradient: 'from-amber-500 to-orange-500' },
  { icon: QrCode, title: 'QR Verification', description: 'Unique QR codes for instant verification.', gradient: 'from-emerald-500 to-teal-500' },
  { icon: Download, title: 'Multi-Format', description: 'Export as PDF, PNG, or bulk ZIP files.', gradient: 'from-pink-500 to-rose-500' },
  { icon: Shield, title: 'Privacy First', description: '100% local processing. Your data stays secure.', gradient: 'from-indigo-500 to-blue-600' },
];

const testimonials = [
  { name: 'Sarah Chen', role: 'Training Director', company: 'TechCorp', content: 'Generated 5,000 certificates in under 2 minutes.', avatar: 'SC' },
  { name: 'Michael R.', role: 'Event Manager', company: 'Global Events', content: 'QR verification is a game changer.', avatar: 'MR' },
  { name: 'Emily Watson', role: 'HR Manager', company: 'StartupXYZ', content: 'Beautiful templates, privacy-first approach.', avatar: 'EW' },
];

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.4], [1, 0.95]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <InteractiveDotsBackground />
      
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 px-4 pt-3"
      >
        <nav className="max-w-5xl mx-auto px-4 py-2.5 rounded-xl bg-background/70 backdrop-blur-xl border border-border/50 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <Award className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">Serenity</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/login" className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                Log in
              </Link>
              <Link href="/signup" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </motion.header>

      <section ref={heroRef} className="min-h-screen flex items-center justify-center pt-20 pb-24 px-4">
        <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Version 2.0 — QR Verification</span>
          </motion.div>

          {/* Headline with extra bottom padding */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.8 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 leading-[1.15] pb-2"
          >
            <span className="block text-foreground">Create Certificates</span>
            <span className="block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent pb-2">
              at Lightning Speed
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-base sm:text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed"
          >
            Design stunning certificates, import your data, and generate thousands of verifiable documents in seconds.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/dashboard" className="group flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35 transition-all">
                Start Creating Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/verify" className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-card/80 text-foreground font-semibold border border-border hover:border-primary/50 transition-all backdrop-blur-sm">
                <QrCode className="w-4 h-4 text-primary" />
                Verify Certificate
              </Link>
            </motion.div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
          >
            {[
              { icon: Check, text: 'No credit card' },
              { icon: Lock, text: '100% private' },
              { icon: Globe, text: 'Works everywhere' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <item.icon className="w-3.5 h-3.5 text-green-500" />
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <section className="py-20 border-y border-border/30 bg-muted/20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: 1000000, suffix: '+', label: 'Certificates', icon: Award },
              { value: 10000, suffix: '+', label: 'Users', icon: Users },
              { value: 99, suffix: '%', label: 'Uptime', icon: Clock },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-4">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold mb-1">
                  <Counter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wide">
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">Everything you need</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Powerful tools to create and distribute certificates at any scale.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 bg-muted/20 relative">
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

          <div className="grid md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute top-14 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            
            {[
              { num: '01', title: 'Design', desc: 'Create your template visually' },
              { num: '02', title: 'Import', desc: 'Upload your Excel or CSV' },
              { num: '03', title: 'Generate', desc: 'Download all certificates' },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="text-center"
              >
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent text-white text-2xl font-bold mb-6 shadow-xl shadow-primary/25"
                >
                  {step.num}
                </motion.div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wide">
              Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold">Loved by teams</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all"
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-5">&ldquo;{t.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,white/20,transparent_50%)]" />
            
            <div className="relative px-8 py-16 text-center text-white">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Ready to get started?</h2>
              <p className="text-white/80 mb-8 max-w-md mx-auto">Join thousands creating professional certificates with Serenity.</p>
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

      <footer className="py-10 border-t border-border/30">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <Award className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Serenity</span>
            </Link>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link href="/templates" className="hover:text-foreground transition-colors">Templates</Link>
              <Link href="/verify" className="hover:text-foreground transition-colors">Verify</Link>
              <span>© 2024 Serenity</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
