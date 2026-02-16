'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Crown, Check, X, Zap, Shield, Star, Award, ChevronRight, 
  ArrowLeft, Sparkles, Lock, Infinity, Mail, Palette, 
  Download, QrCode, FileSpreadsheet, Users, Clock, BadgeCheck,
  AlertTriangle, MessageCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function PaymentDialog({ isOpen, onClose }: PaymentDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-800 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="text-xl font-bold">Payment Gateway Status</h3>
          </div>
          <p className="text-amber-100 text-sm">Service Temporarily Unavailable</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Thank you for showing interest in Serenity Premium!
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                Our payment gateway is currently undergoing maintenance and is temporarily unavailable.
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Want Premium Access for Free?
              </p>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Contact the developer directly to get premium subscription access at no cost during this maintenance period.
            </p>
            <a 
              href="mailto:thispc119@gmail.com" 
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Developer
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            We apologize for the inconvenience. The payment system will be restored soon.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const features = {
  free: [
    { text: '5 Certificate Generations', included: true },
    { text: 'Basic Templates', included: true },
    { text: 'QR Code Generation', included: true },
    { text: 'CSV Data Import', included: true },
    { text: 'PDF Export', included: true },
    { text: 'Email Delivery', included: false },
    { text: 'Unlimited Generations', included: false },
    { text: 'Premium Templates', included: false },
    { text: 'Premium Design Elements', included: false },
    { text: 'Custom Fonts Library', included: false },
    { text: 'Priority Support', included: false },
    { text: 'Bulk Email Sending', included: false },
    { text: 'Advanced Analytics', included: false },
    { text: 'Custom Branding', included: false },
  ],
  premium: [
    { text: 'Unlimited Generations', included: true, highlight: true },
    { text: 'All Templates Unlocked', included: true, highlight: true },
    { text: 'QR Code Generation', included: true },
    { text: 'CSV Data Import', included: true },
    { text: 'PDF Export (High Quality)', included: true },
    { text: 'Email Delivery (300/day)', included: true, highlight: true },
    { text: 'Premium Templates', included: true, highlight: true },
    { text: 'Premium Design Elements', included: true, highlight: true },
    { text: 'Custom Fonts Library', included: true },
    { text: 'Priority Support', included: true },
    { text: 'Bulk Email Sending', included: true },
    { text: 'Advanced Analytics', included: true },
    { text: 'Custom Branding', included: true },
    { text: 'Lifetime Access', included: true, highlight: true },
  ],
};

const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Training Manager',
    text: 'Serenity Premium paid for itself within the first week. The unlimited generations alone saved us hours.',
    rating: 5,
  },
  {
    name: 'James K.',
    role: 'Course Creator',
    text: 'The premium templates are stunning. My certificates look incredibly professional now.',
    rating: 5,
  },
  {
    name: 'Priya D.',
    role: 'HR Director',
    text: 'Bulk email delivery is a game-changer. Sending 200+ certificates took minutes instead of hours.',
    rating: 5,
  },
];

