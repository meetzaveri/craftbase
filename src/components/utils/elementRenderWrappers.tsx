import { useEffect, useState } from 'react'
import type { ComponentType, ReactElement } from 'react'
import Spinner from '../common/spinner'
import type { ComponentRecord, ComponentStore } from '../../types/board'

// Element components and their wrappers accept a fluid prop bag: ComponentRecord
// fields + canvas-side handles (twoJSInstance, itemData, etc.). Bag shape is
// stable in practice but typing it strictly would force every shape factory to
// declare a near-identical interface — defer to Stage 12.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any

interface WrapperData {
    id: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    twoJSInstance: any
    [key: string]: unknown
}

export const ElementRenderWrapper = (
    ElementToRender: ComponentType<ElementProps>,
    data: WrapperData,
    deleteComponentFromLocalStore: (id: string) => void,
    componentStore: ComponentStore
): (() => ReactElement) => {
    const RenderElement = (): ReactElement => {
        const [componentData, setComponentData] =
            useState<ComponentRecord | null>(null)

        useEffect(() => {
            // Keyed lookup, not a scan: this runs once per element, so an
            // Object.values(...).find() here made mounting a board O(n²).
            const match = componentStore[data.id]
            if (match) setComponentData(match)
        }, [])

        if (componentData === null) {
            return <></>
        }

        const handleDeleteComponent = (): void => {
            deleteComponentFromLocalStore(data.id)
        }

        return data.twoJSInstance ? (
            <ElementToRender
                handleDeleteComponent={handleDeleteComponent}
                {...data}
                {...componentData}
            />
        ) : (
            <Spinner />
        )
    }
    return RenderElement
}

export const GroupRenderWrapper = (
    ElementToRender: ComponentType<ElementProps>,
    data: WrapperData
): (() => ReactElement) => {
    const RenderGroup = (): ReactElement => {
        return data.twoJSInstance ? <ElementToRender {...data} /> : <Spinner />
    }
    return RenderGroup
}
