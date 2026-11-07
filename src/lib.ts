// npm package entry ("craftbase"). The public surface is the embeddable
// <Craftbase> component plus its types. The standalone app boots from
// src/index.tsx and never imports this file.
//
//   import { Craftbase } from 'craftbase'
//   import 'craftbase/style.css'

import './embed/embed.css'

export { Craftbase } from './embed/Craftbase'
export type { CraftbaseProps, CraftbaseHandle } from './embed/Craftbase'
export type { StorageOption } from './embed/storageConsent'
export type {
    CraftbaseData,
    ComponentRecord,
    ComponentStore,
    ComponentMetadata,
} from './types/component'
