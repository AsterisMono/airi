<script setup lang="ts">
import { defineProps, withDefaults } from 'vue'

import Collapsable from '../Collapsable.vue'

withDefaults(defineProps<{
  title: string
  icon: string
  innerClass?: string
  expand?: boolean
}>(), {
  expand: true,
})
</script>

<template>
  <Collapsable :default="expand">
    <template #trigger="slotProps">
      <button
        class="w-full flex items-center justify-between rounded-lg px-4 py-3 outline-none transition-all duration-250 ease-in-out"
        bg="zinc-100 dark:zinc-800"
        hover="bg-zinc-200 dark:bg-zinc-700"
        @click="slotProps.setVisible(!slotProps.visible)"
      >
        <div flex gap-1.5>
          <div :class="icon" size-6 />
          {{ title }}
        </div>
        <div
          i-solar:alt-arrow-down-bold-duotone
          transition="transform duration-250"
          :class="{ 'rotate-180': slotProps.visible }"
        />
      </button>
    </template>
    <div grid gap-4 p-4 :class="innerClass">
      <slot />
    </div>
  </Collapsable>
</template>
