'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { 
  Sparkles, 
  FileSpreadsheet, 
  Shield, 
  Zap, 
  Download, 
  QrCode,
  ArrowRight,
  CheckCircle2,
  Star
} from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const features = [
  {
    icon: Sparkles,
    title: 'Visual Editor',
    description: 'Drag-and-drop interface powered by Fabric.js. Design with pixel-perfect precision.',
    gradient: 'from-violet-500 to-purple-600'
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel Import',
    description: 'Upload Excel or CSV files with thousands of records. Map columns instantly.',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Zap,
    title: 'Bulk Generation',
    description: 'Generate thousands of personalized certificates in seconds, all client-side.',
    gradient: 'from-amber-500 to-orange-500'
  },
  {
    icon: QrCode,
    title: 'QR Verification',
    description: 'Each certificate gets a unique QR code for instant authenticity verification.',
    gradient: 'from-emerald-500 to-teal-500'
  },
  {
    icon: Download,
    title: 'Multiple Formats',
    description: 'Export as PDF, PNG, or ZIP. Perfect for printing or digital distribution.',
    gradient: 'from-pink-500 to-rose-500'
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'All data stays in your browser. No uploads to our servers. 100% private.',
    gradient: 'from-indigo-500 to-blue-600'
  }
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Training Director',
    company: 'TechCorp',
    content: 'Generated 5,000 certificates in under 2 minutes. Absolutely incredible!',
    avatar: 'SC'
  },
  {
    name: 'Michael Roberts',
    role: 'Event Coordinator',
    company: 'Global Events',
    content: 'The QR verification feature saved us hours of manual checking.',
    avatar: 'MR'
  },
  {
    name: 'Emily Watson',
    role: 'HR Manager',
    company: 'StartupXYZ',
    content: 'Beautiful templates and the privacy-first approach won us over.',
    avatar: 'EW'
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md"
      >
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span>Serenity</span>
          </div>
          
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Log in
            </Link>
            <Link 
              href="/signup" 
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Get Started
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] -z-10" />
        
        <div className="container mx-auto text-center max-w-4xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border mb-6">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium">v2.0 is now live</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground mb-6 tracking-tight">
              Create Certificates <br />
              <span className="text-primary">at Lightning Speed</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Design, generate, and distribute thousands of verifiable certificates in minutes. 
              Secure, privacy-focused, and free to start.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-transform active:scale-95 shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
              >
                Start Creating Free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/verify/demo"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-secondary text-secondary-foreground font-semibold text-lg hover:bg-secondary/80 transition-colors border border-border flex items-center justify-center gap-2"
              >
                <QrCode className="h-5 w-5" />
                Verify Certificate
              </Link>
            </div>
            
            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-border pt-8">
              <div>
                <div className="text-3xl font-bold">1M+</div>
                <div className="text-sm text-muted-foreground">Certificates Created</div>
              </div>
              <div>
                <div className="text-3xl font-bold">10k+</div>
                <div className="text-sm text-muted-foreground">Happy Users</div>
              </div>
              <div>
                <div className="text-3xl font-bold">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
              <div>
                <div className="text-3xl font-bold">4.9/5</div>
                <div className="text-sm text-muted-foreground">User Rating</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Powerful features to help you manage your certification process from start to finish.
            </p>
          </div>
          
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-bl-full transition-opacity group-hover:opacity-20`} />
                <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-6 shadow-lg`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Loved by teams everywhere</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-6 rounded-2xl bg-secondary/20 border border-border">
                <div className="flex items-center gap-1 text-yellow-500 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-lg mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
