<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="antialiased">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'G-E7G API') }}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = { darkMode: 'class' };
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">

    <button
        id="theme-toggle"
        type="button"
        class="fixed top-5 right-5 p-2.5 rounded-full bg-white dark:bg-slate-700 shadow-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition"
        aria-label="Basculer le mode jour/nuit"
    >
        <span id="theme-icon-sun" class="hidden dark:inline">☀️</span>
        <span id="theme-icon-moon" class="inline dark:hidden">🌙</span>
    </button>

    <main class="w-full max-w-md mx-4">
        <div class="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 text-center transition-colors duration-300">

            <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white dark:bg-slate-700 shadow-lg">
                <img src="{{ asset('logo-ge7g.png') }}" alt="G-E7G" class="h-full w-full object-contain p-1.5">
            </div>

            <h1 class="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                {{ config('app.name', 'G-E7G API') }}
            </h1>

            <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">
                Interface de supervision du backend
            </p>

            <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 p-5 mb-6">
                <div class="flex items-center justify-center gap-2 mb-2">
                    <span class="relative flex h-3 w-3">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span class="font-semibold text-emerald-700 dark:text-emerald-300">API active</span>
                </div>
                <p class="text-xs text-emerald-600 dark:text-emerald-400">
                    Le serveur répond normalement et les endpoints sont disponibles.
                </p>
            </div>

            <div class="grid grid-cols-2 gap-4 text-left">
                <div class="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p class="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Environnement</p>
                    <p class="font-semibold text-slate-700 dark:text-slate-200">{{ app()->environment() }}</p>
                </div>
                <div class="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p class="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Version Laravel</p>
                    <p class="font-semibold text-slate-700 dark:text-slate-200">{{ app()->version() }}</p>
                </div>
                <div class="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p class="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">PHP</p>
                    <p class="font-semibold text-slate-700 dark:text-slate-200">{{ PHP_VERSION }}</p>
                </div>
                <div class="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p class="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Cache</p>
                    <p class="font-semibold text-slate-700 dark:text-slate-200">{{ config('cache.default') }}</p>
                </div>
            </div>

            <div class="mt-8 text-xs text-slate-400 dark:text-slate-500">
                © {{ date('Y') }} G-E7G — Tous droits réservés.
            </div>
        </div>
    </main>

    <script>
        const html = document.documentElement;
        const btn = document.getElementById('theme-toggle');

        function applyTheme(theme) {
            if (theme === 'dark') {
                html.classList.add('dark');
            } else {
                html.classList.remove('dark');
            }
        }

        const saved = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(saved);

        btn.addEventListener('click', () => {
            const isDark = html.classList.contains('dark');
            const next = isDark ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('theme', next);
        });
    </script>
</body>
</html>
