import { Transform } from 'vite'
import Debug from 'debug'
import { Context } from '../context'
import { normalize } from '../utils'

const debug = Debug('vite-plugin-components:transform:custom')

export function CustomComponentTransformer(ctx: Context): Transform {
  return {
    test(test) {
      return ctx.options.customLoaderMatcher(test)
    },
    transform({ code, path }) {
      const filepath = ctx.normalizePath(path)
      const componentNames = Array.from(code.matchAll(/_resolveComponent\("(.*)"\)/g)).map(i => normalize(i[1]))

      const entry = code.match(/export default ([a-zA-Z_$0-9]+);/)?.[1]

      if (!entry) {
        debug(code)
        debug(`Unabled to parse custom component: ${filepath}`)
        return code
      }

      debug(filepath, componentNames)

      if (componentNames.length) {
        const lines = code.split('\n')

        // tail is the export expression, should insert before it
        const tail = lines.pop()!
        let id = 0

        const injected: string[] = []

        for (const name of componentNames) {
          const component = ctx.findComponent(name, [filepath])
          if (!component)
            continue

          const var_name = `__vite_component_${id}`
          lines.push(`import ${var_name} from "/${component.path}"`)
          id += 1

          injected.push(`"${name}": ${var_name}`)
        }

        lines.push(`const __injected_components = { ${injected.join(',')} };`)

        // import a component resolver which is generated by the plugin
        lines.push(
          `${entry}.components = Object.assign({}, ${entry}.components || {}, __injected_components);`,
          tail,
        )

        return lines.join('\n')
      }

      return code
    },
  }
}
