import type { ComponentResolver } from '../../types'

/**
 * Resolver for Vuetify
 *
 * @link https://github.com/vuetifyjs/vuetify
 */
export function VuetifyResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) => {
      if (name.match(/^V[A-Z]/))
        return { name, from: 'vuetify/lib' }
    },
  }
}

const _vLabsComponentNames = [
  'VCalendar',
  'VNumberInput',
  'VPicker',
  'VDateInput',
  'VPullToRefresh',
  'VSnackbarQueue',
  'VStepperVertical',
  'VTimePicker',
  'VTreeview'
]

/**
 * Resolver for Vuetify 3 Beta
 *
 * @link https://github.com/vuetifyjs/vuetify
 * @link https://vuetifyjs.com/en/labs/introduction/
 */
export function Vuetify3Resolver(useLabsComponent?: boolean = false): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) => {
      if (name.match(/^V[A-Z]/))
        return { name, from: useLabsComponent && _vLabsComponentNames.includes(name) ? 'vuetify/labs/components' : 'vuetify/components' }
    },
  }
}
