<script setup lang="ts">
definePageMeta({ layout: false })

const name = ref('')
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
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value },
    })
    const { fetch: refreshSession } = useUserSession()
    await refreshSession()
    await navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-surface-dark flex flex-col items-center justify-center px-4 transition-colors duration-500 neon-grid-bg">
    <div class="neon-orb neon-orb-purple" aria-hidden="true"></div>
    <div class="neon-orb neon-orb-cyan" aria-hidden="true"></div>

    <div class="relative z-10 mb-10 text-center">
      <div class="inline-block p-4 rounded-3xl bg-white dark:bg-surface-card shadow-xl dark:shadow-neon-purple/10 border border-gray-100 dark:border-surface-border mb-6 hover:scale-105 transition-transform">
        <span class="text-5xl" aria-hidden="true">🐄</span>
      </div>
      <h1 class="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{{ siteName }}</h1>
    </div>

    <div class="relative z-10 bg-white dark:bg-surface-card rounded-3xl shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-md p-10 border border-gray-200 dark:border-surface-border transition-all">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Create Account</h2>
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8">Join the herd and start managing tasks.</p>

      <div v-if="error" role="alert" class="bg-red-50 dark:bg-neon-red/10 text-red-600 dark:text-neon-red text-sm font-bold rounded-xl px-4 py-3 mb-6 border border-red-200 dark:border-neon-red/20">{{ error }}</div>

      <form @submit.prevent="onSubmit" class="space-y-5">
        <div class="space-y-1.5">
          <label for="reg-name-field" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Name</label>
          <input id="reg-name-field" name="name" v-model="name" type="text" required autocomplete="name" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400" placeholder="Your name" />
        </div>
        <div class="space-y-1.5">
          <label for="reg-email-field" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Email</label>
          <input id="reg-email-field" name="email" v-model="email" type="email" required autocomplete="email" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400" placeholder="you@example.com" />
        </div>
        <div class="space-y-1.5">
          <label for="reg-password-field" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Password</label>
          <input id="reg-password-field" name="password" v-model="password" type="password" required minlength="8" autocomplete="new-password" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400" placeholder="At least 8 characters" />
        </div>
        <button id="register-submit-button" type="submit" :disabled="loading" class="w-full px-4 py-3.5 text-xs font-black uppercase tracking-widest bg-neon-purple text-white rounded-xl hover:bg-neon-purple/90 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-neon-purple/20 active:scale-[0.98]">
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>

      <div class="mt-8 pt-8 border-t border-gray-100 dark:border-surface-border/50 text-center">
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Already have an account?
          <NuxtLink to="/login" class="text-neon-cyan hover:text-neon-cyan/80 font-bold transition-colors ml-1">Sign In</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
