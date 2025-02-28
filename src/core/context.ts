import type fs from 'node:fs'
import type { UpdatePayload, ViteDevServer } from 'vite'
import type { ComponentInfo, Options, ResolvedOptions, Transformer } from '../types'
import { relative } from 'node:path'
import process from 'node:process'
import { slash, throttle, toArray } from '@antfu/utils'
import Debug from 'debug'
import { DIRECTIVE_IMPORT_PREFIX } from './constants'
import { writeComponentsJson, writeDeclaration } from './declaration'
import { searchComponents } from './fs/glob'
import { resolveOptions } from './options'
import transformer from './transformer'
import { getNameFromFilePath, isExclude, matchGlobs, normalizeComponentInfo, parseId, pascalCase, resolveAlias } from './utils'

const debug = {
  components: Debug('unplugin-vue-components:context:components'),
  search: Debug('unplugin-vue-components:context:search'),
  hmr: Debug('unplugin-vue-components:context:hmr'),
  declaration: Debug('unplugin-vue-components:declaration'),
  env: Debug('unplugin-vue-components:env'),
}

export class Context {
  options: ResolvedOptions
  transformer: Transformer = undefined!

  private _componentPaths = new Set<string>()
  private _componentNameMap: Record<string, ComponentInfo> = {}
  private _componentUsageMap: Record<string, Set<string>> = {}
  private _componentCustomMap: Record<string, ComponentInfo> = {}
  private _directiveCustomMap: Record<string, ComponentInfo> = {}
  private _server: ViteDevServer | undefined

  root = process.cwd()
  sourcemap: string | boolean = true
  alias: Record<string, string> = {}
  dumpUnimportComponentsPath: string | undefined

  constructor(
    private rawOptions: Options,
  ) {
    this.options = resolveOptions(rawOptions, this.root)
    this.generateDeclaration = throttle(500, this._generateDeclaration.bind(this), { noLeading: false })

    if (this.options.dumpUnimportComponents) {
      const dumpUnimportComponents = this.options.dumpUnimportComponents === true
        ? './.unimport-components.json'
        : this.options.dumpUnimportComponents ?? false

      this.dumpUnimportComponentsPath = dumpUnimportComponents
      this.generateComponentsJson = throttle(500, this._generateComponentsJson.bind(this), { noLeading: false })
    }

    this.setTransformer(this.options.transformer)
  }

  setRoot(root: string) {
    if (this.root === root)
      return
    debug.env('root', root)
    this.root = root
    this.options = resolveOptions(this.rawOptions, this.root)
  }

  setTransformer(name: Options['transformer']) {
    debug.env('transformer', name)
    this.transformer = transformer(this, name || 'vue3')
  }

  transform(code: string, id: string) {
    const { path, query } = parseId(id)
    return this.transformer(code, id, path, query)
  }

  setupViteServer(server: ViteDevServer) {
    if (this._server === server)
      return

    this._server = server
    this.setupWatcher(server.watcher)
  }

  setupWatcher(watcher: fs.FSWatcher) {
    const { globs } = this.options

    watcher
      .on('unlink', (path) => {
        if (!matchGlobs(path, globs))
          return

        path = slash(path)
        this.removeComponents(path)
        this.onUpdate(path)
      })
    watcher
      .on('add', (path) => {
        if (!matchGlobs(path, globs))
          return

        path = slash(path)
        this.addComponents(path)
        this.onUpdate(path)
      })
  }

  /**
   * start watcher for webpack
   */
  setupWatcherWebpack(watcher: fs.FSWatcher, emitUpdate: (path: string, type: 'unlink' | 'add') => void) {
    const { globs } = this.options

    watcher
      .on('unlink', (path) => {
        if (!matchGlobs(path, globs))
          return

        path = slash(path)
        this.removeComponents(path)
        emitUpdate(path, 'unlink')
      })
    watcher
      .on('add', (path) => {
        if (!matchGlobs(path, globs))
          return

        path = slash(path)
        this.addComponents(path)
        emitUpdate(path, 'add')
      })
  }

  /**
   * Record the usage of components
   * @param path
   * @param paths paths of used components
   */
  updateUsageMap(path: string, paths: string[]) {
    if (!this._componentUsageMap[path])
      this._componentUsageMap[path] = new Set()

    paths.forEach((p) => {
      this._componentUsageMap[path].add(p)
    })
  }

