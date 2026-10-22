// app.js - Full-Stack Client Application Logic for Mess Finder / MessMate
// Connects Stitch UI elements, navigation, authentication, discovery, search, plans, orders, and owner dashboard

const API_BASE = '/api';

// --- Global Application State ---
const state = {
  token: localStorage.getItem('mm_token') || '',
  user: null,
  currentRoute: 'home',
  routeParams: {},
  campusArea: localStorage.getItem('mm_campus') || 'North Campus',
  
  // Search & Filter State
  searchQuery: '',
  filters: {
    is_pure_veg: false,
    has_non_veg: false,
    has_egg: false,
    is_jain: false,
    is_vegan: false,
    has_high_protein: false,
    max_price: null,
    min_price: null,
    min_rating: null,
    max_distance: null,
    meal_type: '',
    sort: 'rating_desc'
  },
  
  // Data Caches
  messes: [],
  favorites: new Set(),
  myOrders: [],
  currentMess: null,
  selectedPlan: null,
  compareMessIds: [1, 2],
  
  // UI Tabs & Modals
  plansActiveTab: 'active', // 'active' | 'upcoming' | 'past'
  ownerActiveTab: 'orders', // 'orders' | 'menu' | 'plans' | 'profile' | 'subscribers'
  activeWeeklyDay: 'Mon',
  
  isLoading: false,
  notificationMsg: ''
};

// --- API Client ---
async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// --- Authentication & Session Management ---
async function initAuth() {
  if (!state.token) return;
  try {
    const data = await api('/auth/me');
    state.user = data.user;
    updateHeaderUI();
  } catch (err) {
    console.warn('Session expired or invalid token');
    logout(false);
  }
}

function loginSuccess(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('mm_token', token);
  showToast(`Welcome back, ${user.name}!`);
  updateHeaderUI();

  if (user.role === 'owner') {
    navigateTo('owner');
  } else {
    navigateTo('home');
  }
}

function logout(redirect = true) {
  state.token = '';
  state.user = null;
  localStorage.removeItem('mm_token');
  updateHeaderUI();
  showToast('Logged out successfully');
  if (redirect) navigateTo('home');
}

// --- Navigation & Routing ---
function navigateTo(route, params = {}) {
  state.currentRoute = route;
  state.routeParams = params;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update active states in bottom navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    const itemPath = item.getAttribute('data-path');
    if (itemPath === route) {
      item.classList.add('active', 'text-primary-container', 'font-bold');
      item.classList.remove('text-on-surface-variant');
      const pill = item.querySelector('.nav-icon-container');
      if (pill) {
        pill.classList.add('bg-secondary-container', 'text-on-secondary-fixed', 'scale-105');
      }
    } else {
      item.classList.remove('active', 'text-primary-container', 'font-bold');
      item.classList.add('text-on-surface-variant');
      const pill = item.querySelector('.nav-icon-container');
      if (pill) {
        pill.classList.remove('bg-secondary-container', 'text-on-secondary-fixed', 'scale-105');
      }
    }
  });

  renderApp();
}

// --- Toast Alerts ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('global-toast');
  const toastText = document.getElementById('toast-message');
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
  }, 3500);
}

// --- Main App Renderer ---
async function renderApp() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const route = state.currentRoute;

  if (route === 'home') {
    await renderHomeScreen(main);
  } else if (route === 'explore') {
    await renderExploreScreen(main);
  } else if (route === 'mess') {
    await renderMessDetailScreen(main, state.routeParams.id || 1);
  } else if (route === 'my-plans') {
    await renderMyPlansScreen(main);
  } else if (route === 'saved') {
    await renderSavedScreen(main);
  } else if (route === 'compare') {
    await renderCompareScreen(main);
  } else if (route === 'auth') {
    renderAuthScreen(main);
  } else if (route === 'profile') {
    renderProfileScreen(main);
  } else if (route === 'owner') {
    await renderOwnerScreen(main);
  }
}

// --- Update Top Header UI ---
function updateHeaderUI() {
  const locationLabel = document.getElementById('header-campus-label');
  if (locationLabel) locationLabel.textContent = state.campusArea;

  const profileBtn = document.getElementById('header-profile-btn');
  const avatarImg = document.getElementById('header-profile-avatar');

  if (profileBtn && avatarImg) {
    if (state.user) {
      avatarImg.src = state.user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
      profileBtn.onclick = () => state.user.role === 'owner' ? navigateTo('owner') : navigateTo('profile');
    } else {
      avatarImg.src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbaJ7I5OqiTs1_g7YwUUmCGSiFSZrWFUt_pz0mrjt81rTiaa4mcVB7kD7b47XLHBnwC2j6TGlVybt2XEEQXyGaU7sBL_N3b3TOdFAPl1WO0xv5kzSg3eJ67RQwgsLLIEfTUUtjZG2-nniQRC2KuvEDKHulcYtqs-DDXj_Tk8usmoxauIM7H2aoYl0z6c7YPXfhQTxtvkYQuVr7ouztsLm4mir8IJn48FZIXIDCndRhZlOtJQNw1KI1';
      profileBtn.onclick = () => navigateTo('auth');
    }
  }

  // Update Owner switch banner in header
  const roleBadge = document.getElementById('header-role-badge');
  if (roleBadge) {
    if (state.user && state.user.role === 'owner') {
      roleBadge.textContent = 'Owner Mode';
      roleBadge.className = 'font-label-sm text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary';
    } else {
      roleBadge.textContent = 'Student Mode';
      roleBadge.className = 'font-label-sm text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed';
    }
  }
}

// --- Fetch Favorites ---
async function loadFavorites() {
  if (!state.token || (state.user && state.user.role !== 'student')) return;
  try {
    const data = await api('/favorites');
    state.favorites = new Set(data.favorites.map(f => f.id));
  } catch (err) {
    console.warn('Could not load favorites:', err);
  }
}

