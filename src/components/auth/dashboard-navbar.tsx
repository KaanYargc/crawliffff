'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DashboardNavbar() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isAdmin = session?.user?.role === 'admin';
  const packageType = session?.user?.package || 'free';
  
  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/' });
    toast.success('Başarıyla çıkış yapıldı');
  };
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Define navigation links
  const navLinks = [
    { href: '/', label: 'Ana Sayfa' },
    { href: '/dashboard/leads', label: 'İşletme Ara' },
    { href: '/dashboard/reports', label: 'Raporlarım' },
    { href: '/dashboard/settings', label: 'Ayarlar' },
  ];
  
  // Admin links
  const adminLinks = [
    { href: '/admin', label: 'Admin Panel' },
    { href: '/admin/users', label: 'Kullanıcılar' },
    { href: '/admin/stats', label: 'İstatistikler' },
  ];

  return (
    <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-zinc-900">
                Crawlify
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                >
                  {link.label}
                </Link>
              ))}
              
              {isAdmin && adminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:border-indigo-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* User Profile & Actions */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {/* Package Badge */}
            <div className="mr-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                packageType === 'free' ? 'bg-gray-100 text-gray-800' : 
                packageType === 'pro' ? 'bg-blue-100 text-blue-800' : 
                'bg-purple-100 text-purple-800'
              }`}>
                {packageType === 'free' ? 'Ücretsiz' : 
                 packageType === 'pro' ? 'Profesyonel' : 
                 'Kurumsal'}
              </span>
            </div>
            
            {/* User Info */}
            {status === 'authenticated' && (
              <div className="flex items-center mr-4">
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-zinc-600">
                    {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="ml-2">
                  <p className="text-sm font-medium text-zinc-700">
                    {session.user?.name || session.user?.email}
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-zinc-500">Admin</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex items-center">
              <Link href="/packages" className="mr-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-9"
                >
                  Paketler
                </Button>
              </Link>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="h-9"
              >
                Çıkış Yap
              </Button>
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-zinc-400 hover:text-zinc-500 hover:bg-zinc-100"
              aria-controls="mobile-menu"
              aria-expanded="false"
              onClick={toggleMobileMenu}
            >
              <span className="sr-only">Open main menu</span>
              {/* Icon when menu is closed */}
              <svg
                className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {/* Icon when menu is open */}
              <svg
                className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} sm:hidden`} id="mobile-menu">
        <div className="pt-2 pb-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-800"
            >
              {link.label}
            </Link>
          ))}
          
          {isAdmin && adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-800"
            >
              {link.label}
            </Link>
          ))}
        </div>
        
        {/* Mobile user profile */}
        <div className="pt-4 pb-3 border-t border-zinc-200">
          <div className="flex items-center px-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center">
                <span className="text-lg font-medium text-zinc-600">
                  {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U'}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <div className="text-base font-medium text-zinc-800">
                {session?.user?.name || session?.user?.email}
              </div>
              <div className="text-sm font-medium text-zinc-500">
                {session?.user?.email}
              </div>
              
              {/* Package Badge - Mobile */}
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  packageType === 'free' ? 'bg-gray-100 text-gray-800' : 
                  packageType === 'pro' ? 'bg-blue-100 text-blue-800' : 
                  'bg-purple-100 text-purple-800'
                }`}>
                  {packageType === 'free' ? 'Ücretsiz' : 
                   packageType === 'pro' ? 'Profesyonel' : 
                   'Kurumsal'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Link
              href="/packages"
              className="block px-4 py-2 text-base font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
            >
              Paketler
            </Link>
            <Link
              href="/dashboard/settings"
              className="block px-4 py-2 text-base font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
            >
              Ayarlar
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full text-left block px-4 py-2 text-base font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}