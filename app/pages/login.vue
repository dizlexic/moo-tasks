<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const { public: { siteName } } = useRuntimeConfig()

const isDark = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('moo-dark-mode')
  if (saved !== null) {
    isDark.value = saved === 'true'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  if (isDark.value) document.documentElement.classList.add('dark')
})

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    const { fetch: refreshSession } = useUserSession()
    await refreshSession()
    await navigateTo('/dashboard')
  } catch (e: any) {
    console.error('Login error:', e)
    error.value = e.data?.message || e.data?.statusMessage || e.statusMessage || e.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-surface-dark flex flex-col items-center justify-center px-4 transition-colors duration-500 neon-grid-bg">
    <div class="neon-orb neon-orb-cyan" aria-hidden="true"></div>
    <div class="neon-orb neon-orb-purple" aria-hidden="true"></div>

    <div class="relative z-10 mb-10 text-center">
      <div class="inline-block p-4 rounded-3xl bg-white dark:bg-surface-card shadow-xl dark:shadow-neon-cyan/10 border border-gray-100 dark:border-surface-border mb-6 hover:scale-105 transition-transform">
        <span class="text-5xl" aria-hidden="true">🐄</span>
      </div>
      <h1 class="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{{ siteName }}</h1>
    </div>

    <div class="relative z-10 bg-white dark:bg-surface-card rounded-3xl shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-md p-10 border border-gray-200 dark:border-surface-border transition-all">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Welcome back</h2>
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8">Please enter your details to sign in.</p>

      <div v-if="error" role="alert" class="bg-red-50 dark:bg-neon-red/10 text-red-600 dark:text-neon-red text-sm font-bold rounded-xl px-4 py-3 mb-6 border border-red-200 dark:border-neon-red/20">{{ error }}</div>

      <form @submit.prevent="onSubmit" class="space-y-6">
        <div class="space-y-2">
          <label for="email-field" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Email</label>
          <input id="email-field" name="email" v-model="email" type="email" required autocomplete="username" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="you@example.com" />
        </div>
        <div class="space-y-2">
          <label for="password-field" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Password</label>
          <input id="password-field" name="password" v-model="password" type="password" required autocomplete="current-password" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="••••••••" />
        </div>
        <button id="login-submit-button" type="submit" :disabled="loading" class="w-full px-4 py-3.5 text-xs font-black uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-neon-cyan/20 active:scale-[0.98]">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <div class="mt-8 pt-8 border-t border-gray-100 dark:border-surface-border/50 text-center">
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
          <NuxtLink to="/register" class="text-neon-cyan hover:text-neon-cyan/80 font-bold transition-colors">Register</NuxtLink>
          <span class="mx-2 text-gray-300 dark:text-surface-border">|</span>
          <a href="/forgot-password" class="text-neon-cyan hover:text-neon-cyan/80 font-bold transition-colors">Forgot password?</a>
        </p>
      </div>
    </div>
  </div>
</template>
