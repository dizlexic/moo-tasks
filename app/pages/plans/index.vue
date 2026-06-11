<script setup lang="ts">
const { user } = useUserSession()
const { data: plans, refresh } = await useFetch('/api/plans')

const showCreate = ref(false)
const newName = ref('')
const newDescription = ref('')
const creating = ref(false)
const createError = ref('')

async function onCreate() {
  if (!newName.value.trim()) return
  createError.value = ''
  creating.value = true
  try {
    await $fetch('/api/plans', {
      method: 'POST',
      body: {
        name: newName.value.trim(),
        description: newDescription.value.trim(),
        isPublic: false
      }
    })
    newName.value = ''
    newDescription.value = ''
    showCreate.value = false
    await refresh()
  } catch (e: any) {
    createError.value = e.data?.message || 'Failed to create plan'
  } finally {
    creating.value = false
  }
}

async function onDelete(id: string) {
  if (!confirm('Are you sure you want to delete this plan?')) return
  try {
    await $fetch(`/api/plans/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to delete plan')
  }
}
</script>

<template>
  <main class="p-6 md:p-8 max-w-6xl mx-auto space-y-12">
    <div class="flex items-center justify-between ml-1">
      <div>
        <h1 class="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Task Plans</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Reusable templates for your boards.</p>
      </div>
      <button
        @click="showCreate = true"
        class="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 transition-all hover:shadow-lg hover:shadow-neon-cyan/20 active:scale-95"
      >
        + New Plan
      </button>
    </div>

    <div v-if="!plans || plans.length === 0" class="text-center py-24 bg-white dark:bg-surface-card rounded-3xl border-2 border-dashed border-gray-200 dark:border-surface-border/50 shadow-inner">
      <div class="text-4xl mb-6">📋</div>
      <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">No plans yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">Create a plan to reuse sets of tasks across different boards.</p>
      <button
        @click="showCreate = true"
        class="px-8 py-3 text-xs font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-2xl hover:bg-neon-cyan/90 transition-all hover:shadow-xl hover:shadow-neon-cyan/20 active:scale-95"
      >
        Create first plan
      </button>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="group relative bg-white dark:bg-surface-card rounded-3xl shadow-sm border border-gray-200 dark:border-surface-border p-8 hover:border-neon-cyan/40 dark:hover:border-neon-cyan/30 transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col min-h-[180px]"
      >
        <NuxtLink :to="`/plans/${plan.id}`" class="flex-1">
          <div class="flex items-center justify-between mb-4">
            <span class="text-2xl" aria-hidden="true">📋</span>
            <span v-if="plan.isPublic" class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">Public</span>
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-neon-cyan transition-colors">{{ plan.name }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{{ plan.description || 'No description' }}</p>
        </NuxtLink>
        <div class="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-50 dark:border-surface-border/50">
           <button v-if="plan.creatorId === user?.id" @click="onDelete(plan.id)" class="text-gray-400 hover:text-red-500 transition-colors">
             <span class="sr-only">Delete</span>
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
             </svg>
           </button>
        </div>
      </div>
    </div>

    <!-- Create Plan Modal -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @mousedown.self="showCreate = false">
      <div class="bg-white dark:bg-surface-card rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-surface-border animate-in fade-in zoom-in duration-200">
        <div class="p-6 border-b border-gray-100 dark:border-surface-border flex justify-between items-center">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">Create New Plan</h2>
          <button @click="showCreate = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none">&times;</button>
        </div>
        <form @submit.prevent="onCreate" class="p-6 space-y-4">
          <div v-if="createError" class="p-3 bg-red-50 dark:bg-neon-red/10 border border-red-100 dark:border-neon-red/20 rounded-xl text-xs font-bold text-red-600 dark:text-neon-red">
            {{ createError }}
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Plan Name</label>
            <input v-model="newName" type="text" required autofocus class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all" placeholder="E.g., Nuxt Project Template" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Description</label>
            <textarea v-model="newDescription" rows="3" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all resize-none" placeholder="What is this plan for?"></textarea>
          </div>
          <button
            type="submit"
            :disabled="creating || !newName.trim()"
            class="w-full py-4 bg-neon-cyan text-cyan-950 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-neon-cyan/20 mt-2"
          >
            {{ creating ? 'Creating...' : 'Create Plan' }}
          </button>
        </form>
      </div>
    </div>
  </main>
</template>
