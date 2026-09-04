import { gql } from '@apollo/client'
import type { TypedDocumentNode } from '@apollo/client'
import type {
    MyQueryQuery,
    MyQueryQueryVariables,
    GetComponentTypesQuery,
    GetComponentTypesQueryVariables,
    GetComponentsForBoardQuery,
    GetComponentsForBoardQueryVariables,
    GetComponentInfoQueryQuery,
    GetComponentInfoQueryQueryVariables,
    GetBoardComponentsQuery,
    GetBoardComponentsQueryVariables,
    GetBoardComponentCountQuery,
    GetBoardComponentCountQueryVariables,
} from '../generated'

export const GET_USER_DETAILS: TypedDocumentNode<
    MyQueryQuery,
    MyQueryQueryVariables
> = gql`
    query MyQuery($id: String = "") {
        users: users_user(where: { id: { _eq: $id } }) {
            firstName
            id
        }
    }
`

export const GET_COMPONENT_TYPES: TypedDocumentNode<
    GetComponentTypesQuery,
    GetComponentTypesQueryVariables
> = gql`
    query getComponentTypes {
        componentTypes: components_componentType {
            label
            metadata
            logo
            width
            height
            fill
            textColor
        }
    }
`

export const GET_COMPONENTS_FOR_BOARD_QUERY: TypedDocumentNode<
    GetComponentsForBoardQuery,
    GetComponentsForBoardQueryVariables
> = gql`
    query getComponentsForBoard($boardId: uuid = "") {
        components: components_component(
            where: { boardId: { _eq: $boardId } }
            order_by: { position: asc }
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
            textColor
            opacity
            position
            tailShapeId
            tailEdge
            headShapeId
            headEdge
            tailPortIndex
            headPortIndex
        }
    }
`

export const GET_COMPONENT_INFO_QUERY: TypedDocumentNode<
    GetComponentInfoQueryQuery,
    GetComponentInfoQueryQueryVariables
> = gql`
    query getComponentInfoQuery($id: uuid = "") {
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
            opacity
        }
    }
`

export const GET_BOARD_DATA_QUERY: TypedDocumentNode<
    GetBoardComponentsQuery,
    GetBoardComponentsQueryVariables
> = gql`
    query getBoardComponents($boardId: uuid! = "") {
        components: components_component(
            where: { boardId: { _eq: $boardId } }
        ) {
            id
            componentType
        }
    }
`

export const GET_BOARD_COMPONENT_COUNT_QUERY: TypedDocumentNode<
    GetBoardComponentCountQuery,
    GetBoardComponentCountQueryVariables
> = gql`
    query getBoardComponentCount($boardId: uuid! = "") {
        components: components_component_aggregate(
            where: { boardId: { _eq: $boardId } }
        ) {
            aggregate {
                count
            }
        }
    }
`
