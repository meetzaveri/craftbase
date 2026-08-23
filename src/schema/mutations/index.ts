import { gql } from '@apollo/client'
import type { TypedDocumentNode } from '@apollo/client'
import type {
    UpdateComponentInfoMutation,
    UpdateComponentInfoMutationVariables,
    InsertComponentMutation,
    InsertComponentMutationVariables,
    DeleteComponentByIdMutation,
    DeleteComponentByIdMutationVariables,
    InsertBulkComponentsMutation,
    InsertBulkComponentsMutationVariables,
    InsertUserMutation,
    InsertUserMutationVariables,
    CreateBaseMutation,
    CreateBaseMutationVariables,
    DeleteComponentsMutation,
    DeleteComponentsMutationVariables,
    UpdateBaseVisibilityMutation,
    UpdateBaseVisibilityMutationVariables,
    SharePersistedBaseMutation,
    SharePersistedBaseMutationVariables,
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

export const DELETE_COMPONENT_BY_ID: TypedDocumentNode<
    DeleteComponentByIdMutation,
    DeleteComponentByIdMutationVariables
> = gql`
    mutation deleteComponentById($id: uuid = "") {
        delete_components_component_by_pk(id: $id) {
            baseId
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
                baseId
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

export const CREATE_BASE: TypedDocumentNode<
    CreateBaseMutation,
    CreateBaseMutationVariables
> = gql`
    mutation createBase($object: bases_base_insert_input! = {}) {
        base: insert_bases_base_one(object: $object) {
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

export const UPDATE_BASE_VISIBILITY: TypedDocumentNode<
    UpdateBaseVisibilityMutation,
    UpdateBaseVisibilityMutationVariables
> = gql`
    mutation updateBaseVisibility($id: uuid = "") {
        update_bases_base_by_pk(
            pk_columns: { id: $id }
            _set: { isPublic: true }
        ) {
            id
            isPublic
        }
    }
`

/**
 * Share a base that is ALREADY persisted: publish it and refresh the view a
 * recipient lands on.
 *
 * Separate from `updateBaseVisibility` because re-sharing has to move the
 * landing view — the owner has almost certainly panned since the base was
 * created — while `updateBaseVisibility` is the create-time publish and has no
 * view to move.
 *
 * The anchor is deliberately NOT in the `_set`. It is the georeference every
 * stored element's x/y was measured against, so rewriting it would slide the
 * whole world under ink that stays put. It is written once, at create time.
 * Columns are named explicitly rather than taking a `bases_base_set_input`, so
 * this mutation can only ever touch these four.
 */
export const SHARE_PERSISTED_BASE: TypedDocumentNode<
    SharePersistedBaseMutation,
    SharePersistedBaseMutationVariables
> = gql`
    mutation sharePersistedBase(
        $id: uuid!
        $landingLng: float8
        $landingLat: float8
        $landingZoom: float8
    ) {
        base: update_bases_base_by_pk(
            pk_columns: { id: $id }
            _set: {
                isPublic: true
                landingLng: $landingLng
                landingLat: $landingLat
                landingZoom: $landingZoom
            }
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
