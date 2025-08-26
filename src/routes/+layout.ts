// src/routes/+layout.ts
import type { LayoutLoad } from './$types';
import { auth } from '$lib/api';
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

export const load: LayoutLoad = async ({ url }) => {
  console.log("🔍 [layout.ts] Début load, pathname =", url.pathname);

  // 🚫 On skip totalement l’auth côté serveur (SSR)
  if (!browser) {
    console.log("⚠️ [layout.ts] Exécution en SSR → on ne fait PAS auth.getMe()");
    return { user: null };
  }

  try {
    // ✅ Exécuté seulement côté navigateur (cookie présent)
    const user = await auth.getMe();
    console.log("✅ [layout.ts] Utilisateur récupéré:", user);

    if (url.pathname.startsWith('/login')) {
      console.log("🔀 [layout.ts] Déjà connecté → redirection vers /");
      throw redirect(302, '/');
    }

    return { user };
  } catch (err) {
    console.error("❌ [layout.ts] Erreur auth.getMe:", err);

    if (!url.pathname.startsWith('/login') && !url.pathname.startsWith('/register')) {
      console.log("🔀 [layout.ts] Pas connecté → redirection vers /login");
      throw redirect(302, '/login');
    }

    return { user: null };
  }
};
