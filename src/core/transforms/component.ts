import type MagicString from 'magic-string'
import type { SupportedTransformer } from '../..'
import type { IGenComponentUsedPathOnBuildEndOptions } from '../../types'
import type { Context } from '../context'
import type { ResolveResult } from '../transformer'
import process from 'node:process'
import Debug from 'debug'
import { isExclude, pascalCase, stringifyComponentImport } from '../utils'

const debug = Debug('unplugin-vue-components:transform:component')
export const componentUsedMap: Record<string, any> = {}

function collectComponentUsedPath(component: any, sfcPath: any, options: IGenComponentUsedPathOnBuildEndOptions) {
  if (isExclude(component.as, options.exclude))
    return

  if (!componentUsedMap[component.as]) {
    componentUsedMap[component.as] = new Set()
    componentUsedMap[component.as].add(sfcPath)
  }
  else {
    componentUsedMap[component.as].add(sfcPath)
  }
}
function resolveVue2(code: string, s: MagicString) {
  const results: ResolveResult[] = []
  for (const match of code.matchAll(/\b(_c|h)\(\s*['"](.+?)["']([,)])/g)) {
    const [full, renderFunctionName, matchedName, append] = match
    if (match.index != null && matchedName && !matchedName.startsWith('_')) {
      const start = match.index
      const end = start + full.length
      results.push({
        rawName: matchedName,
        replace: resolved => s.overwrite(start, end, `${renderFunctionName}(${resolved}${append}`),
      })
    }
  }

  return results
}

function resolveVue3(
  code: string,
  s: MagicString,
  transformerUserResolveFunctions: boolean,
) {
  const results: ResolveResult[] = []

  /**
   * when using some plugin like plugin-vue-jsx, resolveComponent will be imported as resolveComponent1 to avoid duplicate import
   */
  for (const match of code.matchAll(/_?resolveComponent\d*\("(.+?)"\)/g)) {
    if (!transformerUserResolveFunctions && !match[0].startsWith('_')) {
      continue
    }
    const matchedName = match[1]
    if (match.index != null && matchedName && !matchedName.startsWith('_')) {
      const start = match.index
      const end = start + match[0].length
      results.push({
        rawName: matchedName,
        replace: resolved => s.overwrite(start, end, resolved),
      })
    }
  }

  return results
}

export default async function transformComponent(code: string, transformer: SupportedTransformer, s: MagicString, ctx: Context, sfcPath: string) {
  let no = 0

  const results = transformer === 'vue2'
    ? resolveVue2(code, s)
    : resolveVue3(code, s, ctx.options.transformerUserResolveFunctions)

  for (const { rawName, replace } of results) {
    debug(`| ${rawName}`)
    const name = pascalCase(rawName)
    ctx.updateUsageMap(sfcPath, [name])
    const component = await ctx.findComponent(name, 'component', [sfcPath])
    if (component) {
      const genComponentUsedPath = ctx.options.genComponentUsedPath
      if (genComponentUsedPath.enable)
        collectComponentUsedPath(component, sfcPath.replace(process.cwd(), ''), genComponentUsedPath)
      const varName = `__unplugin_components_${no}`
      s.prepend(`${stringifyComponentImport({ ...component, as: varName }, ctx)};\n`)
      no += 1
      replace(varName)
    }
  }

  debug(`^ (${no})`)
}
