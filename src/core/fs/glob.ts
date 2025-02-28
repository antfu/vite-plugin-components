import type { Context } from '../context'
import Debug from 'debug'
import { globSync } from 'tinyglobby'
import { platform } from 'os'

const debug = Debug('unplugin-vue-components:glob')

export function searchComponents(ctx: Context) {
  debug(`started with: [${ctx.options.globs.join(', ')}]`)
  const root = ctx.root
  // Fixed a bug that contained parentheses in the win path  https://github.com/unplugin/unplugin-vue-components/issues/822
  if (platform() === 'win32') {
    ctx.options.globs = ctx.options.globs.map((dir) => fg.convertPathToPattern(dir))
  }
  const files = globSync(ctx.options.globs, {
    ignore: ctx.options.globsExclude,
    onlyFiles: true,
    cwd: root,
    absolute: true,
    expandDirectories: false,
  })

  if (!files.length && !ctx.options.resolvers?.length)

    console.warn('[unplugin-vue-components] no components found')

  debug(`${files.length} components found.`)

  ctx.addComponents(files)
}
