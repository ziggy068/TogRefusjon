export default function TestColors() {
  return (
    <div className="min-h-screen bg-slate-300 p-8">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Tailwind v4 Color Test</h1>

      <div className="space-y-6">
        {/* Primary colors */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Primary Colors (Custom)</h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="w-full h-24 bg-primary-50 rounded-lg"></div>
              <p className="text-sm">primary-50</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-primary-100 rounded-lg"></div>
              <p className="text-sm">primary-100</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-primary-300 rounded-lg"></div>
              <p className="text-sm">primary-300</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-primary-500 rounded-lg"></div>
              <p className="text-sm">primary-500</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-primary-700 rounded-lg"></div>
              <p className="text-sm">primary-700</p>
            </div>
          </div>
        </div>

        {/* Button test */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Button Test</h2>
          <button className="px-6 py-3 bg-primary-500 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors duration-200">
            Primary Button
          </button>
        </div>

        {/* Badge test */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Badge Test</h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-primary-50 text-primary-700 border border-primary-200">
            Info Badge
          </span>
        </div>

        {/* Default colors test */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Default Slate Colors</h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="w-full h-24 bg-slate-50 rounded-lg border"></div>
              <p className="text-sm">slate-50</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-slate-100 rounded-lg"></div>
              <p className="text-sm">slate-100</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-slate-300 rounded-lg"></div>
              <p className="text-sm">slate-300</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-slate-600 rounded-lg"></div>
              <p className="text-sm">slate-600</p>
            </div>
            <div className="space-y-2">
              <div className="w-full h-24 bg-slate-900 rounded-lg"></div>
              <p className="text-sm">slate-900</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