async function toggleBookmark(messId) {
  if (!state.token) {
    showToast('Please login to save favorite messes');
    return navigateTo('auth');
  }
  try {
    const res = await api(`/favorites/${messId}`, { method: 'POST' });
    if (res.favorited) {
      state.favorites.add(messId);
      showToast('Saved to your bookmarks!');
    } else {
      state.favorites.delete(messId);
      showToast('Removed from bookmarks');
    }
    renderApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// SCREEN 1: STUDENT HOME
// ==========================================
async function renderHomeScreen(container) {
  // Fetch featured and budget messes
  let messes = [];
  try {
    const res = await api('/messes');
    messes = res.messes;
    state.messes = messes;
  } catch (e) {
    console.error(e);
  }

  const nearCollege = messes.filter(m => m.distance_km <= 1.0).slice(0, 3);
  const budgetMesses = messes.filter(m => m.monthly_starting_price <= 1500).slice(0, 3);

  container.innerHTML = `
    <div class="flex flex-col w-full pb-8">
      <!-- Value Greeting & Search Header Box -->
      <div class="px-margin pt-space-md flex flex-col gap-space-md">
        <!-- Greeting & Micro Delight -->
        <div class="flex items-start justify-between">
          <div class="flex flex-col">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed w-fit mb-1 shadow-sm">
              <span class="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              <span class="font-label-sm text-label-sm uppercase tracking-wider">Campus Lunch Live</span>
            </div>
            <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight font-bold">Good food. Better days.</h1>
            <p class="font-body-md text-body-md text-on-surface-variant">Find a mess that fits your budget and routine.</p>
          </div>
          <!-- Meal Tracker Dial Indicator -->
          <div class="shrink-0 flex flex-col items-center justify-center p-2 rounded-xl bg-surface-container shadow-sm text-center cursor-pointer hover:bg-surface-container-high transition-colors" onclick="navigateTo('my-plans')">
            <span class="font-label-sm text-[10px] text-outline uppercase tracking-wider">Today</span>
            <div class="relative w-9 h-9 flex items-center justify-center">
              <svg class="w-9 h-9 -rotate-90" viewbox="0 0 36 36">
                <path class="text-surface-container-highest" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
                <path class="text-primary-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="68, 100" stroke-linecap="round" stroke-width="3.5"></path>
              </svg>
              <span class="material-symbols-outlined text-[16px] text-primary absolute" style="font-variation-settings: 'FILL' 1;">restaurant_menu</span>
            </div>
            <span class="font-label-sm text-[10px] font-bold text-primary mt-0.5">Thali On</span>
          </div>
        </div>

        <!-- Search Input & Interaction Rig -->
        <div class="relative flex items-center w-full">
          <div class="relative flex-1 flex items-center bg-surface-container-lowest rounded-full shadow-sm hover:shadow-md transition-shadow">
            <span class="material-symbols-outlined text-outline ml-3.5 text-[22px] shrink-0">search</span>
            <input id="home-search-input" class="w-full bg-transparent py-3 pl-2 pr-10 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none" placeholder="Search mess, area, or college" type="text" value="${state.searchQuery}"/>
            <button aria-label="Clear or search" class="absolute right-2.5 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors" type="button" onclick="handleHomeSearch()">
              <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
          <button aria-label="Filters" class="ml-2 w-11 h-11 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md active:scale-95 transition-transform" type="button" onclick="navigateTo('explore')">
            <span class="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>

        <!-- Campus Range Quick Filter Chips -->
        <div class="flex items-center gap-space-xs overflow-x-auto pb-0.5 scrollbar-none">
          <button class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${state.filters.max_distance === 1 ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'} hover:bg-surface-container-highest transition-colors shrink-0 shadow-sm" onclick="toggleQuickFilter('distance', 1)">
            <span class="material-symbols-outlined text-tertiary-container text-[16px]">pin_drop</span>
            <span class="font-label-md text-label-md">Within 1 km of ${state.campusArea}</span>
            ${state.filters.max_distance === 1 ? '<span class="material-symbols-outlined text-[14px]">check</span>' : ''}
          </button>
          <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full ${state.filters.is_pure_veg ? 'bg-secondary-container text-on-secondary-fixed font-bold' : 'bg-surface-container text-on-surface-variant'} hover:text-on-surface shrink-0" onclick="toggleQuickFilter('veg')">
            <span class="material-symbols-outlined text-[15px]">eco</span>
            <span class="font-label-md text-label-md">Pure Veg Only</span>
          </button>
          <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface shrink-0" onclick="navigateTo('compare')">
            <span class="material-symbols-outlined text-[15px]">compare_arrows</span>
            <span class="font-label-md text-label-md">Compare Messes</span>
          </button>
        </div>
      </div>

      <!-- Interactive Trial Delight Banner -->
      <div class="px-margin mt-space-md">
        <div class="relative overflow-hidden rounded-xl bg-secondary-container p-4 shadow-sm flex items-center justify-between gap-3">
          <div class="flex items-start gap-3 z-10">
            <div class="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm">
              <span class="material-symbols-outlined text-[22px]">lunch_dining</span>
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="font-title-md text-title-md text-on-secondary-fixed font-bold">Mess trial available today!</span>
                <span class="inline-block px-1.5 py-0.2 rounded bg-tertiary-container text-on-tertiary font-label-sm text-[10px] uppercase">New</span>
              </div>
              <p class="font-body-sm text-body-sm text-on-secondary-fixed-variant mt-0.5">Try 1 single meal before locking your monthly membership.</p>
            </div>
          </div>
          <button class="z-10 shrink-0 px-3.5 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow hover:bg-primary-container transition-transform active:scale-95" onclick="quickBookTrial(1)">
            Try for ₹60
          </button>
          <svg class="absolute -right-4 -bottom-6 w-28 h-28 opacity-15 pointer-events-none text-primary" fill="currentColor" viewbox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
        </div>
      </div>

      <!-- Quick Category Bubbles (Horizontal Scroll) -->
      <section class="mt-space-lg flex flex-col">
        <div class="px-margin flex items-center justify-between mb-space-sm">
          <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Explore by Preference</h2>
          <button class="font-label-md text-label-md text-primary-container flex items-center gap-0.5 hover:underline" onclick="navigateTo('explore')">
            See All <span class="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
        <div class="flex items-center gap-3 overflow-x-auto px-margin pb-2 scrollbar-none">
          ${renderCategoryBubble('🥦', 'Pure Veg', 'pure_veg')}
          ${renderCategoryBubble('🥞', 'South Indian', 'south_indian')}
          ${renderCategoryBubble('🍛', 'North Indian', 'north_indian')}
          ${renderCategoryBubble('🪙', '< ₹1,500/mo', 'budget_1500')}
          ${renderCategoryBubble('🥚', 'High Protein', 'high_protein')}
          ${renderCategoryBubble('🌿', 'Jain Food', 'jain')}
          ${renderCategoryBubble('🍱', '3 Meals/Day', 'three_meals')}
          ${renderCategoryBubble('🥘', 'Unlimited', 'unlimited')}
        </div>
      </section>

      <!-- Spotlight Section: Mess Near Your College -->
      <section class="mt-space-lg flex flex-col">
        <div class="px-margin flex items-center justify-between mb-space-sm">
          <div class="flex flex-col">
            <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Near Your College</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Handpicked partner kitchens within walking distance</p>
          </div>
          <button aria-label="Sort options" class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-surface-container-highest transition-colors" onclick="navigateTo('explore')">
            <span class="material-symbols-outlined text-[20px]">sort</span>
          </button>
        </div>

        <div class="px-margin flex flex-col gap-space-md">
          ${nearCollege.map(mess => renderFeaturedMessCard(mess)).join('')}
        </div>
      </section>

      <!-- Section: Best Within Your Budget (< ₹1,500/mo) -->
      <section class="mt-space-lg flex flex-col">
        <div class="px-margin flex items-center justify-between mb-space-sm">
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Best Within Your Budget</h2>
              <span class="px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-label-sm text-[11px] font-bold">Save More</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Pocket-friendly monthly thalis tailored for hostellers</p>
          </div>
          <button class="font-label-md text-label-md text-primary-container hover:underline" onclick="setBudgetFilter(1500)">View All</button>
        </div>

        <div class="px-margin flex flex-col gap-space-sm">
          ${budgetMesses.map(mess => renderBudgetMessCard(mess)).join('')}
        </div>
      </section>

      <!-- Interactive Student Routine Delight Box -->
      <div class="px-margin mt-space-lg">
        <div class="p-4 rounded-2xl bg-surface-container flex flex-col gap-3 shadow-inner">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary-container text-[22px]">calendar_today</span>
              <span class="font-title-md text-title-md text-primary font-bold">Campus Meal Schedule</span>
            </div>
            <span class="font-label-sm text-label-sm text-outline">Today: ${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="p-2.5 rounded-xl bg-surface-container-lowest flex flex-col items-center text-center shadow-sm">
              <span class="font-label-sm text-[10px] text-outline uppercase">Breakfast</span>
              <span class="font-label-md text-label-md text-on-surface mt-0.5">Poha & Chai</span>
              <span class="font-body-sm text-[10px] text-primary mt-1 font-semibold">Done · 9 AM</span>
            </div>
            <div class="p-2.5 rounded-xl bg-secondary-container text-on-secondary-fixed flex flex-col items-center text-center shadow-sm">
              <span class="font-label-sm text-[10px] uppercase font-bold text-secondary">Lunch (Active)</span>
              <span class="font-label-md text-label-md text-on-secondary-fixed mt-0.5">Paneer Thali</span>
              <span class="font-body-sm text-[10px] text-on-secondary-fixed-variant mt-1 font-bold">Till 3:00 PM</span>
            </div>
            <div class="p-2.5 rounded-xl bg-surface-container-lowest flex flex-col items-center text-center shadow-sm">
              <span class="font-label-sm text-[10px] text-outline uppercase">Dinner</span>
              <span class="font-label-md text-label-md text-on-surface mt-0.5">Dal Makhani</span>
              <span class="font-body-sm text-[10px] text-outline mt-1">Starts 7:30 PM</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant pt-1">
            <span>Want food delivered to your hostel room?</span>
            <button class="font-label-md text-label-md text-primary font-bold underline" onclick="navigateTo('explore', { delivery: true })">
              Switch to Delivery
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach search enter key listener
  const searchInput = document.getElementById('home-search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleHomeSearch();
    });
  }
}

function renderCategoryBubble(emoji, label, type) {
  return `
    <button class="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all shrink-0 w-24 text-center group active:scale-95" onclick="selectCategoryFilter('${type}')">
      <div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-2xl group-hover:bg-secondary-container transition-colors mb-1.5 shadow-inner">
        ${emoji}
      </div>
      <span class="font-label-sm text-label-sm text-on-surface line-clamp-1 font-semibold">${label}</span>
      <span class="font-body-sm text-[10px] text-outline">Explore</span>
    </button>
  `;
}

function renderFeaturedMessCard(mess) {
  const isFav = state.favorites.has(mess.id);
  const timing = mess.meal_timings || { lunch: '12:30 - 3 PM', dinner: '7:30 - 10 PM' };

  return `
    <div class="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all flex flex-col">
      <div class="relative w-full h-48 bg-surface-container">
        <img class="w-full h-full object-cover" src="${mess.banner_url || (mess.photos && mess.photos[0]) || ''}" alt="${mess.name}" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        <div class="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-container text-on-primary text-label-sm font-label-sm shadow-md backdrop-blur-md">
            <span class="material-symbols-outlined text-[15px] text-secondary-container">verified_user</span>
            <span>Verified Partner</span>
          </div>
          <button aria-label="Bookmark" class="w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-center ${isFav ? 'text-error' : 'text-tertiary-container'} shadow active:scale-90 transition-transform" onclick="toggleBookmark(${mess.id})">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' ${isFav ? 1 : 0};">${isFav ? 'favorite' : 'bookmark_border'}</span>
          </button>
        </div>
        <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-on-primary">
          <div class="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full font-label-sm text-label-sm">
            <span class="material-symbols-outlined text-[16px] text-amber-300" style="font-variation-settings: 'FILL' 1;">star</span>
            <span class="font-bold">${mess.rating.toFixed(1)}</span>
            <span class="opacity-80">(${mess.review_count} reviews)</span>
          </div>
          <div class="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full font-label-sm text-label-sm text-surface-bright">
            <span class="material-symbols-outlined text-[16px]">directions_walk</span>
            <span>${mess.distance_km} km · ${mess.walking_minutes} min walk</span>
          </div>
        </div>
      </div>
      <div class="p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-headline-sm text-headline-sm text-primary font-bold cursor-pointer hover:underline" onclick="navigateTo('mess', { id: ${mess.id} })">${mess.name}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${mess.is_pure_veg ? 'bg-secondary-container text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface'} font-label-sm text-label-sm">
                <span class="w-1.5 h-1.5 rounded-full ${mess.is_pure_veg ? 'bg-primary' : 'bg-tertiary'}"></span> ${mess.is_pure_veg ? 'Pure Veg' : (mess.has_egg ? 'Veg & Egg' : 'Non-Veg')}
              </span>
              <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${mess.cuisines}</span>
            </div>
          </div>
          <div class="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-primary-container font-label-sm text-[11px] shadow-sm">
            <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span>${mess.spots_left} spots left</span>
          </div>
        </div>
        <div class="flex items-center gap-3 py-2 px-3 rounded-xl bg-surface-container-low text-on-surface font-label-sm text-label-sm">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary-container text-[18px]">wb_sunny</span>
            <span>Lunch (${timing.lunch || '12:30 - 3 PM'})</span>
          </div>
          <span class="text-outline-variant font-bold">·</span>
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary-container text-[18px]">bedtime</span>
            <span>Dinner (${timing.dinner || '7:30 - 10 PM'})</span>
          </div>
        </div>
        ${mess.today_lunch_menu ? `
          <div class="flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant">
            <span class="flex items-center gap-1 truncate">
              <span class="text-tertiary-container font-bold">Today:</span> ${mess.today_lunch_menu}
            </span>
          </div>
        ` : ''}
        <div class="flex items-center justify-between pt-2">
          <div class="flex flex-col">
            <div class="flex items-baseline gap-1.5">
              <span class="font-headline-sm text-headline-sm text-primary font-bold">₹${mess.monthly_starting_price.toLocaleString('en-IN')}</span>
              <span class="font-body-sm text-body-sm text-outline">/month</span>
            </div>
            <span class="inline-block px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-label-sm text-[10px] w-fit font-bold">
              Student Offer: 10% OFF
            </span>
          </div>
          <button class="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary transition-all active:scale-95 flex items-center gap-1.5" onclick="navigateTo('mess', { id: ${mess.id} })">
            <span>View Mess</span>
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderBudgetMessCard(mess) {
  const isFav = state.favorites.has(mess.id);

  return `
    <div class="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
      <div class="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-surface-container cursor-pointer" onclick="navigateTo('mess', { id: ${mess.id} })">
        <img class="w-full h-full object-cover" src="${mess.banner_url || (mess.photos && mess.photos[0]) || ''}" alt="${mess.name}" />
        <div class="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white font-bold flex items-center gap-0.5">
          <span class="material-symbols-outlined text-[12px] text-amber-300" style="font-variation-settings: 'FILL' 1;">star</span>
          ${mess.rating.toFixed(1)}
        </div>
      </div>
      <div class="flex-1 min-w-0 flex flex-col justify-between h-full">
        <div>
          <div class="flex items-center justify-between">
            <h4 class="font-title-md text-title-md text-on-surface font-semibold truncate cursor-pointer hover:underline" onclick="navigateTo('mess', { id: ${mess.id} })">${mess.name}</h4>
            <span class="font-label-sm text-label-sm text-primary-container bg-surface-container-low px-1.5 py-0.5 rounded font-bold">₹${mess.monthly_starting_price.toLocaleString('en-IN')}/mo</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${mess.distance_km} km · ${mess.cuisines}</p>
        </div>
        <div class="flex items-center gap-3 text-outline text-[12px] mt-1.5">
          <span class="flex items-center gap-0.5"><span class="material-symbols-outlined text-[15px]">water_drop</span><span class="text-[11px]">RO Water</span></span>
          <span class="flex items-center gap-0.5"><span class="material-symbols-outlined text-[15px]">all_inclusive</span><span class="text-[11px]">Unlimited Roti</span></span>
          <span class="flex items-center gap-0.5"><span class="material-symbols-outlined text-[15px]">wifi</span><span class="text-[11px]">Wi-Fi</span></span>
        </div>
        <div class="flex items-center justify-between mt-2 pt-1">
          <span class="font-label-sm text-[11px] text-secondary font-bold">Single: ₹${mess.single_thali_price}</span>
          <button class="px-3 py-1 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm hover:bg-primary transition-colors" onclick="navigateTo('mess', { id: ${mess.id} })">
            Book Plan
          </button>
        </div>
      </div>
    </div>
  `;
}

function handleHomeSearch() {
  const input = document.getElementById('home-search-input');
  if (input) {
    state.searchQuery = input.value.trim();
  }
  navigateTo('explore');
}

function toggleQuickFilter(type, val) {
  if (type === 'distance') {
    state.filters.max_distance = state.filters.max_distance === val ? null : val;
  } else if (type === 'veg') {
    state.filters.is_pure_veg = !state.filters.is_pure_veg;
  }
  navigateTo('explore');
}

function setBudgetFilter(max) {
  state.filters.max_price = max;
  navigateTo('explore');
}

function selectCategoryFilter(type) {
  // Reset specific filters then apply
  if (type === 'pure_veg') state.filters.is_pure_veg = true;
  if (type === 'south_indian') state.searchQuery = 'South Indian';
  if (type === 'north_indian') state.searchQuery = 'North Indian';
  if (type === 'budget_1500') state.filters.max_price = 1500;
  if (type === 'high_protein') state.filters.has_high_protein = true;
  if (type === 'jain') state.filters.is_jain = true;
  if (type === 'unlimited') state.searchQuery = 'Unlimited';
  navigateTo('explore');
}

// ==========================================
// SCREEN 2: SEARCH & FILTERS (EXPLORE)
// ==========================================
async function renderExploreScreen(container) {
  // Construct query string
  const params = new URLSearchParams();
  if (state.searchQuery) params.append('q', state.searchQuery);
  if (state.filters.is_pure_veg) params.append('is_pure_veg', '1');
  if (state.filters.has_non_veg) params.append('has_non_veg', '1');
  if (state.filters.has_egg) params.append('has_egg', '1');
  if (state.filters.is_jain) params.append('is_jain', '1');
  if (state.filters.is_vegan) params.append('is_vegan', '1');
  if (state.filters.has_high_protein) params.append('has_high_protein', '1');
  if (state.filters.max_price) params.append('max_price', state.filters.max_price);
  if (state.filters.min_price) params.append('min_price', state.filters.min_price);
  if (state.filters.min_rating) params.append('min_rating', state.filters.min_rating);
  if (state.filters.max_distance) params.append('max_distance', state.filters.max_distance);
  if (state.filters.sort) params.append('sort', state.filters.sort);

  let messes = [];
  try {
    const res = await api(`/messes?${params.toString()}`);
    messes = res.messes;
  } catch (err) {
    console.error(err);
  }

  // Count active filters
  let activeFilterCount = 0;
  if (state.filters.is_pure_veg) activeFilterCount++;
  if (state.filters.has_non_veg) activeFilterCount++;
  if (state.filters.has_egg) activeFilterCount++;
  if (state.filters.is_jain) activeFilterCount++;
  if (state.filters.is_vegan) activeFilterCount++;
  if (state.filters.has_high_protein) activeFilterCount++;
  if (state.filters.max_price) activeFilterCount++;
  if (state.filters.min_rating) activeFilterCount++;
  if (state.filters.max_distance) activeFilterCount++;

  container.innerHTML = `
    <div class="flex flex-col w-full relative pb-12">
      <!-- Sticky Search & Location Headband -->
      <div class="px-margin pt-space-xs pb-space-sm flex flex-col gap-space-xs bg-surface/95 backdrop-blur-md sticky top-16 z-20 shadow-xs">
        <!-- Active Search Bar -->
        <div class="flex items-center gap-space-xs w-full bg-surface-container-lowest rounded-full px-space-md py-2 shadow-sm">
          <span class="material-symbols-outlined text-[20px] text-primary shrink-0">search</span>
          <div class="flex-1 flex items-center min-w-0">
            <input class="w-full bg-transparent text-on-surface font-body-md text-body-md focus:outline-none placeholder:text-outline" id="mess-search-input" placeholder="Search mess by name, locality, or cuisine" type="text" value="${state.searchQuery}">
          </div>
          ${state.searchQuery ? `
            <button aria-label="Clear search query" class="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface" onclick="clearSearchInput()" type="button">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          ` : ''}
          <div class="w-px h-5 bg-surface-container-high mx-0.5"></div>
          <button aria-label="Open advanced filter modal" class="relative flex items-center justify-center p-1.5 rounded-full text-primary hover:bg-surface-container transition-colors shrink-0" onclick="openFilterDrawer()" type="button">
            <span class="material-symbols-outlined text-[22px]">tune</span>
            ${activeFilterCount > 0 ? `
              <span class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-tertiary-container text-on-tertiary text-[10px] font-bold flex items-center justify-center shadow-xs">${activeFilterCount}</span>
            ` : ''}
          </button>
        </div>

        <!-- Location & Status Anchor -->
        <div class="flex items-center justify-between text-on-surface-variant px-1 pt-0.5">
          <button class="flex items-center gap-1.5 min-h-[32px] text-left group" onclick="openLocationPickerModal()">
            <span class="material-symbols-outlined text-[16px] text-primary">my_location</span>
            <span class="font-label-md text-label-md text-on-surface font-semibold group-hover:text-primary transition-colors">${state.campusArea}</span>
            <span class="material-symbols-outlined text-[14px] text-outline">edit</span>
          </button>
          <div class="flex items-center gap-1 text-on-surface-variant">
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span class="font-label-sm text-label-sm text-outline font-semibold">${messes.length} Messes found</span>
          </div>
        </div>
      </div>

      <!-- Horizontal Scrollable Quick Filter Chips -->
      <div class="w-full overflow-x-auto no-scrollbar py-2 px-margin flex items-center gap-2">
        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-on-primary shadow-xs shrink-0 font-label-md text-label-md transition-transform active:scale-95" onclick="openFilterDrawer()" type="button">
          <span class="material-symbols-outlined text-[16px]">tune</span>
          <span>All Filters</span>
          ${activeFilterCount > 0 ? `<span class="w-4 h-4 rounded-full bg-surface-container-lowest text-primary text-[10px] font-bold flex items-center justify-center">${activeFilterCount}</span>` : ''}
        </button>

        <button class="filter-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full ${state.filters.is_pure_veg ? 'bg-secondary-container text-on-secondary-fixed font-bold' : 'bg-surface-container-lowest text-on-surface'} font-label-md text-label-md shrink-0 shadow-xs" onclick="toggleExploreFilter('is_pure_veg')">
          <span class="w-2 h-2 rounded-full bg-primary shrink-0"></span>
          <span>Pure Veg</span>
          ${state.filters.is_pure_veg ? '<span class="material-symbols-outlined text-[14px] ml-0.5">check</span>' : ''}
        </button>

        <button class="filter-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full ${state.filters.max_price === 2000 ? 'bg-secondary-container text-on-secondary-fixed font-bold' : 'bg-surface-container-lowest text-on-surface'} font-label-md text-label-md shrink-0 shadow-xs" onclick="toggleExploreFilter('max_price', 2000)">
          <span class="material-symbols-outlined text-[14px]">payments</span>
          <span>Under ₹2,000/mo</span>
          ${state.filters.max_price === 2000 ? '<span class="material-symbols-outlined text-[14px] ml-0.5">check</span>' : ''}
        </button>

        <button class="filter-pill flex items-center gap-1 px-3 py-1.5 rounded-full ${state.filters.min_rating === 4.5 ? 'bg-secondary-container text-on-secondary-fixed font-bold' : 'bg-surface-container-lowest text-on-surface'} font-label-md text-label-md shrink-0 shadow-xs hover:bg-surface-container" onclick="toggleExploreFilter('min_rating', 4.5)">
          <span class="material-symbols-outlined text-[15px] text-tertiary-container" style="font-variation-settings: 'FILL' 1;">star</span>
          <span>Rating 4.5+</span>
        </button>

        <button class="filter-pill flex items-center gap-1 px-3 py-1.5 rounded-full ${state.filters.max_distance === 1 ? 'bg-secondary-container text-on-secondary-fixed font-bold' : 'bg-surface-container-lowest text-on-surface'} font-label-md text-label-md shrink-0 shadow-xs hover:bg-surface-container" onclick="toggleExploreFilter('max_distance', 1)">
          <span class="material-symbols-outlined text-[15px] text-outline">near_me</span>
          <span>&lt; 1 km</span>
        </button>

        <button class="filter-pill flex items-center gap-1 px-3 py-1.5 rounded-full ${state.filters.has_high_protein ? 'bg-secondary-container text-on-secondary-fixed font-bold' : 'bg-surface-container-lowest text-on-surface'} font-label-md text-label-md shrink-0 shadow-xs hover:bg-surface-container" onclick="toggleExploreFilter('has_high_protein')">
          <span class="material-symbols-outlined text-[15px] text-primary">fitness_center</span>
          <span>High Protein</span>
        </button>

        ${activeFilterCount > 0 ? `
          <button class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-error-container text-on-error-container font-label-md text-label-md shrink-0" onclick="clearAllFilters()">
            <span class="material-symbols-outlined text-[14px]">restart_alt</span>
            <span>Clear Filters</span>
          </button>
        ` : ''}
      </div>

      <!-- Student Smart Banner / Insight -->
      <div class="px-margin mt-1 mb-2">
        <div class="bg-surface-container-low rounded-xl p-3 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center shrink-0 text-on-secondary-fixed">
            <span class="material-symbols-outlined text-[20px]">local_fire_department</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-label-md text-label-md text-primary font-bold">Lunch Window Live</span>
              <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary">Ends 2:30 PM</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant truncate">Showing ${messes.length} thali spots serving hot rotis near ${state.campusArea}.</p>
          </div>
        </div>
      </div>

      <!-- Filtered Mess Listings Container -->
      <div class="px-margin py-2 flex flex-col gap-4">
        ${messes.length === 0 ? renderEmptySearchState() : messes.map(m => renderExploreMessCard(m)).join('')}
      </div>

      <!-- Student Delight Prompt -->
      <div class="px-margin my-3">
        <div class="bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl p-4 shadow-sm flex items-center justify-between gap-3">
          <div class="flex flex-col gap-0.5">
            <span class="font-label-sm text-[11px] uppercase tracking-wider text-secondary-container font-bold">Can't decide today?</span>
            <h4 class="font-title-md text-title-md font-bold">Spin Student Thali Wheel</h4>
            <p class="font-body-sm text-body-sm text-on-primary/80">Get surprise ₹20 off trial lunch vouchers</p>
          </div>
          <button aria-label="Open Mystery Thali Picker" class="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0 shadow hover:scale-105 active:scale-95 transition-transform" onclick="openThaliWheelModal()">
            <span class="material-symbols-outlined text-[24px]">casino</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Search input typing listener with debounce
  const searchEl = document.getElementById('mess-search-input');
  if (searchEl) {
    searchEl.focus();
    let timeout;
    searchEl.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        renderExploreScreen(container);
      }, 350);
    });
  }
}

function renderExploreMessCard(mess) {
  const isFav = state.favorites.has(mess.id);

  return `
    <article class="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 relative">
      <div class="flex gap-3">
        <!-- Thumbnail -->
        <div class="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container cursor-pointer" onclick="navigateTo('mess', { id: ${mess.id} })">
          <img class="w-full h-full object-cover" src="${mess.banner_url || (mess.photos && mess.photos[0]) || ''}" alt="${mess.name}" />
          <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm font-label-sm text-[10px] text-primary font-bold flex items-center gap-0.5">
            <span class="w-1.5 h-1.5 rounded-full ${mess.is_pure_veg ? 'bg-primary' : 'bg-tertiary'}"></span> ${mess.is_pure_veg ? 'Veg' : 'Veg & Egg'}
          </span>
        </div>
        <!-- Info Block -->
        <div class="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-1">
              <h3 class="font-title-md text-title-md text-on-surface font-bold leading-tight truncate cursor-pointer hover:underline" onclick="navigateTo('mess', { id: ${mess.id} })">${mess.name}</h3>
              <button aria-label="Bookmark" class="text-outline hover:text-primary p-0.5 shrink-0 ${isFav ? 'text-error' : ''}" onclick="toggleBookmark(${mess.id})">
                <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' ${isFav ? 1 : 0};">${isFav ? 'favorite' : 'bookmark_border'}</span>
              </button>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="flex items-center gap-0.5 bg-surface-container px-1.5 py-0.5 rounded font-label-sm text-label-sm text-on-surface font-bold">
                <span class="material-symbols-outlined text-[13px] text-tertiary-container" style="font-variation-settings: 'FILL' 1;">star</span>
                ${mess.rating.toFixed(1)}
                <span class="text-outline font-normal text-[11px]">(${mess.review_count})</span>
              </span>
              <span class="text-outline text-label-sm">•</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-0.5">
                <span class="material-symbols-outlined text-[13px] text-outline">place</span>
                ${mess.distance_km} km away
              </span>
            </div>
          </div>
          <!-- Feature Tag -->
          <div class="flex items-center gap-1.5 text-primary bg-surface-container-low px-2 py-1 rounded-md mt-1 w-fit">
            <span class="material-symbols-outlined text-[15px]">bakery_dining</span>
            <span class="font-label-sm text-label-sm font-semibold truncate">${mess.cuisines}</span>
          </div>
        </div>
      </div>
      <!-- Action & Pricing Footer -->
      <div class="flex items-center justify-between pt-2 bg-surface-container-low/50 -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-xl">
        <div class="flex flex-col">
          <div class="flex items-baseline gap-1">
            <span class="font-headline-sm text-headline-sm text-primary font-bold">₹${mess.monthly_starting_price.toLocaleString('en-IN')}</span>
            <span class="font-label-sm text-label-sm text-outline">/month</span>
          </div>
          <span class="font-label-sm text-[10px] text-on-surface-variant">Single Thali: ₹${mess.single_thali_price} · 2 meals/day</span>
        </div>
        <button class="px-4 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container active:scale-95 transition-all shadow-xs flex items-center gap-1" onclick="navigateTo('mess', { id: ${mess.id} })">
          <span>View Details</span>
          <span class="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </article>
  `;
}

function renderEmptySearchState() {
  return `
    <div class="py-12 px-margin flex flex-col items-center justify-center text-center gap-3 bg-surface-container-lowest rounded-2xl shadow-sm">
      <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">
        <span class="material-symbols-outlined text-[32px]">search_off</span>
      </div>
      <h3 class="font-headline-sm text-headline-sm text-primary font-bold">No messes found</h3>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-xs">We couldn't find any mess matching your current filters or query in ${state.campusArea}.</p>
      <button class="mt-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm" onclick="clearAllFilters()">
        Clear All Filters
      </button>
    </div>
  `;
}

function clearSearchInput() {
  state.searchQuery = '';
  navigateTo('explore');
}

function toggleExploreFilter(key, val) {
  if (key === 'max_price') {
    state.filters.max_price = state.filters.max_price === val ? null : val;
  } else if (key === 'min_rating') {
    state.filters.min_rating = state.filters.min_rating === val ? null : val;
  } else if (key === 'max_distance') {
    state.filters.max_distance = state.filters.max_distance === val ? null : val;
  } else {
    state.filters[key] = !state.filters[key];
  }
  renderApp();
}

function clearAllFilters() {
  state.searchQuery = '';
  state.filters = {
    is_pure_veg: false,
    has_non_veg: false,
    has_egg: false,
    is_jain: false,
    is_vegan: false,
    has_high_protein: false,
    max_price: null,
    min_price: null,
    min_rating: null,
    max_distance: null,
    meal_type: '',
    sort: 'rating_desc'
  };
  renderApp();
}

// ==========================================
// SCREEN 3: MESS DETAILS
// ==========================================
async function renderMessDetailScreen(container, messId) {
  let data;
  try {
    data = await api(`/messes/${messId}`);
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-error">Failed to load mess details. ${err.message}</div>`;
    return;
  }

  const { mess, plans, weekly_menus, reviews } = data;
  state.currentMess = mess;
  const isFav = state.favorites.has(mess.id);
  const timing = mess.meal_timings || { breakfast: '7:30 - 9:30 AM', lunch: '12:30 - 2:30 PM', dinner: '7:30 - 10:00 PM' };

  // Set default selected plan
  if (!state.selectedPlan && plans.length > 0) {
    state.selectedPlan = plans[0];
  }

  const weeklyScheduleMap = {};
  weekly_menus.forEach(w => {
    weeklyScheduleMap[w.day_of_week] = w;
  });

  const activeDaySchedule = weeklyScheduleMap[state.activeWeeklyDay] || {
    lunch_menu: mess.today_lunch_menu || 'Dal Tadka, Shahi Paneer, Tawa Roti with Desi Ghee, Basmati Rice, Salad.',
    dinner_menu: mess.today_dinner_menu || 'Mixed Veg Sabzi, Dal Makhani, Phulkas, Steamed Rice, Sweet Kheer.',
    special_item: 'Unlimited Chapati'
  };

  container.innerHTML = `
    <div class="flex flex-col w-full pb-28">
      <!-- Back Header Bar -->
      <div class="px-margin py-2 flex items-center justify-between">
        <button class="inline-flex items-center gap-1 text-primary font-label-md text-label-md py-1.5 px-3 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors" onclick="history.back() || navigateTo('home')">
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Discovery</span>
        </button>
        <div class="flex items-center gap-2">
          <button aria-label="Share" class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface" onclick="shareMess('${mess.name}')">
            <span class="material-symbols-outlined text-[20px]">share</span>
          </button>
          <button aria-label="Save Mess" class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center ${isFav ? 'text-error' : 'text-on-surface-variant'}" onclick="toggleBookmark(${mess.id})">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' ${isFav ? 1 : 0};">${isFav ? 'favorite' : 'bookmark_border'}</span>
          </button>
        </div>
      </div>

      <!-- Top Gallery Carousel Preview -->
      <div class="relative w-full overflow-hidden bg-surface-container-high">
        <div class="relative w-full h-64 sm:h-72">
          <img id="mess-hero-image" class="w-full h-full object-cover transition-opacity duration-300" src="${(mess.photos && mess.photos[0]) || mess.banner_url || ''}" alt="${mess.name}" />
          <div class="absolute inset-0 bg-gradient-to-t from-on-background/80 via-transparent to-black/30"></div>
          
          <div class="absolute bottom-3 left-margin right-margin flex items-center justify-between text-on-primary">
            <div class="flex flex-wrap items-center gap-space-xs">
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm shadow-sm backdrop-blur-md">
                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">verified</span>
                Verified Partner
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest/90 text-on-surface font-label-sm text-label-sm shadow-sm">
                <span class="material-symbols-outlined text-[14px] text-tertiary-container" style="font-variation-settings: 'FILL' 1;">star</span>
                ${mess.rating.toFixed(1)} (${mess.review_count})
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm shadow-sm">
                <span class="material-symbols-outlined text-[14px]">health_and_safety</span>
                FSSAI Certified
              </span>
            </div>
            <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-inverse-surface/75 text-inverse-on-surface font-label-sm text-label-sm backdrop-blur-sm">
              <span class="material-symbols-outlined text-[13px]">photo_camera</span>
              ${(mess.photos && mess.photos.length) || 1} Photos
            </div>
          </div>
        </div>

        <!-- Quick Thumbnails Pill Navigation -->
        ${mess.photos && mess.photos.length > 1 ? `
          <div class="flex gap-2 p-2 px-margin overflow-x-auto bg-surface-container-low scrollbar-none">
            ${mess.photos.map((p, idx) => `
              <div class="relative w-14 h-11 flex-shrink-0 rounded-lg overflow-hidden ring-2 ${idx === 0 ? 'ring-primary' : 'ring-transparent opacity-80'} cursor-pointer hover:opacity-100 transition-all" onclick="changeHeroImage('${p}', this)">
                <img class="w-full h-full object-cover" src="${p}" alt="Thumbnail ${idx}" />
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Main Info Card -->
      <div class="px-margin pt-space-md flex flex-col gap-space-md">
        <!-- Title & Locality -->
        <div class="flex flex-col gap-space-xs">
          <div class="flex items-start justify-between gap-space-sm">
            <h2 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              ${mess.name}
            </h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full ${mess.is_open_now ? 'bg-secondary-container text-on-secondary-fixed' : 'bg-surface-container text-outline'} font-label-sm text-label-sm mt-1 whitespace-nowrap">
              ${mess.is_open_now ? 'Open Now' : 'Closed'}
            </span>
          </div>
          <div class="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm">
            <span class="material-symbols-outlined text-[16px] text-primary">location_on</span>
            <span class="truncate">${mess.address}</span>
          </div>
          <div class="flex items-center gap-2 font-label-md text-label-md text-secondary">
            <span>${mess.distance_km} km away</span>
            <span>•</span>
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">directions_walk</span>
              ${mess.walking_minutes} min walk
            </span>
            <span>•</span>
            <span class="text-on-surface-variant">${mess.is_pure_veg ? 'Pure Veg' : 'Veg + Egg Options'}</span>
          </div>
        </div>

        <!-- Quick CTA Action Pills -->
        <div class="grid grid-cols-3 gap-2">
          <a class="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-colors shadow-sm" href="tel:${mess.phone || '+919876543210'}">
            <span class="material-symbols-outlined text-[16px]">call</span>
            <span>Call Owner</span>
          </a>
          <button class="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-colors shadow-sm" onclick="scrollToMap()">
            <span class="material-symbols-outlined text-[16px]">directions</span>
            <span>Directions</span>
          </button>
          <a class="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-colors shadow-sm" href="https://wa.me/${mess.whatsapp || '919876543210'}" target="_blank">
            <span class="material-symbols-outlined text-[16px]">chat</span>
            <span>WhatsApp</span>
          </a>
        </div>

        <!-- Daily Meal Schedule Pills -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div class="flex items-center justify-between mb-space-sm">
            <h3 class="font-title-md text-title-md text-on-surface flex items-center gap-1.5 font-bold">
              <span class="material-symbols-outlined text-primary text-[18px]">schedule</span>
              Meal Timings
            </h3>
            <span class="font-label-sm text-label-sm text-secondary font-bold">Kitchen Operating</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-surface-container-low rounded-lg p-2.5 flex flex-col gap-0.5">
              <div class="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                <span class="material-symbols-outlined text-[14px]">light_mode</span>
                Breakfast
              </div>
              <span class="font-label-md text-label-md text-on-surface mt-0.5 font-semibold">${timing.breakfast || '7:30 - 9:30 AM'}</span>
              <span class="font-body-sm text-[11px] text-on-surface-variant leading-tight">Poha, Upma, Tea</span>
            </div>
            <div class="bg-primary-container text-on-primary rounded-lg p-2.5 flex flex-col gap-0.5 shadow-sm relative overflow-hidden">
              <div class="flex items-center gap-1 font-label-sm text-label-sm text-on-primary-container">
                <span class="material-symbols-outlined text-[14px]">sunny</span>
                Lunch (Live)
              </div>
              <span class="font-label-md text-label-md text-on-primary mt-0.5 font-semibold">${timing.lunch || '12:30 - 2:30 PM'}</span>
              <span class="font-body-sm text-[11px] text-on-primary-container leading-tight">Full Grand Thali</span>
            </div>
            <div class="bg-surface-container-low rounded-lg p-2.5 flex flex-col gap-0.5">
              <div class="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                <span class="material-symbols-outlined text-[14px]">nights_stay</span>
                Dinner
              </div>
              <span class="font-label-md text-label-md text-on-surface mt-0.5 font-semibold">${timing.dinner || '7:30 - 10:00 PM'}</span>
              <span class="font-body-sm text-[11px] text-on-surface-variant leading-tight">Light & Healthy</span>
            </div>
          </div>
        </div>

        <!-- Live Menu Spotlight Card (Today's Lunch) -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden">
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-error animate-pulse"></div>
              <h3 class="font-title-md text-title-md text-on-surface font-bold">Today's Live Menu</h3>
            </div>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary font-label-sm text-label-sm">
              <span class="material-symbols-outlined text-[13px]">lunch_dining</span>
              Today's Lunch
            </span>
          </div>
          <div class="bg-surface-container-low rounded-lg p-3 mb-3">
            <p class="font-body-md text-body-md text-on-surface leading-relaxed">${mess.today_lunch_menu || 'Dal Tadka, Paneer Butter Masala, Tawa Roti with Desi Ghee, Basmati Rice, Fresh Kachumber, Hot Gulab Jamun (1 pc).'}</p>
          </div>
          <div class="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm px-1">
            <span class="flex items-center gap-1 text-[12px]">
              <span class="material-symbols-outlined text-[15px] text-primary">eco</span>
              Freshly prepared hot today
            </span>
            <span class="font-label-sm text-label-sm text-primary font-bold">₹${mess.single_thali_price} Single Thali</span>
          </div>
        </div>

        <!-- Weekly Menu Schedule Section -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="font-title-md text-title-md text-on-surface font-bold">Weekly Menu Schedule</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Rotate flavors so you never get bored</p>
            </div>
            <span class="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
          </div>
          <!-- Day selector tabs -->
          <div class="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `
              <button class="day-tab px-3 py-1.5 rounded-full font-label-md text-label-md ${state.activeWeeklyDay === day ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'} shrink-0 transition-colors" onclick="changeWeeklyDay('${day}', ${mess.id})">
                ${day === 'Sun' ? 'Sun (Feast)' : day}
              </button>
            `).join('')}
          </div>
          <!-- Dynamic Meal Chart Container -->
          <div class="bg-surface-container-low rounded-lg p-3 mt-2 flex flex-col gap-2.5">
            <div class="flex items-center justify-between pb-2 border-b border-surface-container-highest/60">
              <span class="font-label-md text-label-md text-primary flex items-center gap-1 font-bold">
                <span class="material-symbols-outlined text-[16px]">sunny</span>
                Lunch (12:30 PM - 2:30 PM)
              </span>
              <span class="font-label-sm text-label-sm text-secondary font-bold">${activeDaySchedule.special_item || 'Special Dish'}</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface">
              ${activeDaySchedule.lunch_menu}
            </p>
            <div class="flex items-center justify-between pt-2 pb-1 border-t border-surface-container-highest/60">
              <span class="font-label-md text-label-md text-primary flex items-center gap-1 font-bold">
                <span class="material-symbols-outlined text-[16px]">nights_stay</span>
                Dinner (7:30 PM - 10:00 PM)
              </span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Hot Dessert</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface">
              ${activeDaySchedule.dinner_menu}
            </p>
          </div>
        </div>

        <!-- Membership Plans Matrix -->
        <div class="flex flex-col gap-space-sm" id="membershipSection">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-headline-sm text-headline-sm text-on-surface font-bold">
                Membership Plans
              </h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Choose your dining flexibility & save more</p>
            </div>
            <span class="inline-flex items-center px-2 py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm font-bold">
              Guaranteed Pure Ghee
            </span>
          </div>

          ${plans.map(plan => `
            <div class="plan-card relative bg-surface-container-lowest rounded-xl p-space-md shadow-sm cursor-pointer transition-all ${state.selectedPlan && state.selectedPlan.id === plan.id ? 'ring-2 ring-primary shadow-md' : 'border border-surface-container-high'}" onclick="selectPlanCard(${JSON.stringify(plan).replace(/"/g, '&quot;')})">
              ${plan.is_popular ? `
                <div class="absolute -top-3 right-4">
                  <span class="px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary font-label-sm text-label-sm shadow-sm flex items-center gap-1 font-bold">
                    <span class="material-symbols-outlined text-[13px]">local_fire_department</span>
                    Most Popular
                  </span>
                </div>
              ` : ''}
              <div class="flex items-start justify-between">
                <div class="flex flex-col">
                  <span class="font-title-md text-title-md text-on-surface font-bold">${plan.name}</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant">${plan.duration_days} Days · ${plan.meal_frequency_text}</span>
                </div>
                <div class="text-right">
                  <div class="flex items-baseline gap-1 justify-end">
                    ${plan.original_price ? `<span class="line-through text-on-surface-variant font-body-sm text-[12px]">₹${plan.original_price}</span>` : ''}
                    <span class="font-headline-sm text-headline-sm text-primary font-bold">₹${plan.price.toLocaleString('en-IN')}</span>
                  </div>
                  <span class="block font-body-sm text-body-sm text-on-surface-variant text-[11px]">₹${(plan.price / plan.duration_days).toFixed(0)} / day</span>
                </div>
              </div>
              <div class="mt-3 pt-2.5 flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border-t border-surface-container">
                <span class="flex items-center gap-1">
                  <span class="material-symbols-outlined text-secondary text-[16px]">check</span>
                  ${plan.features && plan.features[0] ? plan.features[0] : 'Full Thali Included'}
                </span>
                <span class="flex items-center gap-1 text-primary font-bold">
                  Select <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                </span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Facilities & Hygiene Standards Bento -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-3">
          <h3 class="font-title-md text-title-md text-on-surface flex items-center gap-1.5 font-bold">
            <span class="material-symbols-outlined text-primary text-[20px]">verified_user</span>
            Facilities & Hygiene Standards
          </h3>
          <div class="grid grid-cols-2 gap-2.5">
            <div class="bg-surface-container-low p-3 rounded-lg flex items-start gap-2.5">
              <div class="p-2 rounded-full bg-surface-container-highest text-primary">
                <span class="material-symbols-outlined text-[20px]">water_drop</span>
              </div>
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-on-surface font-semibold">RO Pure Water</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant text-[12px]">TDS tested daily below 90</span>
              </div>
            </div>
            <div class="bg-surface-container-low p-3 rounded-lg flex items-start gap-2.5">
              <div class="p-2 rounded-full bg-surface-container-highest text-primary">
                <span class="material-symbols-outlined text-[20px]">sanitizer</span>
              </div>
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-on-surface font-semibold">Kitchen Inspected</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant text-[12px]">Grade-A monthly audits</span>
              </div>
            </div>
            <div class="bg-surface-container-low p-3 rounded-lg flex items-start gap-2.5">
              <div class="p-2 rounded-full bg-surface-container-highest text-primary">
                <span class="material-symbols-outlined text-[20px]">festival</span>
              </div>
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-on-surface font-semibold">Weekend Feasts</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant text-[12px]">Poori chole & special kheer</span>
              </div>
            </div>
            <div class="bg-surface-container-low p-3 rounded-lg flex items-start gap-2.5">
              <div class="p-2 rounded-full bg-surface-container-highest text-primary">
                <span class="material-symbols-outlined text-[20px]">event_busy</span>
              </div>
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-on-surface font-semibold">Leave Deductions</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant text-[12px]">Pause meals when away</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Student Reviews Snip -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-title-md text-title-md text-on-surface font-bold">Hostelers' Feedback</span>
              <span class="inline-flex items-center gap-0.5 text-tertiary-container font-label-md text-label-md font-bold">
                <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
                ${mess.rating.toFixed(1)}
              </span>
            </div>
            <button class="font-label-sm text-label-sm text-primary font-bold underline" onclick="openReviewModal(${mess.id})">
              + Write Review
            </button>
          </div>

          ${reviews && reviews.length > 0 ? reviews.map(r => `
            <div class="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm flex items-center justify-center font-bold">
                    ${r.reviewer_name ? r.reviewer_name.substring(0, 2).toUpperCase() : 'ST'}
                  </div>
                  <div class="flex flex-col">
                    <span class="font-label-sm text-label-sm text-on-surface font-bold">${r.reviewer_name || 'Verified Student'}</span>
                    <span class="text-on-surface-variant text-[11px]">${r.reviewer_college || 'Hostel Student'}</span>
                  </div>
                </div>
                <div class="flex text-amber-400">
                  ${Array.from({ length: r.rating }).map(() => '<span class="material-symbols-outlined text-[14px]" style="font-variation-settings: \'FILL\' 1;">star</span>').join('')}
                </div>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant">"${r.comment}"</p>
            </div>
          `).join('') : '<p class="text-on-surface-variant text-body-sm">No reviews submitted yet. Be the first to share your dining experience!</p>'}
        </div>

        <!-- Location Map Anchor -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2.5" id="locationAnchor">
          <div class="flex items-center justify-between">
            <h3 class="font-title-md text-title-md text-on-surface flex items-center gap-1.5 font-bold">
              <span class="material-symbols-outlined text-primary text-[20px]">map</span>
              Location & Walking Distance
            </h3>
            <span class="font-label-sm text-label-sm text-secondary font-bold">${mess.locality}</span>
          </div>
          <div class="w-full h-40 bg-cover bg-center rounded-lg shadow-inner relative overflow-hidden" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDUvgbtWGJakYMeJHYOzYemJPjvvlMEYeUG901jBT1kNrkdVV7ZV5XgY7o1mmSKTmISXoYvDws_7zCiKcmIfnSAOeTMGNtzM_gLd4yq6noZHXaJCYmO9XnTbGAvCA30xfnLq7Fnb6xvoFWWsceW_4xPmRP4CV00daV8THMRAJ0wAO1z8NpdZ7TFV_Oc1K5n20WJpD9Na_NB_SdI4jz0DZuSq7_BFCbjC9ER7xa3b-WESMHuK8gZ1sVx')">
            <div class="absolute inset-0 bg-primary/10"></div>
            <div class="absolute bottom-2 left-2 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-on-surface font-label-sm text-label-sm shadow-sm flex items-center gap-1.5">
              <span class="material-symbols-outlined text-primary text-[16px]">navigation</span>
              <span>${mess.distance_km} km from Campus Center</span>
            </div>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${mess.address}</p>
        </div>
      </div>

      <!-- Sticky Bottom Subscription Dock -->
      <div class="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-margin py-3 border-t border-surface-container-high/50 flex items-center justify-between gap-space-md">
        <div class="flex flex-col min-w-0">
          <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Selected Plan</span>
          <div class="flex items-baseline gap-1">
            <span class="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold">₹${(state.selectedPlan ? state.selectedPlan.price : mess.monthly_starting_price).toLocaleString('en-IN')}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant">/ ${state.selectedPlan ? state.selectedPlan.duration_days + ' days' : 'month'}</span>
          </div>
          <span class="font-label-sm text-label-sm text-secondary truncate font-semibold">${state.selectedPlan ? state.selectedPlan.name : 'Monthly Standard'}</span>
        </div>
        <button class="flex-shrink-0 px-6 py-3 rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary transition-all active:scale-95 flex items-center gap-2" onclick="openCheckoutModal()">
          <span>Subscribe Now</span>
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  `;
}

function changeHeroImage(src, el) {
  const hero = document.getElementById('mess-hero-image');
  if (hero) hero.src = src;
  document.querySelectorAll('.ring-primary').forEach(r => r.classList.remove('ring-primary'));
  if (el) el.classList.add('ring-primary');
}

function changeWeeklyDay(day, messId) {
  state.activeWeeklyDay = day;
  renderMessDetailScreen(document.getElementById('main-content'), messId);
}

function selectPlanCard(plan) {
  state.selectedPlan = plan;
  renderMessDetailScreen(document.getElementById('main-content'), plan.mess_id);
}

function scrollToMap() {
  const mapEl = document.getElementById('locationAnchor');
  if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
}

function shareMess(name) {
  if (navigator.share) {
    navigator.share({ title: name, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href);
    showToast('Mess link copied to clipboard!');
  }
}

// ==========================================
// SCREEN 4: MY PLANS & DIGITAL MEAL PASS
// ==========================================
async function renderMyPlansScreen(container) {
  if (!state.token) {
    container.innerHTML = `
      <div class="py-16 px-margin flex flex-col items-center justify-center text-center gap-4">
        <div class="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center">
          <span class="material-symbols-outlined text-[32px]">badge</span>
        </div>
        <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Student Membership Pass</h2>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-xs">Log in to access your active meal cards, daily counter QR passes, and subscription tracking.</p>
        <button class="px-6 py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg shadow-md" onclick="navigateTo('auth')">
          Log In / Register
        </button>
      </div>
    `;
    return;
  }

  let orders = [];
  try {
    const res = await api('/orders/my-orders');
    orders = res.orders;
    state.myOrders = orders;
  } catch (err) {
    console.error(err);
  }

  const activeOrders = orders.filter(o => o.status === 'active');
  const upcomingOrders = orders.filter(o => o.status === 'pending');
  const pastOrders = orders.filter(o => ['expired', 'cancelled', 'rejected'].includes(o.status));

  const primaryActive = activeOrders[0];

  container.innerHTML = `
    <div class="flex flex-col w-full pb-12">
      <!-- Segmented Tab Navigation -->
      <div class="px-margin pt-space-sm pb-space-xs">
        <div class="bg-surface-container-high p-1 rounded-full flex items-center justify-between shadow-sm" role="tablist">
          <button class="flex-1 py-2 px-3 rounded-full ${state.plansActiveTab === 'active' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'} font-label-md text-label-md transition-all text-center shadow-sm flex items-center justify-center gap-1.5 min-h-[44px]" onclick="switchPlansTab('active')">
            <span>Active Plans</span>
            <span class="bg-secondary-container text-on-secondary-fixed text-[10px] font-bold px-1.5 py-0.5 rounded-full">${activeOrders.length}</span>
          </button>
          <button class="flex-1 py-2 px-3 rounded-full ${state.plansActiveTab === 'upcoming' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'} font-label-md text-label-md transition-all text-center hover:text-on-surface flex items-center justify-center gap-1.5 min-h-[44px]" onclick="switchPlansTab('upcoming')">
            <span>Pending/Upcoming</span>
            <span class="bg-surface-container text-on-surface-variant text-[10px] font-bold px-1.5 py-0.5 rounded-full">${upcomingOrders.length}</span>
          </button>
          <button class="flex-1 py-2 px-3 rounded-full ${state.plansActiveTab === 'past' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'} font-label-md text-label-md transition-all text-center hover:text-on-surface flex items-center justify-center gap-1.5 min-h-[44px]" onclick="switchPlansTab('past')">
            <span>Past</span>
            <span class="bg-surface-container text-on-surface-variant text-[10px] font-bold px-1.5 py-0.5 rounded-full">${pastOrders.length}</span>
          </button>
        </div>
      </div>

      <!-- ACTIVE PLANS TAB -->
      ${state.plansActiveTab === 'active' ? `
        ${primaryActive ? renderActivePassSection(primaryActive) : `
          <div class="py-12 px-margin text-center flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-[48px] text-outline">credit_card_off</span>
            <h3 class="font-headline-sm text-headline-sm text-primary font-bold">No Active Membership</h3>
            <p class="font-body-md text-body-md text-on-surface-variant max-w-xs">You don't have an active meal subscription yet. Explore nearby messes to activate your daily pass.</p>
            <button class="mt-2 px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md" onclick="navigateTo('explore')">
              Discover Messes
            </button>
          </div>
        `}
      ` : ''}

      <!-- UPCOMING / PENDING PLANS TAB -->
      ${state.plansActiveTab === 'upcoming' ? `
        <div class="px-margin py-4 flex flex-col gap-3">
          ${upcomingOrders.length === 0 ? `
            <div class="py-12 text-center flex flex-col items-center gap-2">
              <span class="material-symbols-outlined text-[40px] text-outline">upcoming</span>
              <h3 class="font-title-md text-title-md font-bold text-on-surface">No Pending Requests</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Any new membership orders awaiting mess owner confirmation will appear here.</p>
            </div>
          ` : upcomingOrders.map(o => `
            <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-2 border border-secondary-container">
              <div class="flex items-center justify-between">
                <span class="font-title-md text-title-md font-bold text-primary">${o.mess_name}</span>
                <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-label-sm font-bold uppercase">Pending Approval</span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${o.plan_name} · ₹${o.total_amount}</p>
              <span class="font-label-sm text-[11px] text-outline">Order #${o.order_number} · Requested on ${new Date(o.created_at).toLocaleDateString()}</span>
              <div class="p-2.5 rounded-xl bg-surface-container-low text-on-surface-variant text-body-sm">
                Owner will review and activate your meal pass shortly. You can contact them directly at ${o.mess_phone || '+919876543210'}.
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- PAST PLANS TAB -->
      ${state.plansActiveTab === 'past' ? `
        <div class="px-margin py-4 flex flex-col gap-3">
          ${pastOrders.length === 0 ? `
            <div class="py-12 text-center text-on-surface-variant">No past memberships on record.</div>
          ` : pastOrders.map(o => `
            <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="font-title-md text-title-md font-bold text-on-surface">${o.mess_name}</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant">${o.plan_name}</span>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-[11px] font-semibold capitalize">${o.status}</span>
              </div>
              <div class="flex items-center justify-between text-body-sm text-on-surface-variant pt-1">
                <span>${o.start_date} to ${o.end_date}</span>
                <span class="font-bold text-primary">${o.consumed_meals} / ${o.total_meals} Consumed</span>
              </div>
              <button class="w-full mt-2 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors font-label-md text-label-md text-primary font-semibold flex items-center justify-center gap-1" onclick="downloadInvoice('${o.order_number}', ${o.total_amount})">
                <span class="material-symbols-outlined text-[16px]">receipt</span>
                <span>Download Invoice</span>
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderActivePassSection(order) {
  const student = state.user || {};
  const studentProfile = student.profile || {};
  const percentUsed = Math.min(100, Math.round((order.consumed_meals / order.total_meals) * 100));

  return `
    <div class="flex flex-col gap-space-lg mt-space-sm">
      <!-- Digital Membership Card (Tactile Student Badge) -->
      <div class="px-margin">
        <div class="relative overflow-hidden rounded-2xl bg-primary text-on-primary shadow-xl p-space-lg flex flex-col gap-space-md">
          <div class="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-secondary-container/20 blur-2xl pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-primary-container/40 blur-xl pointer-events-none"></div>
          
          <!-- Top Badge Lockup & Holographic Verification -->
          <div class="flex items-center justify-between relative z-10">
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-secondary-container text-[20px]" style="font-variation-settings: 'FILL' 1;">badge</span>
              <span class="font-label-sm text-label-sm tracking-wider uppercase text-secondary-fixed">Student Meal Pass</span>
            </div>
            <div class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest/15 backdrop-blur-md text-on-primary">
              <span class="material-symbols-outlined text-[15px] text-secondary-container" style="font-variation-settings: 'FILL' 1;">verified_user</span>
              <span class="font-label-sm text-[10px] uppercase tracking-wider text-secondary-container font-bold">Holo Verified</span>
            </div>
          </div>

          <!-- Student Identity Row -->
          <div class="flex items-start justify-between gap-space-sm relative z-10 pt-1">
            <div class="min-w-0 flex-1">
              <h1 class="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tight text-surface-container-lowest truncate">${student.name || 'Aarav Sharma'}</h1>
              <p class="font-body-sm text-body-sm text-primary-fixed-dim truncate mt-0.5">${studentProfile.college_name || 'Faculty of Arts, North Campus'}</p>
              <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-lowest/10 mt-1.5">
                <span class="font-label-sm text-[11px] text-surface-container-highest uppercase font-medium">ID:</span>
                <span class="font-label-sm text-label-sm text-surface-container-lowest font-mono tracking-wide">${studentProfile.student_id_number || '#MM-8842-DEL'}</span>
              </div>
            </div>
            <div class="w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-md bg-primary-container relative">
              <img class="w-full h-full object-cover" src="${student.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuuEIH9qvK5SlflePztuaP24z2MFbVKbEQ0gpNHIJoTJLhc59Tuq102JjayEsuJxiR_aK5f3CsjEn_YFwL0QgKOs7qndEX44uqDWYzqoMHZtIdPc76VIpn7kUXJQQqcRNUTaY-Fi7Zrwgp619-TYU4nG0Op0coxQ5WoQT9R1hXue-sqtX3gZ4z8pTWC-IjyVMOARF6cJoxvRpHEPYvm6G5TGI89wH87dz8eWOoT4Xac9TZO0rbf57-'}" alt="${student.name}" />
            </div>
          </div>

          <!-- Mess Subscription Detail Box -->
          <div class="p-space-md rounded-xl bg-surface-container-lowest/10 backdrop-blur-md flex flex-col gap-1.5 relative z-10">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 truncate">
                <span class="material-symbols-outlined text-secondary-container text-[18px]">restaurant_menu</span>
                <span class="font-title-md text-title-md font-bold text-surface-container-lowest truncate">${order.mess_name}</span>
              </div>
              <span class="shrink-0 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-[10px] uppercase font-bold">Veg + Special</span>
            </div>
            <p class="font-body-sm text-body-sm text-primary-fixed-dim">${order.plan_name} · ${order.duration_days} Days</p>
            <div class="flex items-center gap-1.5 text-surface-container-highest mt-0.5">
              <span class="material-symbols-outlined text-[15px] text-secondary-container">calendar_month</span>
              <span class="font-label-md text-label-md">Valid till ${order.end_date}</span>
              <span class="text-primary-fixed-dim/70">·</span>
              <span class="font-label-md text-label-md text-secondary-container font-semibold">${order.total_meals - order.consumed_meals} Meals Left</span>
            </div>
          </div>

          <!-- Realtime Meal Eligibility Status Pill -->
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-lowest text-on-surface shadow-sm relative z-10">
            <span class="relative flex h-3 w-3 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-primary-container"></span>
            </span>
            <div class="flex flex-col min-w-0">
              <span class="font-label-sm text-[11px] uppercase tracking-wide text-secondary font-bold">Current Window</span>
              <span class="font-label-md text-label-md font-semibold text-on-surface truncate">Active for Today's Meal (${order.meal_timings && order.meal_timings.lunch || '12:30 PM - 2:30 PM'})</span>
            </div>
          </div>

          <!-- QR Code Counter Pass Section -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md flex flex-col items-center justify-center text-center gap-space-xs relative z-10 text-on-surface shadow-md">
            <div class="relative p-2.5 rounded-lg bg-surface flex items-center justify-center cursor-pointer" onclick="openEnlargedQrModal('${order.qr_code_token}')">
              <!-- Vector QR Code representation -->
              <svg class="w-36 h-36 text-primary" fill="currentColor" viewbox="0 0 120 120">
                <rect fill="#003f2b" height="30" rx="3" width="30" x="10" y="10"></rect>
                <rect fill="#ffffff" height="18" rx="2" width="18" x="16" y="16"></rect>
                <rect fill="#003f2b" height="10" rx="1" width="10" x="20" y="20"></rect>
                <rect fill="#003f2b" height="30" rx="3" width="30" x="80" y="10"></rect>
                <rect fill="#ffffff" height="18" rx="2" width="18" x="86" y="16"></rect>
                <rect fill="#003f2b" height="10" rx="1" width="10" x="90" y="20"></rect>
                <rect fill="#003f2b" height="30" rx="3" width="30" x="10" y="80"></rect>
                <rect fill="#ffffff" height="18" rx="2" width="18" x="16" y="86"></rect>
                <rect fill="#003f2b" height="10" rx="1" width="10" x="20" y="90"></rect>
                <rect fill="#003f2b" height="6" width="6" x="46" y="12"></rect>
                <rect fill="#003f2b" height="6" width="14" x="58" y="12"></rect>
                <rect fill="#546431" height="8" width="8" x="46" y="24"></rect>
                <rect fill="#003f2b" height="6" width="6" x="62" y="24"></rect>
                <rect fill="#003f2b" height="6" width="20" x="50" y="38"></rect>
                <rect fill="#003f2b" height="8" width="8" x="12" y="48"></rect>
                <rect fill="#546431" height="6" width="12" x="26" y="48"></rect>
                <rect fill="#003f2b" height="14" width="6" x="44" y="48"></rect>
                <rect fill="#003f2b" height="10" width="10" x="56" y="48"></rect>
                <rect fill="#003f2b" height="6" width="12" x="74" y="48"></rect>
                <rect fill="#546431" height="8" width="14" x="94" y="48"></rect>
                <rect fill="#003f2b" height="8" width="10" x="14" y="62"></rect>
                <rect fill="#003f2b" height="12" width="8" x="30" y="62"></rect>
                <rect fill="#003f2b" height="6" width="14" x="64" y="64"></rect>
                <rect fill="#003f2b" height="10" width="8" x="84" y="62"></rect>
                <rect fill="#003f2b" height="8" width="10" x="98" y="64"></rect>
                <rect fill="#003f2b" height="8" width="12" x="46" y="78"></rect>
                <rect fill="#546431" height="12" width="8" x="64" y="76"></rect>
                <rect fill="#003f2b" height="6" width="6" x="78" y="78"></rect>
                <rect fill="#003f2b" height="6" width="18" x="90" y="78"></rect>
                <rect fill="#003f2b" height="6" width="18" x="46" y="94"></rect>
                <rect fill="#003f2b" height="14" width="8" x="70" y="92"></rect>
                <rect fill="#003f2b" height="8" width="12" x="84" y="94"></rect>
                <rect fill="#546431" height="14" width="6" x="102" y="92"></rect>
                <circle cx="60" cy="60" fill="#1a5740" r="7"></circle>
                <circle cx="60" cy="60" fill="#d4e8a7" r="3"></circle>
              </svg>
              <div class="absolute -bottom-2 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-[10px] font-bold">Tap to Enlarge</div>
            </div>
            <div class="mt-2 flex items-center gap-1.5 text-on-surface-variant">
              <span class="material-symbols-outlined text-[16px] text-primary">qr_code_scanner</span>
              <span class="font-label-md text-label-md font-medium">Scan at mess counter before meals</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Attendance & Meal Consumption Progress Tracker -->
      <div class="px-margin flex flex-col gap-space-sm">
        <div class="flex items-center justify-between">
          <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Monthly Consumption</h2>
          <span class="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">${order.start_date} to ${order.end_date}</span>
        </div>
        <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-md">
          <div class="flex flex-col gap-space-xs">
            <div class="flex items-baseline justify-between">
              <div class="flex items-baseline gap-1">
                <span class="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">${order.consumed_meals}</span>
                <span class="font-body-md text-body-md text-on-surface-variant font-medium">/ ${order.total_meals} meals consumed</span>
              </div>
              <span class="font-label-md text-label-md font-bold text-primary-container bg-surface-container-low px-2 py-0.5 rounded-md">${percentUsed}% Utilized</span>
            </div>
            <div class="w-full h-3 rounded-full bg-surface-container-highest overflow-hidden p-0.5 flex">
              <div class="h-full rounded-full bg-primary-container transition-all duration-700" style="width: ${percentUsed}%"></div>
            </div>
            <div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant pt-1">
              <span>${order.total_meals - order.consumed_meals} Meals Remaining</span>
              <span>Pause Days Used: ${order.pause_days_used || 0}/${order.pause_days_allowed || 4}</span>
            </div>
          </div>

          <!-- Recent Check-ins Timeline -->
          <div class="flex flex-col gap-space-xs pt-space-xs">
            <span class="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Recent Counter Check-ins</span>
            <div class="flex flex-col gap-2">
              ${order.checkins && order.checkins.length > 0 ? order.checkins.map(chk => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
                  <div class="flex items-center gap-space-sm min-w-0">
                    <div class="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-fixed shrink-0">
                      <span class="material-symbols-outlined text-[18px]">${chk.meal_type === 'lunch' ? 'wb_sunny' : 'bedtime'}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-title-md text-title-md font-semibold text-on-surface capitalize">${chk.meal_type} Meal</span>
                        <span class="inline-flex items-center text-[11px] text-secondary font-semibold font-label-sm">
                          <span class="material-symbols-outlined text-[13px] mr-0.5">verified</span> Counter QR
                        </span>
                      </div>
                      <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${chk.meal_title}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end shrink-0 pl-2">
                    <span class="font-label-md text-label-md font-bold text-on-surface">${new Date(chk.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span class="font-label-sm text-[10px] text-secondary">Verified</span>
                  </div>
                </div>
              `).join('') : '<div class="text-on-surface-variant text-body-sm py-2">No meals scanned yet for this subscription cycle.</div>'}
            </div>
          </div>
        </div>
      </div>

      <!-- Plan Management & Action Hub -->
      <div class="px-margin flex flex-col gap-space-sm">
        <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Plan Management</h2>
        <div class="grid grid-cols-1 gap-2.5">
          <!-- Renew -->
          <button class="flex items-center justify-between p-space-md rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low transition-all shadow-sm text-left group min-h-[64px]" onclick="openRenewModal(${order.id}, ${order.total_amount})">
            <div class="flex items-center gap-space-md min-w-0">
              <div class="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span class="material-symbols-outlined text-[24px]">autorenew</span>
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-title-md text-title-md font-bold text-on-surface">Renew Subscription</span>
                  <span class="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary font-label-sm text-[11px] font-bold">Save ₹100</span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant truncate">Lock early student slot for next semester month</span>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-[22px]">chevron_right</span>
          </button>

          <!-- Pause -->
          <button class="flex items-center justify-between p-space-md rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low transition-all shadow-sm text-left group min-h-[64px]" onclick="openPauseModal(${order.id}, ${order.pause_days_allowed - (order.pause_days_used || 0)})">
            <div class="flex items-center gap-space-md min-w-0">
              <div class="w-11 h-11 rounded-xl bg-surface-container-high text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span class="material-symbols-outlined text-[22px]">pause_circle</span>
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-title-md text-title-md font-bold text-on-surface">Pause Membership</span>
                  <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[10px]">Up to 4 Days</span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant truncate">Exam break or trip? Push back your end date</span>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-[22px]">chevron_right</span>
          </button>

          <!-- Menu -->
          <button class="flex items-center justify-between p-space-md rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low transition-all shadow-sm text-left group min-h-[64px]" onclick="navigateTo('mess', { id: ${order.mess_id} })">
            <div class="flex items-center gap-space-md min-w-0">
              <div class="w-11 h-11 rounded-xl bg-surface-container-high text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span class="material-symbols-outlined text-[22px]">restaurant</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-title-md text-title-md font-bold text-on-surface">Mess Menu & Timings</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${order.mess_name} weekly schedule & specials</span>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-[22px]">chevron_right</span>
          </button>

          <!-- Receipt -->
          <button class="flex items-center justify-between p-space-md rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low transition-all shadow-sm text-left group min-h-[64px]" onclick="downloadInvoice('${order.order_number}', ${order.total_amount})">
            <div class="flex items-center gap-space-md min-w-0">
              <div class="w-11 h-11 rounded-xl bg-surface-container-high text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span class="material-symbols-outlined text-[22px]">receipt_long</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-title-md text-title-md font-bold text-on-surface">Receipts & Invoices</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant truncate">Download official invoice for hostel reimbursement</span>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-[22px]">chevron_right</span>
          </button>
        </div>
      </div>

      <!-- Trust Guarantee Note -->
      <div class="px-margin pt-space-xs">
        <div class="p-space-md rounded-2xl bg-surface-container-low flex items-start gap-space-sm text-on-surface">
          <span class="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">verified</span>
          <div class="flex flex-col">
            <span class="font-label-md text-label-md font-bold text-primary">MessMate Student Guarantee</span>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Unhappy with meal quality or hygiene? Report within 30 minutes of counter scan for instant meal re-credit or instant resolution.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchPlansTab(tab) {
  state.plansActiveTab = tab;
  renderMyPlansScreen(document.getElementById('main-content'));
}

// ==========================================
// SCREEN 5: SAVED / BOOKMARKS
// ==========================================
async function renderSavedScreen(container) {
  if (!state.token) {
    container.innerHTML = `
      <div class="py-16 px-margin text-center flex flex-col items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center">
          <span class="material-symbols-outlined text-[32px]">bookmark</span>
        </div>
        <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Saved Messes</h2>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-xs">Log in to view and manage your saved and bookmarked mess listings.</p>
        <button class="px-6 py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg shadow-md" onclick="navigateTo('auth')">Log In</button>
      </div>
    `;
    return;
  }

  let favs = [];
  try {
    const res = await api('/favorites');
    favs = res.favorites;
  } catch (err) {
    console.error(err);
  }

  container.innerHTML = `
    <div class="px-margin py-4 flex flex-col gap-4 pb-20">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Your Saved Messes</h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Quick access to your preferred dining spots</p>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-surface-container font-label-sm text-label-sm font-bold text-primary">${favs.length} Saved</span>
      </div>

      ${favs.length === 0 ? `
        <div class="py-16 text-center flex flex-col items-center gap-3 bg-surface-container-lowest rounded-2xl shadow-sm">
          <span class="material-symbols-outlined text-[48px] text-outline">bookmark_border</span>
          <h3 class="font-title-md text-title-md font-bold text-on-surface">No saved messes yet</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant max-w-xs">Tap the heart or bookmark icon on any mess card to keep track of it here.</p>
          <button class="mt-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm" onclick="navigateTo('explore')">
            Explore Messes
          </button>
        </div>
      ` : `
        <div class="flex flex-col gap-4">
          ${favs.map(m => renderExploreMessCard(m)).join('')}
        </div>
      `}
    </div>
  `;
}

// ==========================================
// SCREEN 6: COMPARE MESSES
// ==========================================
async function renderCompareScreen(container) {
  let messes = [];
  try {
    const res = await api('/messes');
    messes = res.messes;
  } catch (err) {
    console.error(err);
  }

  const mess1 = messes.find(m => m.id === state.compareMessIds[0]) || messes[0];
  const mess2 = messes.find(m => m.id === state.compareMessIds[1]) || messes[1] || messes[0];

  container.innerHTML = `
    <div class="px-margin py-4 flex flex-col gap-4 pb-20">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Compare Mess Services</h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Side-by-side comparison of meal plans & amenities</p>
        </div>
      </div>

      <!-- Selectors -->
      <div class="grid grid-cols-2 gap-2">
        <select class="p-2.5 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md border border-surface-container-high focus:outline-none" onchange="changeCompareMess(0, this.value)">
          ${messes.map(m => `<option value="${m.id}" ${mess1 && mess1.id === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
        <select class="p-2.5 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md border border-surface-container-high focus:outline-none" onchange="changeCompareMess(1, this.value)">
          ${messes.map(m => `<option value="${m.id}" ${mess2 && mess2.id === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </div>

      ${mess1 && mess2 ? `
        <div class="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-surface-container-high">
          <!-- Headers -->
          <div class="grid grid-cols-2 p-3 bg-surface-container-low border-b border-surface-container">
            <div class="text-center font-bold text-primary font-title-md truncate">${mess1.name}</div>
            <div class="text-center font-bold text-primary font-title-md truncate">${mess2.name}</div>
          </div>

          <!-- Price -->
          <div class="grid grid-cols-2 p-3 border-b border-surface-container text-center">
            <div>
              <span class="block font-headline-sm text-headline-sm text-primary font-bold">₹${mess1.monthly_starting_price}</span>
              <span class="text-[11px] text-outline">/month</span>
            </div>
            <div>
              <span class="block font-headline-sm text-headline-sm text-primary font-bold">₹${mess2.monthly_starting_price}</span>
              <span class="text-[11px] text-outline">/month</span>
            </div>
          </div>

          <!-- Single Thali Price -->
          <div class="grid grid-cols-2 p-3 border-b border-surface-container text-center font-label-md text-label-md">
            <div>Single Meal: <strong>₹${mess1.single_thali_price}</strong></div>
            <div>Single Meal: <strong>₹${mess2.single_thali_price}</strong></div>
          </div>

          <!-- Preference -->
          <div class="grid grid-cols-2 p-3 border-b border-surface-container text-center font-body-sm text-body-sm">
            <div>${mess1.is_pure_veg ? '🥦 Pure Veg' : '🍳 Veg & Egg'}</div>
            <div>${mess2.is_pure_veg ? '🥦 Pure Veg' : '🍳 Veg & Egg'}</div>
          </div>

          <!-- Distance & Walk -->
          <div class="grid grid-cols-2 p-3 border-b border-surface-container text-center font-body-sm text-body-sm">
            <div>${mess1.distance_km} km (${mess1.walking_minutes} min walk)</div>
            <div>${mess2.distance_km} km (${mess2.walking_minutes} min walk)</div>
          </div>

          <!-- Rating -->
          <div class="grid grid-cols-2 p-3 border-b border-surface-container text-center font-label-md text-label-md">
            <div class="flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-amber-400 text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
              <strong>${mess1.rating.toFixed(1)}</strong> (${mess1.review_count})
            </div>
            <div class="flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-amber-400 text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
              <strong>${mess2.rating.toFixed(1)}</strong> (${mess2.review_count})
            </div>
          </div>

          <!-- Cuisines -->
          <div class="grid grid-cols-2 p-3 border-b border-surface-container text-center font-body-sm text-body-sm text-on-surface-variant">
            <div>${mess1.cuisines}</div>
            <div>${mess2.cuisines}</div>
          </div>

          <!-- Actions -->
          <div class="grid grid-cols-2 p-4 gap-2">
            <button class="py-2.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-bold" onclick="navigateTo('mess', { id: ${mess1.id} })">
              Choose ${mess1.name.split(' ')[0]}
            </button>
            <button class="py-2.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-bold" onclick="navigateTo('mess', { id: ${mess2.id} })">
              Choose ${mess2.name.split(' ')[0]}
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function changeCompareMess(index, val) {
  state.compareMessIds[index] = Number(val);
  renderCompareScreen(document.getElementById('main-content'));
}

// ==========================================
// SCREEN 7: AUTHENTICATION
// ==========================================
function renderAuthScreen(container) {
  let isRegister = state.routeParams.mode === 'register';

  container.innerHTML = `
    <div class="px-margin py-8 flex flex-col items-center justify-center min-h-[80vh] pb-20">
      <div class="w-full max-w-sm bg-surface-container-lowest p-6 rounded-2xl shadow-md border border-surface-container flex flex-col gap-4">
        <div class="text-center flex flex-col items-center gap-1">
          <div class="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center mb-1">
            <span class="material-symbols-outlined text-[24px]">restaurant_menu</span>
          </div>
          <h2 class="font-headline-sm text-headline-sm text-primary font-bold">
            ${isRegister ? 'Join MessMate' : 'Welcome Back'}
          </h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            ${isRegister ? 'Create your account to discover & subscribe' : 'Log in to manage your mess plans'}
          </p>
        </div>

        <!-- Role Selector Tab for Registration -->
        ${isRegister ? `
          <div class="bg-surface-container p-1 rounded-xl flex items-center">
            <button id="auth-role-student" class="flex-1 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold shadow-xs transition-all" onclick="setAuthRole('student')">
              I am a Student
            </button>
            <button id="auth-role-owner" class="flex-1 py-1.5 rounded-lg text-on-surface-variant font-label-md text-label-md font-medium transition-all" onclick="setAuthRole('owner')">
              Mess Owner
            </button>
          </div>
        ` : ''}

        <form id="auth-form" class="flex flex-col gap-3" onsubmit="handleAuthSubmit(event, ${isRegister})">
          ${isRegister ? `
            <div>
              <label class="font-label-sm text-label-sm text-outline">Full Name</label>
              <input id="auth-name" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none border border-transparent focus:border-primary" placeholder="e.g. Aarav Sharma" required type="text" />
            </div>
          ` : ''}

          <div>
            <label class="font-label-sm text-label-sm text-outline">Email Address</label>
            <input id="auth-email" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none border border-transparent focus:border-primary" placeholder="name@domain.com" required type="email" />
          </div>

          <div>
            <label class="font-label-sm text-label-sm text-outline">Password</label>
            <input id="auth-password" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none border border-transparent focus:border-primary" placeholder="Minimum 6 characters" required type="password" />
          </div>

          ${isRegister ? `
            <div>
              <label class="font-label-sm text-label-sm text-outline">Phone Number</label>
              <input id="auth-phone" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none border border-transparent focus:border-primary" placeholder="+91 98765 43210" type="tel" />
            </div>
          ` : ''}

          <div id="auth-error" class="hidden text-error text-body-sm text-center"></div>

          <button id="auth-submit-btn" class="w-full mt-2 py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md hover:bg-primary-container transition-transform active:scale-95" type="submit">
            ${isRegister ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <div class="text-center pt-2 border-t border-surface-container">
          <button class="font-label-md text-label-md text-primary font-bold hover:underline" onclick="navigateTo('auth', { mode: '${isRegister ? 'login' : 'register'}' })">
            ${isRegister ? 'Already have an account? Log In' : "Don't have an account? Register as Student / Owner"}
          </button>
        </div>

        <!-- Quick 1-Click Demo Logins -->
        <div class="pt-2 flex flex-col gap-2">
          <span class="font-label-sm text-[11px] uppercase tracking-wider text-outline text-center">Quick 1-Click Demo Login</span>
          <div class="grid grid-cols-2 gap-2">
            <button class="py-2 px-2 rounded-xl bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm font-bold text-center hover:opacity-90 transition-opacity" onclick="demoLogin('student@messmate.com', 'password123')">
              👨‍🎓 Student Demo
            </button>
            <button class="py-2 px-2 rounded-xl bg-surface-container-high text-primary font-label-sm text-label-sm font-bold text-center hover:opacity-90 transition-opacity" onclick="demoLogin('owner@annapurna.com', 'password123')">
              👨‍🍳 Owner Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

let selectedAuthRole = 'student';
function setAuthRole(role) {
  selectedAuthRole = role;
  const studentBtn = document.getElementById('auth-role-student');
  const ownerBtn = document.getElementById('auth-role-owner');
  if (role === 'student') {
    studentBtn.className = 'flex-1 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold shadow-xs';
    ownerBtn.className = 'flex-1 py-1.5 rounded-lg text-on-surface-variant font-label-md text-label-md font-medium';
  } else {
    ownerBtn.className = 'flex-1 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold shadow-xs';
    studentBtn.className = 'flex-1 py-1.5 rounded-lg text-on-surface-variant font-label-md text-label-md font-medium';
  }
}

async function handleAuthSubmit(e, isRegister) {
  e.preventDefault();
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  try {
    if (isRegister) {
      const name = document.getElementById('auth-name').value.trim();
      const phone = document.getElementById('auth-phone').value.trim();
      const res = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          role: selectedAuthRole,
          phone,
          campus_area: state.campusArea
        })
      });
      loginSuccess(res.token, res.user);
    } else {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      loginSuccess(res.token, res.user);
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
}

async function demoLogin(email, password) {
  try {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    loginSuccess(res.token, res.user);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// SCREEN 8: MESS OWNER DASHBOARD
// ==========================================
async function renderOwnerScreen(container) {
  if (!state.token || (state.user && state.user.role !== 'owner' && state.user.role !== 'admin')) {
    container.innerHTML = `
      <div class="py-16 px-margin text-center flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-[48px] text-primary">storefront</span>
        <h2 class="font-headline-sm text-headline-sm text-primary font-bold">Mess Owner Portal</h2>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-xs">Log in as a registered Mess Owner to manage your business profile, menu schedule, and incoming student membership orders.</p>
        <button class="px-6 py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg shadow-md" onclick="navigateTo('auth', { mode: 'login' })">
          Mess Owner Login
        </button>
      </div>
    `;
    return;
  }

  let stats = {};
  let orders = [];
  try {
    stats = await api('/owner/stats');
    const orderRes = await api('/owner/orders');
    orders = orderRes.orders;
  } catch (err) {
    console.error(err);
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => o.status === 'active');

  container.innerHTML = `
    <div class="px-margin py-4 flex flex-col gap-4 pb-20">
      <!-- Owner Header & Stats Bento -->
      <div class="flex items-center justify-between">
        <div>
          <span class="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">Owner Dashboard</span>
          <h2 class="font-headline-sm text-headline-sm text-primary font-bold">${stats.mess_name || 'My Mess Business'}</h2>
        </div>
        <button class="px-3 py-1 rounded-full bg-surface-container font-label-sm text-label-sm text-primary font-bold" onclick="logout()">
          Logout
        </button>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="p-3 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col">
          <span class="font-label-sm text-[11px] text-outline uppercase font-semibold">Active Subscribers</span>
          <span class="font-headline-sm text-headline-sm text-primary font-bold mt-1">${stats.active_subscribers || 0}</span>
          <span class="text-[10px] text-secondary font-semibold">Daily Meal Passes</span>
        </div>
        <div class="p-3 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col">
          <span class="font-label-sm text-[11px] text-outline uppercase font-semibold">Pending Requests</span>
          <span class="font-headline-sm text-headline-sm text-tertiary font-bold mt-1">${stats.pending_requests || 0}</span>
          <span class="text-[10px] text-tertiary-container font-semibold">Awaiting Approval</span>
        </div>
        <div class="p-3 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col">
          <span class="font-label-sm text-[11px] text-outline uppercase font-semibold">Revenue</span>
          <span class="font-headline-sm text-headline-sm text-primary font-bold mt-1">₹${(stats.total_revenue || 0).toLocaleString('en-IN')}</span>
          <span class="text-[10px] text-secondary font-semibold">Subscription Dues</span>
        </div>
        <div class="p-3 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col">
          <span class="font-label-sm text-[11px] text-outline uppercase font-semibold">Meals Served Today</span>
          <span class="font-headline-sm text-headline-sm text-primary font-bold mt-1">${stats.today_meals_served || 0}</span>
          <span class="text-[10px] text-outline font-semibold">Counter Scans</span>
        </div>
      </div>

      <!-- Owner Action Tabs -->
      <div class="bg-surface-container-high p-1 rounded-full flex items-center overflow-x-auto scrollbar-none">
        <button class="flex-1 py-1.5 px-3 rounded-full ${state.ownerActiveTab === 'orders' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'} font-label-md text-label-md font-bold text-center shrink-0" onclick="switchOwnerTab('orders')">
          Orders (${pendingOrders.length})
        </button>
        <button class="flex-1 py-1.5 px-3 rounded-full ${state.ownerActiveTab === 'subscribers' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'} font-label-md text-label-md font-bold text-center shrink-0" onclick="switchOwnerTab('subscribers')">
          Subscribers (${activeOrders.length})
        </button>
        <button class="flex-1 py-1.5 px-3 rounded-full ${state.ownerActiveTab === 'menu' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'} font-label-md text-label-md font-bold text-center shrink-0" onclick="switchOwnerTab('menu')">
          Live Menu
        </button>
        <button class="flex-1 py-1.5 px-3 rounded-full ${state.ownerActiveTab === 'profile' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'} font-label-md text-label-md font-bold text-center shrink-0" onclick="switchOwnerTab('profile')">
          Mess Details
        </button>
      </div>

      <!-- TAB 1: INCOMING ORDERS -->
      ${state.ownerActiveTab === 'orders' ? `
        <div class="flex flex-col gap-3">
          <h3 class="font-title-md text-title-md text-on-surface font-bold">Incoming Membership Requests</h3>
          ${pendingOrders.length === 0 ? `
            <div class="py-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl p-4">
              No pending orders. All membership requests have been processed!
            </div>
          ` : pendingOrders.map(ord => `
            <div class="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col gap-2.5 border border-surface-container">
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="font-title-md text-title-md text-on-surface font-bold">${ord.student_name}</h4>
                  <span class="text-body-sm text-on-surface-variant">${ord.college_name || 'Student'} · ${ord.student_phone || ''}</span>
                </div>
                <span class="font-headline-sm text-headline-sm text-primary font-bold">₹${ord.total_amount}</span>
              </div>
              <div class="flex items-center gap-2 text-label-sm font-label-sm text-primary-container bg-surface-container-low px-2.5 py-1 rounded-md">
                <span class="material-symbols-outlined text-[16px]">receipt</span>
                <span>${ord.plan_name} (${ord.duration_days} Days) · Order #${ord.order_number}</span>
              </div>
              <div class="flex items-center gap-2 pt-1">
                <button class="flex-1 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold shadow hover:bg-primary-container transition-all" onclick="updateOrderStatus(${ord.id}, 'active')">
                  Accept & Activate Pass
                </button>
                <button class="px-4 py-2 rounded-full bg-surface-container text-error font-label-md text-label-md font-bold hover:bg-surface-container-high transition-all" onclick="updateOrderStatus(${ord.id}, 'rejected')">
                  Reject
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- TAB 2: ACTIVE SUBSCRIBERS ROSTER & COUNTER SCAN -->
      ${state.ownerActiveTab === 'subscribers' ? `
        <div class="flex flex-col gap-3">
          <div class="bg-secondary-container text-on-secondary-fixed p-4 rounded-2xl flex flex-col gap-2">
            <span class="font-title-md text-title-md font-bold flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              Counter Meal Check-in Scanner
            </span>
            <p class="font-body-sm text-body-sm text-on-secondary-fixed-variant">Scan or enter the student's digital pass QR code to log their meal attendance.</p>
            <div class="flex gap-2 mt-1">
              <input id="owner-qr-input" class="flex-1 p-2 rounded-xl bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none" placeholder="Enter QR code e.g. MM-PASS-8842" type="text" />
              <button class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold shrink-0" onclick="verifyStudentQr()">
                Verify & Serve
              </button>
            </div>
          </div>

          <h3 class="font-title-md text-title-md text-on-surface font-bold mt-2">Active Subscribers (${activeOrders.length})</h3>
          ${activeOrders.map(ord => `
            <div class="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <span class="font-title-md text-title-md text-on-surface font-bold">${ord.student_name}</span>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${ord.college_name || 'Hostel'} · ID: ${ord.student_id_number || 'N/A'}</p>
                <span class="font-label-sm text-[11px] text-secondary font-semibold">Valid till ${ord.end_date}</span>
              </div>
              <div class="text-right flex flex-col items-end">
                <span class="font-label-md text-label-md text-primary font-bold">${ord.consumed_meals} / ${ord.total_meals} Meals</span>
                <button class="mt-1 px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold" onclick="simulateStudentCheckin('${ord.qr_code_token}')">
                  + Log Meal
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- TAB 3: LIVE MENU EDITOR -->
      ${state.ownerActiveTab === 'menu' ? `
        <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3">
          <h3 class="font-title-md text-title-md text-on-surface font-bold">Update Today's Live Menu</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Update the dishes students will see on the home page and mess detail page today.</p>

          <div>
            <label class="font-label-sm text-label-sm text-outline">Today's Lunch Menu</label>
            <textarea id="owner-lunch-menu" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" rows="3">${state.user.mess ? state.user.mess.today_lunch_menu || '' : ''}</textarea>
          </div>

          <div>
            <label class="font-label-sm text-label-sm text-outline">Today's Dinner Menu</label>
            <textarea id="owner-dinner-menu" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" rows="3">${state.user.mess ? state.user.mess.today_dinner_menu || '' : ''}</textarea>
          </div>

          <button class="w-full py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md hover:bg-primary-container" onclick="saveOwnerMenu()">
            Save & Publish Live Menu
          </button>
        </div>
      ` : ''}

      <!-- TAB 4: MESS BUSINESS PROFILE -->
      ${state.ownerActiveTab === 'profile' ? `
        <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3">
          <h3 class="font-title-md text-title-md text-on-surface font-bold">Mess Business Details</h3>

          <div>
            <label class="font-label-sm text-label-sm text-outline">Business Name</label>
            <input id="owner-mess-name" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${state.user.mess ? state.user.mess.name : ''}" type="text" />
          </div>

          <div>
            <label class="font-label-sm text-label-sm text-outline">Locality / Address</label>
            <input id="owner-mess-address" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${state.user.mess ? state.user.mess.address : ''}" type="text" />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-label-sm text-label-sm text-outline">Monthly Starting Price (₹)</label>
              <input id="owner-mess-price" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${state.user.mess ? state.user.mess.monthly_starting_price : 1500}" type="number" />
            </div>
            <div>
              <label class="font-label-sm text-label-sm text-outline">Single Thali Price (₹)</label>
              <input id="owner-mess-single" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${state.user.mess ? state.user.mess.single_thali_price : 70}" type="number" />
            </div>
          </div>

          <div>
            <label class="font-label-sm text-label-sm text-outline">Cuisines / Specialties</label>
            <input id="owner-mess-cuisines" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${state.user.mess ? state.user.mess.cuisines : ''}" type="text" />
          </div>

          <button class="w-full py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md hover:bg-primary-container" onclick="saveOwnerProfile()">
            Update Business Profile
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function switchOwnerTab(tab) {
  state.ownerActiveTab = tab;
  renderOwnerScreen(document.getElementById('main-content'));
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await api(`/owner/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showToast(res.message);
    renderOwnerScreen(document.getElementById('main-content'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function verifyStudentQr() {
  const input = document.getElementById('owner-qr-input');
  if (!input || !input.value.trim()) return showToast('Please enter or scan a student QR code');
  await simulateStudentCheckin(input.value.trim());
}

async function simulateStudentCheckin(qrToken) {
  try {
    const res = await api('/owner/verify-counter-qr', {
      method: 'POST',
      body: JSON.stringify({ qr_token: qrToken, meal_type: 'lunch' })
    });
    showToast(res.message);
    renderOwnerScreen(document.getElementById('main-content'));
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveOwnerMenu() {
  const lunch = document.getElementById('owner-lunch-menu').value.trim();
  const dinner = document.getElementById('owner-dinner-menu').value.trim();
  try {
    const res = await api('/owner/mess-profile', {
      method: 'PUT',
      body: JSON.stringify({ today_lunch_menu: lunch, today_dinner_menu: dinner })
    });
    showToast('Menu updated and published live!');
    if (state.user && state.user.mess) {
      state.user.mess.today_lunch_menu = lunch;
      state.user.mess.today_dinner_menu = dinner;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveOwnerProfile() {
  const name = document.getElementById('owner-mess-name').value.trim();
  const address = document.getElementById('owner-mess-address').value.trim();
  const price = Number(document.getElementById('owner-mess-price').value);
  const single = Number(document.getElementById('owner-mess-single').value);
  const cuisines = document.getElementById('owner-mess-cuisines').value.trim();

  try {
    const res = await api('/owner/mess-profile', {
      method: 'PUT',
      body: JSON.stringify({
        name, address, monthly_starting_price: price, single_thali_price: single, cuisines
      })
    });
    showToast('Mess profile updated successfully!');
    if (state.user) state.user.mess = res.mess;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// SCREEN 9: STUDENT PROFILE & SETTINGS
// ==========================================
function renderProfileScreen(container) {
  const user = state.user || {};
  const profile = user.profile || {};

  container.innerHTML = `
    <div class="px-margin py-4 flex flex-col gap-4 pb-20">
      <div class="flex items-center gap-3 p-4 bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container">
        <img class="w-16 h-16 rounded-full object-cover shadow-sm" src="${user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}" alt="${user.name}" />
        <div class="flex flex-col min-w-0">
          <h2 class="font-headline-sm text-headline-sm text-primary font-bold truncate">${user.name || 'Student'}</h2>
          <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${user.email}</span>
          <span class="font-label-sm text-[11px] text-secondary font-bold uppercase tracking-wider mt-0.5">${user.role === 'owner' ? 'Mess Owner' : 'Verified Student'}</span>
        </div>
      </div>

      <!-- Profile Details Form -->
      <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3">
        <h3 class="font-title-md text-title-md text-on-surface font-bold">Personal & Hostel Details</h3>

        <div>
          <label class="font-label-sm text-label-sm text-outline">College / University</label>
          <input id="prof-college" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${profile.college_name || 'Faculty of Arts, North Campus'}" type="text" />
        </div>

        <div>
          <label class="font-label-sm text-label-sm text-outline">Hostel & Room No.</label>
          <input id="prof-hostel" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${profile.hostel_room || 'Hostel 4, Room 204'}" type="text" />
        </div>

        <div>
          <label class="font-label-sm text-label-sm text-outline">Phone Number</label>
          <input id="prof-phone" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" value="${user.phone || ''}" type="tel" />
        </div>

        <div>
          <label class="font-label-sm text-label-sm text-outline">Dietary Preference</label>
          <select id="prof-diet" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none">
            <option value="pure_veg" ${profile.dietary_preference === 'pure_veg' ? 'selected' : ''}>Pure Vegetarian</option>
            <option value="veg_egg" ${profile.dietary_preference === 'veg_egg' ? 'selected' : ''}>Vegetarian & Egg</option>
            <option value="non_veg" ${profile.dietary_preference === 'non_veg' ? 'selected' : ''}>Non-Vegetarian</option>
            <option value="jain" ${profile.dietary_preference === 'jain' ? 'selected' : ''}>Jain Friendly</option>
          </select>
        </div>

        <button class="w-full py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold" onclick="saveStudentProfile()">
          Save Changes
        </button>
      </div>

      <!-- Quick Actions -->
      <div class="flex flex-col gap-2">
        <button class="p-3.5 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between text-left" onclick="navigateTo('my-plans')">
          <span class="font-title-md text-title-md text-on-surface font-semibold">My Membership Passes</span>
          <span class="material-symbols-outlined text-outline">chevron_right</span>
        </button>
        <button class="p-3.5 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between text-left" onclick="navigateTo('saved')">
          <span class="font-title-md text-title-md text-on-surface font-semibold">Saved Bookmarks</span>
          <span class="material-symbols-outlined text-outline">chevron_right</span>
        </button>
        <button class="p-3.5 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between text-left text-error font-semibold" onclick="logout()">
          <span>Log Out</span>
          <span class="material-symbols-outlined text-error">logout</span>
        </button>
      </div>
    </div>
  `;
}

async function saveStudentProfile() {
  const college = document.getElementById('prof-college').value.trim();
  const hostel = document.getElementById('prof-hostel').value.trim();
  const phone = document.getElementById('prof-phone').value.trim();
  const diet = document.getElementById('prof-diet').value;

  try {
    const res = await api('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        college_name: college,
        hostel_room: hostel,
        phone,
        dietary_preference: diet
      })
    });
    state.user = res.user;
    showToast('Profile updated successfully!');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// MODALS & INTERACTIVE DRAWERS
// ==========================================

// 1. Plan Checkout Modal
function openCheckoutModal() {
  if (!state.token) {
    showToast('Please log in as a student to purchase a membership');
    return navigateTo('auth');
  }

  const plan = state.selectedPlan;
  const mess = state.currentMess;
  if (!plan || !mess) return;

  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  title.textContent = 'Confirm Membership Order';
  body.innerHTML = `
    <div class="flex flex-col gap-3">
      <div class="p-3.5 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-between">
        <div>
          <span class="font-title-md text-title-md font-bold">${plan.name}</span>
          <p class="font-body-sm text-body-sm text-on-secondary-fixed-variant">${mess.name}</p>
        </div>
        <span class="font-headline-sm text-headline-sm font-bold">₹${plan.price.toLocaleString('en-IN')}</span>
      </div>

      <div class="p-3 rounded-xl bg-surface-container-low text-on-surface flex flex-col gap-1 text-body-sm">
        <div class="flex justify-between"><span>Duration:</span> <strong>${plan.duration_days} Days</strong></div>
        <div class="flex justify-between"><span>Meals Inclusions:</span> <strong>${plan.meal_frequency_text || 'Lunch + Dinner'}</strong></div>
        <div class="flex justify-between"><span>Daily Pause Allowance:</span> <strong>Up to ${plan.max_pause_days || 4} Days</strong></div>
        <div class="flex justify-between"><span>Start Date:</span> <strong>Starts Today</strong></div>
      </div>

      <div>
        <label class="font-label-sm text-label-sm text-outline">Payment Method (Clearly Labelled Demo)</label>
        <select id="checkout-payment-method" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none">
          <option value="demo_upi">Demo UPI / Instant Approval</option>
          <option value="demo_counter">Pay Cash at Mess Counter</option>
          <option value="demo_netbanking">Demo Student NetBanking</option>
        </select>
      </div>

      <div class="p-2.5 rounded-xl bg-surface-container text-[11px] text-on-surface-variant leading-relaxed">
        <strong>Notice:</strong> This is a secure booking request. No actual money will be deducted from your bank. The mess owner will review and activate your meal pass.
      </div>
    </div>
  `;

  confirmBtn.textContent = `Confirm & Pay ₹${plan.price}`;
  confirmBtn.onclick = () => submitMembershipOrder(plan.id);

  showModal();
}

async function submitMembershipOrder(planId) {
  const method = document.getElementById('checkout-payment-method') ? document.getElementById('checkout-payment-method').value : 'demo_upi';
  hideModal();
  try {
    const res = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, payment_method: method })
    });
    showToast(res.message);
    navigateTo('my-plans');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Quick Trial Single Meal
async function quickBookTrial(messId) {
  if (!state.token) {
    showToast('Please log in to try a single trial meal');
    return navigateTo('auth');
  }
  // Find weekly plan or prompt
  navigateTo('mess', { id: messId });
}

// 2. Pause Membership Modal
function openPauseModal(orderId, remainingDays) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  title.textContent = 'Pause Meal Membership';
  body.innerHTML = `
    <div class="flex flex-col gap-3">
      <p class="font-body-md text-body-md text-on-surface">You have <strong>${remainingDays} pause days</strong> remaining in this cycle. Your end date will automatically extend.</p>
      <div>
        <label class="font-label-sm text-label-sm text-outline">Select Pause Duration</label>
        <div class="grid grid-cols-3 gap-2 mt-1">
          <button class="pause-opt-btn p-2 rounded-xl bg-primary text-on-primary font-bold text-center" data-days="2" onclick="selectPauseDays(2, this)">2 Days</button>
          <button class="pause-opt-btn p-2 rounded-xl bg-surface-container text-on-surface font-medium text-center" data-days="3" onclick="selectPauseDays(3, this)">3 Days</button>
          <button class="pause-opt-btn p-2 rounded-xl bg-surface-container text-on-surface font-medium text-center" data-days="4" onclick="selectPauseDays(4, this)">4 Days</button>
        </div>
      </div>
    </div>
  `;

  let selectedDays = 2;
  window.selectPauseDays = (days, el) => {
    selectedDays = days;
    document.querySelectorAll('.pause-opt-btn').forEach(b => {
      b.className = 'pause-opt-btn p-2 rounded-xl bg-surface-container text-on-surface font-medium text-center';
    });
    el.className = 'pause-opt-btn p-2 rounded-xl bg-primary text-on-primary font-bold text-center';
  };

  confirmBtn.textContent = 'Apply Pause';
  confirmBtn.onclick = async () => {
    hideModal();
    try {
      const res = await api(`/orders/${orderId}/pause`, {
        method: 'POST',
        body: JSON.stringify({ days: selectedDays })
      });
      showToast(res.message);
      renderMyPlansScreen(document.getElementById('main-content'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  showModal();
}

// 3. Renew Membership Modal
function openRenewModal(orderId, amount) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  const discounted = Math.max(0, amount - 100);

  title.textContent = 'Renew Subscription';
  body.innerHTML = `
    <div class="flex flex-col gap-3">
      <div class="p-3.5 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-between">
        <div>
          <span class="font-label-md text-label-md font-bold">Early Bird Campus Offer</span>
          <p class="font-body-sm text-body-sm">Flat ₹100 discount applied automatically</p>
        </div>
        <span class="font-headline-sm text-headline-sm font-bold">₹${discounted.toLocaleString('en-IN')}</span>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant">Your seat and preferred slots will continue without interruption.</p>
    </div>
  `;

  confirmBtn.textContent = `Pay ₹${discounted} (Demo)`;
  confirmBtn.onclick = async () => {
    hideModal();
    try {
      const res = await api(`/orders/${orderId}/renew`, { method: 'POST' });
      showToast(res.message);
      renderMyPlansScreen(document.getElementById('main-content'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  showModal();
}

// 4. Write Review Modal
function openReviewModal(messId) {
  if (!state.token) {
    showToast('Please log in to submit a review');
    return navigateTo('auth');
  }

  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  title.textContent = 'Rate & Review This Mess';
  body.innerHTML = `
    <div class="flex flex-col gap-3">
      <div>
        <label class="font-label-sm text-label-sm text-outline">Your Rating</label>
        <div class="flex items-center gap-2 mt-1">
          ${[1, 2, 3, 4, 5].map(star => `
            <button class="review-star-btn w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-amber-400 hover:scale-110 transition-transform" data-star="${star}" onclick="setReviewStar(${star})">
              <span class="material-symbols-outlined text-[24px]">star</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div>
        <label class="font-label-sm text-label-sm text-outline">Your Review Comment</label>
        <textarea id="review-comment-input" class="w-full mt-1 p-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none" rows="3" placeholder="How is the roti quality, dal, cleanliness, and seating?"></textarea>
      </div>
    </div>
  `;

  let currentRating = 5;
  window.setReviewStar = (val) => {
    currentRating = val;
    document.querySelectorAll('.review-star-btn').forEach((btn, idx) => {
      if (idx < val) {
        btn.classList.add('bg-secondary-container');
      } else {
        btn.classList.remove('bg-secondary-container');
      }
    });
  };
  window.setReviewStar(5);

  confirmBtn.textContent = 'Submit Review';
  confirmBtn.onclick = async () => {
    const comment = document.getElementById('review-comment-input').value.trim();
    if (!comment) return showToast('Please write a brief comment');
    hideModal();

    try {
      const res = await api(`/messes/${messId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: currentRating, comment })
      });
      showToast(res.message);
      renderMessDetailScreen(document.getElementById('main-content'), messId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  showModal();
}

// 5. Enlarged QR Modal
function openEnlargedQrModal(qrCode) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  title.textContent = 'Digital Counter Pass';
  body.innerHTML = `
    <div class="flex flex-col items-center justify-center text-center gap-3 p-2">
      <div class="p-4 rounded-2xl bg-white shadow-md flex items-center justify-center">
        <svg class="w-56 h-56 text-primary" fill="currentColor" viewbox="0 0 120 120">
          <rect fill="#003f2b" height="30" rx="3" width="30" x="10" y="10"></rect>
          <rect fill="#ffffff" height="18" rx="2" width="18" x="16" y="16"></rect>
          <rect fill="#003f2b" height="10" rx="1" width="10" x="20" y="20"></rect>
          <rect fill="#003f2b" height="30" rx="3" width="30" x="80" y="10"></rect>
          <rect fill="#ffffff" height="18" rx="2" width="18" x="86" y="16"></rect>
          <rect fill="#003f2b" height="10" rx="1" width="10" x="90" y="20"></rect>
          <rect fill="#003f2b" height="30" rx="3" width="30" x="10" y="80"></rect>
          <rect fill="#ffffff" height="18" rx="2" width="18" x="16" y="86"></rect>
          <rect fill="#003f2b" height="10" rx="1" width="10" x="20" y="90"></rect>
          <circle cx="60" cy="60" fill="#1a5740" r="10"></circle>
          <circle cx="60" cy="60" fill="#d4e8a7" r="4"></circle>
        </svg>
      </div>
      <span class="font-mono font-bold text-on-surface text-title-md">${qrCode || 'MM-PASS-8842'}</span>
      <p class="font-body-sm text-body-sm text-on-surface-variant">Present this screen directly at the mess kitchen scanner counter before collecting your thali.</p>
    </div>
  `;

  confirmBtn.textContent = 'Done';
  confirmBtn.onclick = hideModal;
  showModal();
}

// 6. Download Invoice Demo
function downloadInvoice(orderNum, amount) {
  const text = `
========================================
MESSMATE STUDENT MEAL SUBSCRIPTION INVOICE
========================================
Order Number: ${orderNum}
Date: ${new Date().toLocaleDateString()}
Student Name: ${state.user ? state.user.name : 'Aarav Sharma'}
Amount Paid: INR ${amount}.00
Payment Status: COMPLETED
GSTIN: 07AAAAA0000A1Z5
----------------------------------------
This invoice is certified for College Hostel
and University Reimbursement.
========================================
  `;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Invoice_${orderNum}.txt`;
  a.click();
  showToast('Invoice downloaded successfully!');
}

// 7. Thali Wheel Modal
function openThaliWheelModal() {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  title.textContent = 'Spin Student Thali Wheel';
  body.innerHTML = `
    <div class="flex flex-col items-center justify-center text-center gap-3 p-2">
      <div class="w-24 h-24 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center animate-bounce shadow-md">
        <span class="material-symbols-outlined text-[48px]">casino</span>
      </div>
      <span class="font-headline-sm text-headline-sm font-bold text-primary">You won ₹30 Off!</span>
      <p class="font-body-md text-body-md text-on-surface-variant">Coupon code: <strong class="text-tertiary font-mono">CAMPUSMEAL30</strong> has been copied to your clipboard!</p>
    </div>
  `;
  navigator.clipboard.writeText('CAMPUSMEAL30');
  confirmBtn.textContent = 'Claim Discount';
  confirmBtn.onclick = () => {
    hideModal();
    showToast('Code CAMPUSMEAL30 applied!');
  };
  showModal();
}

// 8. Location Picker Modal
function openLocationPickerModal() {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  title.textContent = 'Select Campus Locality';
  body.innerHTML = `
    <div class="flex flex-col gap-2">
      ${['North Campus', 'South Campus', 'Kamla Nagar', 'Hudson Lane', 'Patel Nagar Gate', 'Chhatra Marg'].map(loc => `
        <button class="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between text-left text-on-surface font-label-md text-label-md font-semibold transition-colors" onclick="selectCampusArea('${loc}')">
          <span>${loc}</span>
          ${state.campusArea === loc ? '<span class="material-symbols-outlined text-primary">check</span>' : ''}
        </button>
      `).join('')}
      <button class="mt-2 p-3 rounded-xl bg-primary-container text-on-primary flex items-center justify-center gap-2 font-label-md text-label-md font-bold" onclick="detectUserLocation()">
        <span class="material-symbols-outlined text-[18px]">near_me</span>
        <span>Use Device GPS Location</span>
      </button>
    </div>
  `;

  confirmBtn.textContent = 'Cancel';
  confirmBtn.onclick = hideModal;
  showModal();
}

function selectCampusArea(area) {
  state.campusArea = area;
  localStorage.setItem('mm_campus', area);
  hideModal();
  updateHeaderUI();
  showToast(`Locality updated to ${area}`);
  renderApp();
}

function detectUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        selectCampusArea('North Campus (GPS Near Science Block)');
      },
      (err) => {
        showToast('Location permission denied. Please select a locality manually.', 'error');
      }
    );
  } else {
    showToast('Geolocation not supported on this browser', 'error');
  }
}

// Modal Utility functions
function showModal() {
  const modal = document.getElementById('app-modal');
  const backdrop = document.getElementById('app-modal-backdrop');
  if (modal && backdrop) {
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
    modal.classList.remove('translate-y-full');
    modal.classList.add('translate-y-0');
  }
}

function hideModal() {
  const modal = document.getElementById('app-modal');
  const backdrop = document.getElementById('app-modal-backdrop');
  if (modal && backdrop) {
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    modal.classList.remove('translate-y-0');
    modal.classList.add('translate-y-full');
  }
}

// Filter Drawer functions (Explore bottom sheet)
function openFilterDrawer() {
  const drawer = document.getElementById('filter-drawer');
  const backdrop = document.getElementById('filter-drawer-backdrop');
  if (drawer && backdrop) {
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
    drawer.classList.remove('translate-y-full');
    drawer.classList.add('translate-y-0');
  }
}

function closeFilterDrawer() {
  const drawer = document.getElementById('filter-drawer');
  const backdrop = document.getElementById('filter-drawer-backdrop');
  if (drawer && backdrop) {
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    drawer.classList.remove('translate-y-0');
    drawer.classList.add('translate-y-full');
  }
}

function applyDrawerFilters() {
  closeFilterDrawer();
  navigateTo('explore');
}

// --- App Initialization ---
window.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  await loadFavorites();
  navigateTo('home');
});
