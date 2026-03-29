<template>
  <div class="orbiting-circles">
    <svg
      v-if="path"
      class="orbit-path"
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
    >
      <circle
        class="orbit-path-circle"
        cx="50%"
        cy="50%"
        :r="radius"
        fill="none"
        :stroke="pathColor"
        stroke-width="1"
      />
    </svg>
    <div
      class="orbit-item"
      :style="{
        '--radius': radius + 'px',
        '--duration': duration + 's',
        '--delay': -delay + 's',
        '--direction': reverse ? -1 : 1,
        '--icon-size': iconSize + 'px',
        width: iconSize + 'px',
        height: iconSize + 'px'
      }"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  radius: {
    type: Number,
    default: 100
  },
  duration: {
    type: Number,
    default: 20
  },
  delay: {
    type: Number,
    default: 0
  },
  reverse: {
    type: Boolean,
    default: false
  },
  path: {
    type: Boolean,
    default: true
  },
  pathColor: {
    type: String,
    default: 'rgba(0, 0, 0, 0.1)'
  },
  iconSize: {
    type: Number,
    default: 30
  }
})

const size = computed(() => props.radius * 2 + props.iconSize + 20)
</script>

<style scoped>
.orbiting-circles {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.orbit-path {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.orbit-item {
  position: absolute;
  top: 50%;
  left: 50%;
  animation: orbit var(--duration) linear infinite;
  animation-delay: var(--delay);
  display: flex;
  justify-content: center;
  align-items: center;
}

@keyframes orbit {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) translateX(var(--radius)) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(calc(360deg * var(--direction))) translateX(var(--radius)) rotate(calc(-360deg * var(--direction)));
  }
}
</style>