export default function PremiumPage() {
  const { user, isAuthenticated } = useAuth();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/20">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Award className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Serenity
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated ? (
                <Link href="/dashboard" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Dashboard
                </Link>
              ) : (
                <Link href="/login" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-700 dark:text-amber-300 text-sm font-medium mb-6 border border-amber-200 dark:border-amber-800">
              <Crown className="w-4 h-4" />
              <span>Lifetime Access - One Time Payment</span>
            </div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
          >
            <span className="text-slate-900 dark:text-white">Unlock </span>
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
              Unlimited
            </span>
            <br />
            <span className="text-slate-900 dark:text-white">Power</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8"
          >
            Generate unlimited certificates, access premium templates and design elements, send bulk emails, and more. 
            <span className="font-semibold text-slate-800 dark:text-slate-200"> One payment, lifetime access.</span>
          </motion.p>

          {/* Price Display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-12"
          >
            <div className="inline-flex items-baseline gap-1">
              <span className="text-2xl text-slate-400 dark:text-slate-500 line-through">$99</span>
              <span className="text-7xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                $25
              </span>
              <span className="text-xl text-slate-500 dark:text-slate-400 ml-1">/lifetime</span>
            </div>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-2">
              <Sparkles className="w-4 h-4 inline mr-1" />
              Limited time launch offer — 75% off
            </p>
          </motion.div>
        </div>
      </section>

      {/* Plan Comparison */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Compare Plans
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              See exactly what you get with Premium
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Free</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900 dark:text-white">$0</span>
                  <span className="text-slate-500">/forever</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Perfect for trying out Serenity
                </p>
              </div>
              
              <div className="space-y-3">
                {features.free.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <span className={feature.included 
                      ? 'text-sm text-slate-700 dark:text-slate-300' 
                      : 'text-sm text-slate-400 dark:text-slate-600 line-through'
                    }>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link
                  href={isAuthenticated ? "/dashboard" : "/signup"}
                  className="block w-full py-3 px-6 text-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
                </Link>
              </div>
            </motion.div>

            {/* Premium Plan */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/10 dark:to-slate-800 rounded-2xl border-2 border-amber-400 dark:border-amber-600 p-8 shadow-xl shadow-amber-200/20 dark:shadow-amber-900/20"
            >
              {/* Popular badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  MOST POPULAR
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Premium
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-sm text-slate-400 line-through mr-1">$99</span>
                  <span className="text-4xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">$25</span>
                  <span className="text-amber-600 dark:text-amber-400">/lifetime</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 font-medium">
                  Everything unlimited, forever
                </p>
              </div>

              <div className="space-y-3">
                {features.premium.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check className={`w-5 h-5 shrink-0 ${feature.highlight ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <span className={`text-sm ${feature.highlight 
                      ? 'font-semibold text-slate-900 dark:text-white' 
                      : 'text-slate-700 dark:text-slate-300'}`
                    }>
                      {feature.text}
                    </span>
                    {feature.highlight && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                        NEW
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <button
                  onClick={() => setShowPaymentDialog(true)}
                  className="block w-full py-3.5 px-6 text-center bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-600/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Crown className="w-5 h-5 inline mr-2 -mt-0.5" />
                  Upgrade to Premium — $25
                </button>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-3">
                  One-time payment • No subscription • Lifetime access
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Upgrade Section */}
      <section className="py-16 px-4 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Why Go Premium?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Premium unlocks the full potential of Serenity for professional certificate generation
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Infinity,
                title: 'Unlimited Generations',
                description: 'Remove the 5-certificate cap. Generate hundreds or thousands of certificates without limits.',
                color: 'from-blue-500 to-indigo-500',
              },
              {
                icon: Palette,
                title: 'Premium Templates & Elements',
                description: 'Access professionally designed templates and exclusive design elements for stunning certificates.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: Mail,
                title: 'Bulk Email Delivery',
                description: 'Send up to 300 certificates per day directly to recipients via email with custom templates.',
                color: 'from-emerald-500 to-teal-500',
              },
              {
                icon: Shield,
                title: 'Advanced Verification',
                description: 'Enhanced QR code verification with detailed certificate information and branding.',
                color: 'from-amber-500 to-orange-500',
              },
              {
                icon: Download,
                title: 'High-Quality Exports',
                description: 'Export certificates at maximum DPI for print-ready quality output.',
                color: 'from-red-500 to-rose-500',
              },
              {
                icon: Clock,
                title: 'Lifetime Access',
                description: 'Pay once and get all current and future premium features forever. No recurring charges.',
                color: 'from-cyan-500 to-blue-500',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors group"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              Loved by Professionals
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700"
              >
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 italic">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5 rounded-3xl p-12 border border-amber-200 dark:border-amber-800">
              <Crown className="w-16 h-16 text-amber-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                Ready to Go Premium?
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
                Join thousands of professionals who create stunning certificates with Serenity Premium. 
                One-time payment, lifetime access.
              </p>
              <button
                onClick={() => setShowPaymentDialog(true)}
                className="inline-flex items-center gap-2 py-4 px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-lg transition-all shadow-xl shadow-amber-500/25 hover:shadow-amber-600/30 hover:scale-105 active:scale-95"
              >
                <Crown className="w-5 h-5" />
                Upgrade Now — $25 Lifetime
              </button>
              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Secure Payment</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Instant Access</span>
                <span className="flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Lifetime Updates</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} Serenity. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Payment Dialog */}
      <PaymentDialog isOpen={showPaymentDialog} onClose={() => setShowPaymentDialog(false)} />
    </div>
  );
}
