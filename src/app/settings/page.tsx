/**
 * User Settings Page
 * 
 * /settings
 * 
 * Allows users to manage their profile and preferences.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Bell, 
  Shield, 
  Trash2, 
  Save,
  Check,
  Loader2,
  Camera,
  Globe,
  Lock
} from 'lucide-react';

interface UserSettings {
  name: string;
  email: string;
  avatar?: string;
  notifications: {
    email: boolean;
    marketing: boolean;
  };
  privacy: {
    publicProfile: boolean;
    showEmail: boolean;
  };
}

export default function SettingsPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    email: '',
    avatar: '',
    notifications: {
      email: true,
      marketing: false,
    },
    privacy: {
      publicProfile: false,
      showEmail: false,
    },
  });

  // Load user data
  useEffect(() => {
    if (user) {
      setSettings(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || '',
      }));
    }
  }, [user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/settings');
    }
  }, [user, authLoading, router]);

  const handleSave = async () => {
    setLoading(true);
    setSaveStatus('saving');
    
    try {
      // Update user in localStorage (in production, save to Firebase)
      const updatedUser = {
        ...user,
        name: settings.name,
        email: settings.email,
        avatar: settings.avatar,
      };
      
      localStorage.setItem('serenity_user', JSON.stringify(updatedUser));
      
      // Also save settings preferences
      localStorage.setItem('serenity_user_settings', JSON.stringify({
        notifications: settings.notifications,
        privacy: settings.privacy,
      }));

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    
    if (confirmed) {
      // In production, call API to delete account
      localStorage.removeItem('serenity_user');
      localStorage.removeItem('serenity_user_settings');
      localStorage.removeItem('serenity_templates');
      localStorage.removeItem('serenity_certificates');
      logout();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent" />
            <span className="font-display text-xl font-bold">Serenity</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/dashboard" className="btn-primary">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <div className="space-y-8">
          {/* Profile Section */}
          <section className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">Profile</h2>
                <p className="text-sm text-muted-foreground">Your personal information</p>
              </div>
            </div>

            {/* Avatar */}
            <div className="mb-6 flex items-center gap-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold">
                  {settings.name.charAt(0).toUpperCase() || 'U'}
                </div>
                <button 
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-card border border-border hover:bg-muted transition-colors"
                  title="Change avatar"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <p className="font-medium">{settings.name}</p>
                <p className="text-sm text-muted-foreground">{settings.email}</p>
              </div>
            </div>

            {/* Form fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Your name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Bell className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">Notifications</h2>
                <p className="text-sm text-muted-foreground">Configure email notifications</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications about certificate views and activity
                  </p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: !prev.notifications.email }
                  }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.notifications.email ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      settings.notifications.email ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Marketing Emails</p>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about new features and tips
                  </p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, marketing: !prev.notifications.marketing }
                  }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.notifications.marketing ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      settings.notifications.marketing ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>
          </section>

          {/* Privacy Section */}
          <section className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Shield className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">Privacy</h2>
                <p className="text-sm text-muted-foreground">Control your privacy settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Public Profile</p>
                    <p className="text-sm text-muted-foreground">
                      Show your name on public templates
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    privacy: { ...prev.privacy, publicProfile: !prev.privacy.publicProfile }
                  }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.privacy.publicProfile ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      settings.privacy.publicProfile ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Show Email</p>
                    <p className="text-sm text-muted-foreground">
                      Display email on your public profile
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    privacy: { ...prev.privacy, showEmail: !prev.privacy.showEmail }
                  }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.privacy.showEmail ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      settings.privacy.showEmail ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="card border-red-500/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-red-500">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">Irreversible actions</p>
              </div>
            </div>

            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 rounded-lg border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
              Delete Account
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              This will permanently delete your account and all associated data.
            </p>
          </section>

          {/* Save Button */}
          <div className="sticky bottom-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary flex items-center gap-2 shadow-lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save Changes'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
