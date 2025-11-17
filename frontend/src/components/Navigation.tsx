"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href={user ? "/billetter" : "/"} className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center group-hover:bg-primary-700 transition-colors duration-200">
                <span className="text-xl">🚆</span>
              </div>
              <span className="text-xl font-bold text-slate-900">TogRefusjon</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center gap-1">
              {user ? (
                <>
                  <Link
                    href="/billetter"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/billetter")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Mine billetter
                  </Link>
                  <Link
                    href="/scan"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/scan")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Skann billett
                  </Link>
                  <Link
                    href="/status"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/status")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Status & Krav
                  </Link>
                  <Link
                    href="/profile"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/profile")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Profil
                  </Link>
                  <Link
                    href="/innstillinger"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/innstillinger")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Innstillinger
                  </Link>
                  <Link
                    href="/hjelp"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/hjelp")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Hjelp
                  </Link>

                  {/* User menu */}
                  <div className="ml-4 pl-4 border-l border-slate-200 flex items-center gap-3">
                    <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-slate-700">
                          {(user.displayName || user.email || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-700 max-w-32 truncate">
                        {user.displayName || user.email}
                      </span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Logg ut
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Hjem
                  </Link>
                  <Link
                    href="/hjelp"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive("/hjelp")
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Hjelp
                  </Link>
                  <Link
                    href="/login"
                    className="px-6 py-2 rounded-full text-sm font-semibold bg-primary-500 text-white hover:bg-primary-700 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    Logg inn
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-slate-200">
            {user ? (
              <div className="space-y-1">
                <Link
                  href="/billetter"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/billetter")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Mine billetter
                </Link>
                <Link
                  href="/scan"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/scan")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Skann billett
                </Link>
                <Link
                  href="/status"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/status")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Status & Krav
                </Link>
                <Link
                  href="/profile"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/profile")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profil
                </Link>
                <Link
                  href="/innstillinger"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/innstillinger")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Innstillinger
                </Link>
                <Link
                  href="/hjelp"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/hjelp")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Hjelp
                </Link>
                <div className="px-4 py-3 mt-2 border-t border-slate-200">
                  <div className="text-sm font-medium text-slate-900 mb-1">
                    {user.displayName || "Bruker"}
                  </div>
                  <div className="text-xs text-slate-500 mb-3">
                    {user.email}
                  </div>
                  <button
                    className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-center"
                    onClick={handleLogout}
                  >
                    Logg ut
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Link
                  href="/"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Hjem
                </Link>
                <Link
                  href="/hjelp"
                  className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-200 ${
                    isActive("/hjelp")
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Hjelp
                </Link>
                <Link
                  href="/login"
                  className="block mx-4 mt-2 px-6 py-2.5 rounded-full text-base font-semibold bg-primary-500 text-white hover:bg-primary-700 transition-colors duration-200 text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Logg inn
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
