import type { ComponentInfo, ComponentResolver } from '../../types'
import { kebabCase } from '../utils'

export interface DevResolverOptions {
  /**
   * bring in components and styles
   *
   * @default true
   */
  importStyle?: boolean

  /**
   * auto import for directives
   *
   * @default true
   */
  directives?: boolean

  /**
   * use umd lib file
   */
  ssr?: boolean
}

const LIB_NAME = 'vue-devui'
const HARMLESS = ['ripple']

// Locate the target path folder.
function resolveDirectory(name: string, filename: string) {
  return `${LIB_NAME}/${name}/${filename}`
}

// Gets the component style file
function getSideEffects(name: string, filename: string) {
  if (HARMLESS.includes(name))
    return

  if (['row', 'col'].includes(name))
    return resolveDirectory('grid', filename)

  if (['aside', 'content', 'footer', 'header', 'layout'].includes(name))
    return resolveDirectory('layout', filename)

  if (['overlay', 'fixed-overlay', 'flexible-overlay'].includes(name))
    return resolveDirectory('overlay', filename)

  if (['panel', 'panel-header', 'panel-body'].includes(name))
    return resolveDirectory('panel', filename)

  if (['menu', 'menu-item', 'sub-menu'].includes(name))
    return resolveDirectory('menu', filename)

  if (['tabs', 'tab'].includes(name))
    return resolveDirectory('tabs', filename)

  if (['form', 'form-item', 'form-operation'].includes(name))
    return resolveDirectory('form', filename)

  if (['collapse', 'collapse-item'].includes(name))
    return resolveDirectory('collapse', filename)

  if (['steps', 'step'].includes(name))
    return resolveDirectory('steps', filename)

  if (['radio', 'radio-group', 'radio-button'].includes(name))
    return resolveDirectory('radio', filename)

  if (['column'].includes(name))
    return resolveDirectory('table', filename)

  if (['timeline-item'].includes(name))
    return resolveDirectory('timeline', filename)

  if (['splitter-pane'].includes(name))
    return resolveDirectory('splitter', filename)

  if (['option', 'option-group'].includes(name))
    return resolveDirectory("select", filename);

  if (['modal-header', 'modal-footer'].includes(name))
    return resolveDirectory("modal", filename);

  if (['breadcrumb-item'].includes(name))
    return resolveDirectory("breadcrumb", filename);

  if (['skeleton-item'].includes(name))
    return resolveDirectory("skeleton", filename);

  if (['button-group'].includes(name))
    return resolveDirectory("button", filename);

  if (['checkbox-group'].includes(name))
    return resolveDirectory("checkbox", filename);

  return resolveDirectory(name, filename)
}

function componentsResolver(name: string, { ssr }: DevResolverOptions): ComponentInfo | undefined {
  if (!name.match(/^D[A-Z]/))
    return

  // Alert => alert; DatePicker => date-picker
  const resolveId = kebabCase(name = name.slice(1))

  return {
    name,
    sideEffects: getSideEffects(resolveId, 'style.css'),
    from: getSideEffects(resolveId, `index.${ssr ? 'umd' : 'es'}.js`)!,
  }
}

function directivesResolver(name: string, { ssr }: DevResolverOptions): ComponentInfo | undefined {
  const resolveId = kebabCase(name)

  return {
    name: `${name}Directive`,
    sideEffects: getSideEffects(resolveId, 'style.css'),
    from: resolveDirectory(resolveId, `index.${ssr ? 'umd' : 'es'}.js`),
  }
}

export function DevUiResolver(options: DevResolverOptions = {}): ComponentResolver[] {
  const config = { directives: true, importStyle: true, ssr: false, ...options }

  const resolvers: ComponentResolver[] = [
    {
      type: 'component',
      resolve: (name: string) => componentsResolver(name, config),
    },
  ]

  if (config.directives) {
    resolvers.push({
      type: 'directive',
      resolve: (name: string) => directivesResolver(name, config),
    })
  }

  return resolvers
}
