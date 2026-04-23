import type { LayoutLoad } from './$types';
import { auth } from '$lib/api';
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

export const load: LayoutLoad = async ({ url }) => {
  if (!browser) {
    return { user: null };
  }

  let authEnabled = true;

  try {
    const authStatus = await auth.getAuthStatus();
    authEnabled = authStatus.enabled;
  } catch (err) {
    console.warn("⚠️ Impossible de lire /auth/status :", err);
  }

  try {
    const user = await auth.getMe();

    if (url.pathname.startsWith('/login')) {
      throw redirect(302, '/dashboard');
    }

    return { user };
  } catch (err) {
    if (!authEnabled) {
      if (url.pathname.startsWith('/login')) {
        throw redirect(302, '/dashboard');
      }

      // important : on ne force pas de faux user, on laisse juste passer
      return { user: null };
    }

    console.error("❌ Erreur auth.getMe :", err);

    if (!url.pathname.startsWith('/login') && !url.pathname.startsWith('/register')) {
      throw redirect(302, '/login');
    }

    return { user: null };
  }
};