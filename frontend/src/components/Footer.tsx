import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          {/* Copyright */}
          <div className="text-center md:text-left">
            <p className="text-sm text-gray-600">
              Tog Refusjon &copy; {currentYear} | MVP i utvikling
            </p>
          </div>

          {/* Links */}
          <div className="mt-4 md:mt-0">
            <nav className="flex flex-wrap justify-center md:justify-end space-x-4 text-sm">
              <Link
                href="/personvern"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Personvern
              </Link>
              <Link
                href="/vilkar"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Vilkår
              </Link>
              <Link
                href="/hjelp"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Hjelp
              </Link>
            </nav>
          </div>
        </div>

        {/* Additional info */}
        <div className="mt-4 text-center md:text-left">
          <p className="text-xs text-gray-500">
            Automatisk refusjon for togforsinkelser. Vi hjelper deg med å kreve
            det du har krav på.
          </p>
        </div>
      </div>
    </footer>
  );
}
