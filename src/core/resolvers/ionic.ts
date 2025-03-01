import type { ComponentResolver } from '../../types'

/**
 * source: https://github.com/nuxt-modules/ionic/blob/main/src/imports.ts
 * @author @danielroe
 */
// @keep-sorted
export const IonicBuiltInComponents = [
  'IonAccordion',
  'IonAccordionGroup',
  'IonActionSheet',
  'IonAlert',
  'IonApp',
  'IonAvatar',
  'IonBackButton',
  'IonBackdrop',
  'IonBadge',
  'IonBreadcrumb',
  'IonBreadcrumbs',
  'IonButton',
  'IonButtons',
  'IonCard',
  'IonCardContent',
  'IonCardHeader',
  'IonCardSubtitle',
  'IonCardTitle',
  'IonCheckbox',
  'IonChip',
  'IonCol',
  'IonContent',
  'IonDatetime',
  'IonDatetimeButton',
  'IonFab',
  'IonFabButton',
  'IonFabList',
  'IonFooter',
  'IonGrid',
  'IonHeader',
  'IonIcon',
  'IonImg',
  'IonInfiniteScroll',
  'IonInfiniteScrollContent',
  'IonInput',
  'IonInputPasswordToggle',
  'IonItem',
  'IonItemDivider',
  'IonItemGroup',
  'IonItemOption',
  'IonItemOptions',
  'IonItemSliding',
  'IonLabel',
  'IonList',
  'IonListHeader',
  'IonLoading',
  'IonMenu',
  'IonMenuButton',
  'IonMenuToggle',
  'IonModal',
  'IonNav',
  'IonNavLink',
  'IonNote',
  'IonPage',
  'IonPicker',
  'IonPickerColumn',
  'IonPickerColumnOption',
  'IonPickerLegacy',
  'IonPopover',
  'IonProgressBar',
  'IonRadio',
  'IonRadioGroup',
  'IonRange',
  'IonRefresher',
  'IonRefresherContent',
  'IonReorder',
  'IonReorderGroup',
  'IonRippleEffect',
  'IonRouterOutlet',
  'IonRow',
  'IonSearchbar',
  'IonSegment',
  'IonSegmentButton',
  'IonSegmentContent',
  'IonSegmentView',
  'IonSelectModal',
  'IonSelect',
  'IonSelectOption',
  'IonSkeletonText',
  'IonSpinner',
  'IonSplitPane',
  'IonTab',
  'IonTabBar',
  'IonTabButton',
  'IonTabs',
  'IonText',
  'IonTextarea',
  'IonThumbnail',
  'IonTitle',
  'IonToast',
  'IonToggle',
  'IonToolbar',
]

/**
 * Resolver for ionic framework
 *
 * @author @mathsgod @reslear
 * @link https://ionicframework.com/
 */
export function IonicResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) => {
      if (IonicBuiltInComponents.includes(name)) {
        return {
          name,
          from: '@ionic/vue',
        }
      }
    },
  }
}
