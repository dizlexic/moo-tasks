<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value },
    })
    success.value = true
  } catch (e: any) {
    error.value = e.data?.message || e.data?.statusMessage || 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-surface-dark flex flex-col items-center justify-center px-4 transition-colors duration-500 neon-grid-bg">
    <div class="neon-orb neon-orb-cyan" aria-hidden="true"></div>
    <div class="neon-orb neon-orb-purple" aria-hidden="true"></div>

    <div class="relative z-10 bg-white dark:bg-surface-card rounded-3xl shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-md p-10 border border-gray-200 dark:border-surface-border">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Forgot password</h2>
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8">Enter your email to receive reset instructions.</p>

      <div v-if="success" class="space-y-4">
        <div class="text-4xl text-center">📧</div>
        <p class="text-gray-900 dark:text-white font-medium text-center">If an account exists with that email, we've sent reset instructions.</p>
        <NuxtLink to="/login" class="block text-center text-neon-cyan font-bold hover:underline">Return to Login</NuxtLink>
      </div>

      <form v-else @submit.prevent="onSubmit" class="space-y-6">
        <div v-if="error" role="alert" class="bg-red-50 dark:bg-neon-red/10 text-red-600 dark:text-neon-red text-sm font-bold rounded-xl px-4 py-3 mb-6 border border-red-200 dark:border-neon-red/20">{{ error }}</div>

        <div class="space-y-2">
          <label for="forgot-email-field" class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Email</label>
          <input id="forgot-email-field" name="email" v-model="email" type="email" required autocomplete="email" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="you@example.com" />
        </div>

        <button id="forgot-submit-button" type="submit" :disabled="loading" class="w-full px-4 py-3.5 text-sm font-black uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-neon-cyan/20 active:scale-[0.98]">
          {{ loading ? 'Sending...' : 'Send Instructions' }}
        </button>
      </form>
    </div>
  </div>
</template>
