import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue2'
import Components from 'unplugin-vue-components/vite'

const config: UserConfig = {
  plugins: [
    Vue(),
    Components({
      transformer: 'vue2',
      dts: 'src/components.d.ts',
      dumpUnimportComponents: true,
    }),
  ],
  build: {
    sourcemap: true,
  },
}

export default config