  addComponents(paths: string | string[]) {
    debug.components('add', paths)

    const size = this._componentPaths.size
    toArray(paths).forEach(p => this._componentPaths.add(p))
    if (this._componentPaths.size !== size) {
      this.updateComponentNameMap()
      return true
    }
    return false
  }

  addCustomComponents(info: ComponentInfo) {
    if (info.as)
      this._componentCustomMap[info.as] = info
  }

  addCustomDirectives(info: ComponentInfo) {
    if (info.as)
      this._directiveCustomMap[info.as] = info
  }

  removeComponents(paths: string | string[]) {
    debug.components('remove', paths)

    const size = this._componentPaths.size
    toArray(paths).forEach(p => this._componentPaths.delete(p))
    if (this._componentPaths.size !== size) {
      this.updateComponentNameMap()
      return true
    }
    return false
  }

  onUpdate(path: string) {
    this.generateDeclaration()

    if (!this._server)
      return

    const payload: UpdatePayload = {
      type: 'update',
      updates: [],
    }
    const timestamp = +new Date()
    const name = pascalCase(getNameFromFilePath(path, this.options))

    Object.entries(this._componentUsageMap)
      .forEach(([key, values]) => {
        if (values.has(name)) {
          const r = `/${slash(relative(this.root, key))}`
          payload.updates.push({
            acceptedPath: r,
            path: r,
            timestamp,
            type: 'js-update',
          })
        }
      })

    if (payload.updates.length)
      this._server.ws.send(payload)
  }

  private updateComponentNameMap() {
    this._componentNameMap = {}

    Array
      .from(this._componentPaths)
      .forEach((path) => {
        const name = pascalCase(getNameFromFilePath(path, this.options))
        if (isExclude(name, this.options.excludeNames)) {
          debug.components('exclude', name)
          return
        }
        if (this._componentNameMap[name] && !this.options.allowOverrides) {
          console.warn(`[unplugin-vue-components] component "${name}"(${path}) has naming conflicts with other components, ignored.`)
          return
        }

        this._componentNameMap[name] = {
          as: name,
          from: path,
        }
      })
  }

  async findComponent(name: string, type: 'component' | 'directive', excludePaths: string[] = []): Promise<ComponentInfo | undefined> {
    // resolve from fs
    let info = this._componentNameMap[name]
    if (info && !excludePaths.includes(info.from) && !excludePaths.includes(info.from.slice(1)))
      return info

    // custom resolvers
    for (const resolver of this.options.resolvers) {
      if (resolver.type !== type)
        continue

      const result = await resolver.resolve(type === 'directive' ? name.slice(DIRECTIVE_IMPORT_PREFIX.length) : name)
      if (!result)
        continue

      if (typeof result === 'string') {
        info = {
          as: name,
          from: result,
        }
      }
      else {
        info = {
          as: name,
          ...normalizeComponentInfo(result),
        }
      }
      if (type === 'component')
        this.addCustomComponents(info)
      else if (type === 'directive')
        this.addCustomDirectives(info)
      return info
    }

    return undefined
  }

  normalizePath(path: string) {
    // @ts-expect-error backward compatibility
    return resolveAlias(path, this.viteConfig?.resolve?.alias || this.viteConfig?.alias || [])
  }

  relative(path: string) {
    if (path.startsWith('/') && !path.startsWith(this.root))
      return slash(path.slice(1))
    return slash(relative(this.root, path))
  }

  _searched = false

  /**
   * This search for components in with the given options.
   * Will be called multiple times to ensure file loaded,
   * should normally run only once.
   */
  searchGlob() {
    if (this._searched)
      return

    searchComponents(this)
    debug.search(this._componentNameMap)
    this._searched = true
  }

  _generateDeclaration(removeUnused = !this._server) {
    if (!this.options.dts)
      return

    debug.declaration('generating dts')
    return writeDeclaration(this, this.options.dts, removeUnused)
  }

  generateDeclaration(removeUnused = !this._server): void {
    this._generateDeclaration(removeUnused)
  }

  _generateComponentsJson(removeUnused = !this._server) {
    if (!Object.keys(this._componentNameMap).length)
      return

    debug.components('generating components.json')
    return writeComponentsJson(this, removeUnused)
  }

  generateComponentsJson(removeUnused = !this._server): void {
    this._generateComponentsJson(removeUnused)
  }

  get componentNameMap() {
    return this._componentNameMap
  }

  get componentCustomMap() {
    return this._componentCustomMap
  }

  get directiveCustomMap() {
    return this._directiveCustomMap
  }
}
