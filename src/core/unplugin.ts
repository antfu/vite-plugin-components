import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { Watching } from 'webpack'
import type { Options, PublicPluginAPI } from '../types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import chokidar from 'chokidar'
import { createUnplugin } from 'unplugin'
import { createFilter } from 'unplugin-utils'
import { Context } from './context'
import { shouldTransform, stringifyComponentImport } from './utils'

const PLUGIN_NAME = 'unplugin:webpack'

export default createUnplugin<Options>((options = {}) => {
  const filter = createFilter(
    options.include || [
      /\.vue$/,
      /\.vue\?vue/,
      /\.vue\.[tj]sx?\?vue/, // for vue-loader with experimentalInlineMatchResource enabled
      /\.vue\?v=/,
    ],
    options.exclude || [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/, /[\\/]\.nuxt[\\/]/],
  )
  const ctx: Context = new Context(options)

  const api: PublicPluginAPI = {
    async findComponent(name, filename) {
      return await ctx.findComponent(name, 'component', filename ? [filename] : [])
    },
    stringifyImport(info) {
      return stringifyComponentImport(info, ctx)
    },
  }

  return {
    name: 'unplugin-vue-components',
    enforce: 'post',

    api,

    transformInclude(id) {
      return filter(id)
    },

    async transform(code, id) {
      if (!shouldTransform(code))
        return null
      try {
        const result = await ctx.transform(code, id)
        ctx.generateDeclaration()
        ctx.generateComponentsJson()
        return result
      }
      catch (e) {
        this.error(e as any)
      }
    },

    vite: {
      configResolved(config: ResolvedConfig) {
        ctx.setRoot(config.root)
        ctx.sourcemap = true

        if (config.plugins.find(i => i.name === 'vite-plugin-vue2'))
          ctx.setTransformer('vue2')

        if (ctx.options.dts) {
          ctx.searchGlob()
          if (!existsSync(ctx.options.dts))
            ctx.generateDeclaration()
        }

        if (ctx.options.dumpUnimportComponents && ctx.dumpUnimportComponentsPath) {
          if (!existsSync(ctx.dumpUnimportComponentsPath))
            ctx.generateComponentsJson()
        }

        if (config.build.watch && config.command === 'build')
          ctx.setupWatcher(chokidar.watch(ctx.options.globs))
      },
      configureServer(server: ViteDevServer) {
        ctx.setupViteServer(server)
      },
    },

    webpack(compiler) {
      let watcher: Watching
      let fileDepQueue: { path: string, type: 'unlink' | 'add' }[] = []
      compiler.hooks.watchRun.tap(PLUGIN_NAME, () => {
        // ensure watcher is ready(supported since webpack@5.0.0-rc.1)
        if (!watcher && compiler.watching) {
          watcher = compiler.watching
          ctx.setupWatcherWebpack(chokidar.watch(ctx.options.globs), (path: string, type: 'unlink' | 'add') => {
            fileDepQueue.push({ path, type })
            // process.nextTick is for aggregated file change event
            process.nextTick(() => {
              watcher.invalidate()
            })
          })
        }
      })
      compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
        if (fileDepQueue.length) {
          fileDepQueue.forEach(({ path, type }) => {
            if (type === 'unlink')
              compilation.fileDependencies.delete(path)
            else
              compilation.fileDependencies.add(path)
          })
          fileDepQueue = []
        }
      })
    },
  }
})
