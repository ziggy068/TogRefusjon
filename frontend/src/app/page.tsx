"use client";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import Link from "next/link";

export default function Home() {
  const [status, setStatus] = useState<string>("Klar");

  useEffect(() => {
    // Skip Firebase check for now - just set to ready
    setStatus("Klar");
  }, []);

  return (
    <div className="min-h-screen bg-slate-300">
      {/* Hero Section - Oslo Bysykkel inspired */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-24">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
          {/* Text Column */}
          <div className="flex-1 text-center md:text-left space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
              Automatisk refusjon når toget er forsinket
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl">
              Last opp billetten din, og vi overvåker toget automatisk.
              Ved forsinkelse genererer vi refusjonskravet for deg.
            </p>

            {/* Status indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm shadow-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === "Klar"
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-amber-500"
                }`}
              ></span>
              <span className="text-slate-700 font-medium">Status: {status}</span>
            </div>

            {/* CTA */}
            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link
                href="/login"
                className={`inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-full transition-colors duration-200 bg-primary-500 text-white hover:bg-primary-700 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  status !== "Klar" ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                Kom i gang
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-full transition-colors duration-200 bg-white text-primary-500 border-2 border-primary-500 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                Slik fungerer det
              </a>
            </div>
          </div>

          {/* Visual Column */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-full max-w-md">
              {/* Illustration placeholder - simple ticket visual */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl">🚆</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Status</div>
                    <div className="text-sm font-semibold text-emerald-600">Overvåkes</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">Oslo S</div>
                      <div className="text-sm text-slate-500">14:30</div>
                    </div>
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">Bergen</div>
                      <div className="text-sm text-slate-500">21:15</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Tognummer</span>
                      <span className="font-semibold text-slate-900">R42</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section - Oslo Bysykkel 3-step pattern */}
      <div id="how-it-works" className="bg-white border-y border-slate-200 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Slik fungerer det
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Tre enkle steg til automatisk refusjon
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Step 1 */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 text-primary-500 rounded-full text-2xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-slate-900">Last opp billett</h3>
              <p className="text-slate-600">
                Ta et bilde av billetten din, eller last opp PDF. Vi henter automatisk ut all nødvendig informasjon.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 text-primary-500 rounded-full text-2xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-slate-900">Vi overvåker toget</h3>
              <p className="text-slate-600">
                Systemet følger med på togets status i sanntid. Du trenger ikke gjøre noe.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 text-primary-500 rounded-full text-2xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-900">Automatisk refusjon</h3>
              <p className="text-slate-600">
                Ved forsinkelse genererer vi refusjonskravet og sender det til operatøren. Du får beskjed når det er klart.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link
              href="/login"
              className={`inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-full transition-colors duration-200 bg-primary-500 text-white hover:bg-primary-700 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                status !== "Klar" ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              Kom i gang nå
            </Link>
          </div>
        </div>
      </div>

      {/* Simple Footer */}
      <div className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center space-y-4">
            <div className="text-2xl font-bold">TogRefusjon</div>
            <p className="text-slate-400 text-sm">
              Automatisk togrefusjon når du trenger det
            </p>
            <div className="pt-4 text-xs text-slate-500">
              © 2025 TogRefusjon. Alle rettigheter reservert.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
