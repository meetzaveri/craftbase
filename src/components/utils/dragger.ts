import Two from 'two.js'
import { ZUI } from 'two.js/extras/jsm/zui'

import {
    offsetHeight,
    DISPLACEMENT_X_KEY,
    DISPLACEMENT_Y_KEY,
} from '../../constants/misc'
import { cbStorage } from '../../utils/storage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GroupLike = any

function handleDrag(
    twoJSInstance: TwoLike,
    group: GroupLike,
    el: string,
    cb?: () => void
): { mousemove: (e: MouseEvent) => void; mouseup: (e: MouseEvent) => void } {
    console.log('group scene', group, twoJSInstance.scene)

    const domElement: HTMLElement = group._renderer.elem
    const zui = new ZUI(group, domElement)
    document.getElementById(group.id)?.setAttribute('class', ' dragger-picker')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mouse = new (Two as any).Vector(group.translation.x, group.translation.y)
    let dragging = false

    zui.addLimits(0.06, 8)
    twoJSInstance.update()

    domElement.addEventListener('mousedown', mousedown, false)

    function mousedown(e: MouseEvent): void {
        const rect = group.getBoundingClientRect()
        dragging =
            mouse.x > rect.left &&
            mouse.x < rect.right &&
            mouse.y > rect.top &&
            mouse.y < rect.bottom
        mouse.x = e.clientX
        mouse.y = e.clientY
        window.addEventListener('mousemove', mousemove, false)
        window.addEventListener('mouseup', mouseup, false)
    }

    function mousemove(e: MouseEvent): void {
        const displacementX = parseInt(
            cbStorage.getItem(DISPLACEMENT_X_KEY) ?? '0'
        )
        const displacementY = parseInt(
            cbStorage.getItem(DISPLACEMENT_Y_KEY) ?? '0'
        )

        const dx = e.clientX - mouse.x
        const dy = e.clientY - mouse.y
        console.log(
            'mouse event 2',
            e,
            group.getBoundingClientRect(),
            group.getBoundingClientRect(true),
            displacementX,
            displacementY
        )
        if (dragging) {
            group.position.x += dx / 1
            group.position.y += dy / 1
        } else {
            zui.translateSurface(dx, dy)
        }

        twoJSInstance.update()
        cb?.()
    }

    function mouseup(e: MouseEvent): void {
        const scale = twoJSInstance.scene.scale

        cbStorage.setItem(
            `${el}_coordX`,
            String(
                parseInt(String(e.clientX)) +
                    scale * twoJSInstance.scene.translation.x
            )
        )
        cbStorage.setItem(
            `${el}_coordY`,
            String(
                parseInt(
                    String(
                        e.clientY +
                            offsetHeight +
                            scale * twoJSInstance.scene.translation.y
                    )
                )
            )
        )

        window.removeEventListener('mousemove', mousemove, false)
        window.removeEventListener('mouseup', mouseup, false)
        twoJSInstance.update()
    }

    return {
        mousemove,
        mouseup,
    }
}

export default handleDrag
