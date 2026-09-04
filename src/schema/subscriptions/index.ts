import { gql } from '@apollo/client'
import type { TypedDocumentNode } from '@apollo/client'
import type {
    UserDetailsSubscriptionSubscription,
    UserDetailsSubscriptionSubscriptionVariables,
    GetBoardComponentsSubscriptionSubscription,
    GetBoardComponentsSubscriptionSubscriptionVariables,
    GetComponentInfoSubscriptionSubscription,
    GetComponentInfoSubscriptionSubscriptionVariables,
    GetComponentsForBoardSubscriptionSubscription,
    GetComponentsForBoardSubscriptionSubscriptionVariables,
} from '../generated'

export const GET_USER_DETAILS: TypedDocumentNode<
    UserDetailsSubscriptionSubscription,
    UserDetailsSubscriptionSubscriptionVariables
> = gql`
    subscription userDetailsSubscription($id: String = "") {
        users: users_user(where: { id: { _eq: $id } }) {
            firstName
            id
        }
    }
`

export const GET_BOARD_DATA_SUBSCRIPTION: TypedDocumentNode<
    GetBoardComponentsSubscriptionSubscription,
    GetBoardComponentsSubscriptionSubscriptionVariables
> = gql`
    subscription getBoardComponentsSubscription($boardId: uuid! = "") {
        components: components_component(
            where: { boardId: { _eq: $boardId } }
        ) {
            id
            componentType
        }
    }
`

export const GET_COMPONENT_INFO_SUBSCRIPTION: TypedDocumentNode<
    GetComponentInfoSubscriptionSubscription,
    GetComponentInfoSubscriptionSubscriptionVariables
> = gql`
    subscription getComponentInfoSubscription($id: uuid = "") {
        component: components_component_by_pk(id: $id) {
            metadata
            width
            height
            fill
            id
            stroke
            linewidth
            strokeType
            x
            y
            x1
            y1
            x2
            y2
            componentType
            children
            updatedBy
            iconStroke
            textColor
        }
    }
`

export const GET_COMPONENTS_FOR_BOARD_SUBSCRIPTION: TypedDocumentNode<
    GetComponentsForBoardSubscriptionSubscription,
    GetComponentsForBoardSubscriptionSubscriptionVariables
> = gql`
    subscription getComponentsForBoardSubscription($boardId: uuid = "") {
        components: components_component(
            where: { boardId: { _eq: $boardId } }
        ) {
            id
            componentType
            objectClass
            children
            metadata
            x
            x1
            x2
            y
            y1
            y2
            fill
            width
            height
            iconStroke
            stroke
            linewidth
            strokeType
        }
    }
`
