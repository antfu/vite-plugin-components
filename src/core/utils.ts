import type { FilterPattern } from 'unplugin-utils'
import type { ComponentInfo, ImportInfo, ImportInfoLegacy, Options, ResolvedOptions } from '../types'
import type { Context } from './context'
import { parse } from 'node:path'
import process from 'node:process'
import { slash, toArray } from '@antfu/utils'
import {
  getPackageInfo,
  isPackageExists,
} from 'local-pkg'
import { minimatch } from 'minimatch'
import { DISABLE_COMMENT } from './constants'

export const isSSR = Boolean(process.env.SSR || process.env.SSG || process.env.VITE_SSR || process.env.VITE_SSG)

export interface ResolveComponent {
  filename: string
  namespace?: string
}

export function pascalCase(str: string) {
  return capitalize(camelCase(str))
}

export function camelCase(str: string) {
  return str.replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ''))
}

export function kebabCase(key: string) {
  const result = key.replace(/([A-Z])/g, ' $1').trim()
  return result.split(' ').join('-').toLowerCase()
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function parseId(id: string) {
  const index = id.indexOf('?')
  if (index < 0) {
    return { path: id, query: {} }
  }
  else {
    const query = Object.fromEntries(new URLSearchParams(id.slice(index)) as any)
    return {
      path: id.slice(0, index),
      query,
    }
  }
}

export function isEmpty(value: any) {
  if (!value || value === null || value === undefined || (Array.isArray(value) && Object.keys(value).length <= 0))
    return true

  else
    return false
}

export function matchGlobs(filepath: string, globs: string[]) {
  for (const glob of globs) {
    const isNegated = glob.startsWith('!')
    const match = minimatch(slash(filepath), isNegated ? glob.slice(1) : glob)
    if (match)
      return !isNegated
  }
  return false
}

export function getTransformedPath(path: string, importPathTransform?: Options['importPathTransform']): string {
  if (importPathTransform) {
    const result = importPathTransform(path)
    if (result != null)
      path = result
  }

  return path
}

export function stringifyImport(info: ImportInfo | string) {
  if (typeof info === 'string')
    return `import '${info}'`
  if (!info.as)
    return `import '${info.from}'`
  else if (info.name)
    return `import { ${info.name} as ${info.as} } from '${info.from}'`
  else
    return `import ${info.as} from '${info.from}'`
}

export function normalizeComponentInfo(info: ImportInfo | ImportInfoLegacy | ComponentInfo): ComponentInfo {
  if ('path' in info) {
    return {
      from: info.path,
      as: info.name,
      name: info.importName,
      sideEffects: info.sideEffects,
    }
  }
  return info
}

export function stringifyComponentImport({ as: name, from: path, name: importName, sideEffects }: ComponentInfo, ctx: Context) {
  path = getTransformedPath(path, ctx.options.importPathTransform)

  const imports = [
    stringifyImport({ as: name, from: path, name: importName }),
  ]

  if (sideEffects)
    toArray(sideEffects).forEach(i => imports.push(stringifyImport(i)))

  return imports.join(';')
}

export function getNameFromFilePath(filePath: string, options: ResolvedOptions): string {
  const { resolvedDirs, directoryAsNamespace, globalNamespaces, collapseSamePrefixes } = options

  const parsedFilePath = parse(slash(filePath))

  let strippedPath = ''

  // remove include directories from filepath
  for (const dir of resolvedDirs) {
    if (parsedFilePath.dir.startsWith(dir)) {
      strippedPath = parsedFilePath.dir.slice(dir.length)
      break
    }
  }

  let folders = strippedPath.slice(1).split('/').filter(Boolean)
  let filename = parsedFilePath.name

  // set parent directory as filename if it is index
  if (filename === 'index' && !directoryAsNamespace) {
    // when use `globs` option, `resolvedDirs` will always empty, and `folders` will also empty
    if (isEmpty(folders))
      folders = parsedFilePath.dir.split('/').filter(Boolean)

    filename = `${folders.slice(-1)[0]}`
    return filename
  }

  if (directoryAsNamespace) {
    // remove namesspaces from folder names
    if (globalNamespaces.some((name: string) => folders.includes(name)))
      folders = folders.filter(f => !globalNamespaces.includes(f))

    folders = folders.map(f => f.replace(/[^a-z0-9\-]/gi, ''))

    if (filename.toLowerCase() === 'index')
      filename = ''

    if (!isEmpty(folders)) {
      // add folders to filename
      let namespaced = [...folders, filename]

      if (collapseSamePrefixes) {
        const collapsed: string[] = []

        for (const fileOrFolderName of namespaced) {
          let cumulativePrefix = ''
          let didCollapse = false
          const pascalCasedName = pascalCase(fileOrFolderName)

          for (const parentFolder of [...collapsed].reverse()) {
            cumulativePrefix = `${parentFolder}${cumulativePrefix}`

            if (pascalCasedName.startsWith(cumulativePrefix)) {
              const collapseSamePrefix = pascalCasedName.slice(cumulativePrefix.length)

              collapsed.push(collapseSamePrefix)

              didCollapse = true
              break
            }
          }

          if (!didCollapse)
            collapsed.push(pascalCasedName)
        }

        namespaced = collapsed
      }

      filename = namespaced.filter(Boolean).join('-')
    }

    return filename
  }

  return filename
}

export function resolveAlias(filepath: string, alias: any) {
  const result = filepath
  if (Array.isArray(alias)) {
    for (const { find, replacement } of alias)
      result.replace(find, replacement)
  }
  return result
}

export async function getPkgVersion(pkgName: string, defaultVersion: string): Promise<string> {
  try {
    const isExist = isPackageExists(pkgName)
    if (isExist) {
      const pkg = await getPackageInfo(pkgName)
      return pkg?.version ?? defaultVersion
    }
    else {
      return defaultVersion
    }
  }
  catch (err) {
    console.error(err)
    return defaultVersion
  }
}

export function shouldTransform(code: string) {
  if (code.includes(DISABLE_COMMENT))
    return false
  return true
}

export function isExclude(name: string, exclude?: FilterPattern): boolean {
  if (!exclude)
    return false

  if (typeof exclude === 'string')
    return name === exclude

  if (exclude instanceof RegExp)
    return !!name.match(exclude)

  if (Array.isArray(exclude)) {
    for (const item of exclude) {
      if (name === item || name.match(item))
        return true
    }
  }
  return false
}
