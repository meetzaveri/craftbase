import { gql } from '@apollo/client'
import type { TypedDocumentNode } from '@apollo/client'
import type {
    UpdateComponentInfoMutation,
    UpdateComponentInfoMutationVariables,
    InsertComponentMutation,
    InsertComponentMutationVariables,
    UpdateBoardComponentsMutation,
    UpdateBoardComponentsMutationVariables,
    DeleteComponentByIdMutation,
    DeleteComponentByIdMutationVariables,
    InsertBulkComponentsMutation,
    InsertBulkComponentsMutationVariables,
    InsertUserMutation,
    InsertUserMutationVariables,
    CreateBoardMutation,
    CreateBoardMutationVariables,
    DeleteComponentsMutation,
    DeleteComponentsMutationVariables,
    UpdateBoardVisibilityMutation,
    UpdateBoardVisibilityMutationVariables,
    UpdateUserRevisitCountMutation,
    UpdateUserRevisitCountMutationVariables,
} from '../generated'

export const UPDATE_COMPONENT_INFO: TypedDocumentNode<
    UpdateComponentInfoMutation,
    UpdateComponentInfoMutationVariables
> = gql`
    mutation updateComponentInfo(
        $id: uuid = ""
        $updateObj: components_component_set_input = {}
    ) {
        update_components_component_by_pk(
            pk_columns: { id: $id }
            _set: $updateObj
        ) {
            id
        }
    }
`

export const INSERT_COMPONENT: TypedDocumentNode<
    InsertComponentMutation,
    InsertComponentMutationVariables
> = gql`
    mutation insertComponent($object: components_component_insert_input = {}) {
        component: insert_components_component_one(object: $object) {
            id
            componentType
        }
    }
`

export const UPDATE_BOARD_COMPONENTS: TypedDocumentNode<
    UpdateBoardComponentsMutation,
    UpdateBoardComponentsMutationVariables
> = gql`
    mutation updateBoardComponents($id: uuid = "", $components: jsonb = "") {
        update_boards_board_by_pk(
            pk_columns: { id: $id }
            _set: { components: $components }
        ) {
            id
        }
    }
`

export const DELETE_COMPONENT_BY_ID: TypedDocumentNode<
    DeleteComponentByIdMutation,
    DeleteComponentByIdMutationVariables
> = gql`
    mutation deleteComponentById($id: uuid = "") {
        delete_components_component_by_pk(id: $id) {
            boardId
        }
    }
`

export const INSERT_BULK_COMPONENTS: TypedDocumentNode<
    InsertBulkComponentsMutation,
    InsertBulkComponentsMutationVariables
> = gql`
    mutation insertBulkComponents(
        $objects: [components_component_insert_input!]! = {}
    ) {
        insert_components_component(objects: $objects) {
            affected_rows
            returning {
                boardId
                componentType
                id
            }
        }
    }
`

export const INSERT_USER_ONE: TypedDocumentNode<
    InsertUserMutation,
    InsertUserMutationVariables
> = gql`
    mutation insertUser($object: users_user_insert_input! = {}) {
        user: insert_users_user_one(object: $object) {
            id
            firstName
        }
    }
`

export const CREATE_BOARD: TypedDocumentNode<
    CreateBoardMutation,
    CreateBoardMutationVariables
> = gql`
    mutation createBoard($object: boards_board_insert_input! = {}) {
        board: insert_boards_board_one(object: $object) {
            id
            createdBy
        }
    }
`

export const DELETE_BULK_COMPONENTS: TypedDocumentNode<
    DeleteComponentsMutation,
    DeleteComponentsMutationVariables
> = gql`
    mutation deleteComponents($_in: [uuid!]! = "") {
        deleteComponents: delete_components_component(
            where: { id: { _in: $_in } }
        ) {
            affected_rows
        }
    }
`

export const UPDATE_BOARD_VISIBILITY: TypedDocumentNode<
    UpdateBoardVisibilityMutation,
    UpdateBoardVisibilityMutationVariables
> = gql`
    mutation updateBoardVisibility($id: uuid = "") {
        update_boards_board_by_pk(
            pk_columns: { id: $id }
            _set: { isPublic: true }
        ) {
            id
            isPublic
        }
    }
`

export const UPDATE_USER_REVISIT_COUNT: TypedDocumentNode<
    UpdateUserRevisitCountMutation,
    UpdateUserRevisitCountMutationVariables
> = gql`
    mutation updateUserRevisitCount(
        $userId: String!
        $lastVisit: timestamptz!
    ) {
        update_users_user_revisits_by_pk(
            pk_columns: { user_id: $userId }
            _inc: { count: "1" }
            _set: { last_visit: $lastVisit }
        ) {
            count
            user_id
            last_visit
        }
    }
`
