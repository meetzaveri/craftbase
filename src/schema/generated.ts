/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: boolean | null | undefined;
  _gt?: boolean | null | undefined;
  _gte?: boolean | null | undefined;
  _in?: Array<boolean> | null | undefined;
  _is_null?: boolean | null | undefined;
  _lt?: boolean | null | undefined;
  _lte?: boolean | null | undefined;
  _neq?: boolean | null | undefined;
  _nin?: Array<boolean> | null | undefined;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: string | null | undefined;
  _gt?: string | null | undefined;
  _gte?: string | null | undefined;
  /** does the column match the given case-insensitive pattern */
  _ilike?: string | null | undefined;
  _in?: Array<string> | null | undefined;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: string | null | undefined;
  _is_null?: boolean | null | undefined;
  /** does the column match the given pattern */
  _like?: string | null | undefined;
  _lt?: string | null | undefined;
  _lte?: string | null | undefined;
  _neq?: string | null | undefined;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: string | null | undefined;
  _nin?: Array<string> | null | undefined;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: string | null | undefined;
  /** does the column NOT match the given pattern */
  _nlike?: string | null | undefined;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: string | null | undefined;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: string | null | undefined;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: string | null | undefined;
  /** does the column match the given SQL regular expression */
  _similar?: string | null | undefined;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
  _eq?: number | null | undefined;
  _gt?: number | null | undefined;
  _gte?: number | null | undefined;
  _in?: Array<number> | null | undefined;
  _is_null?: boolean | null | undefined;
  _lt?: number | null | undefined;
  _lte?: number | null | undefined;
  _neq?: number | null | undefined;
  _nin?: Array<number> | null | undefined;
};

/** Boolean expression to filter rows from the table "boards.board". All fields are combined with a logical 'AND'. */
export type Boards_Board_Bool_Exp = {
  _and?: Array<Boards_Board_Bool_Exp> | null | undefined;
  _not?: Boards_Board_Bool_Exp | null | undefined;
  _or?: Array<Boards_Board_Bool_Exp> | null | undefined;
  allowDeleteBy?: Jsonb_Comparison_Exp | null | undefined;
  allowUpdateBy?: Jsonb_Comparison_Exp | null | undefined;
  allowViewBy?: Jsonb_Comparison_Exp | null | undefined;
  comments?: Jsonb_Comparison_Exp | null | undefined;
  components?: Jsonb_Comparison_Exp | null | undefined;
  createdAt?: Bigint_Comparison_Exp | null | undefined;
  createdBy?: String_Comparison_Exp | null | undefined;
  createdByEmail?: String_Comparison_Exp | null | undefined;
  id?: Uuid_Comparison_Exp | null | undefined;
  isPublic?: Boolean_Comparison_Exp | null | undefined;
  name?: String_Comparison_Exp | null | undefined;
  subscribersData?: Jsonb_Comparison_Exp | null | undefined;
  updatedAt?: Bigint_Comparison_Exp | null | undefined;
  updatedBy?: String_Comparison_Exp | null | undefined;
};

/** unique or primary key constraints on table "boards.board" */
export type Boards_Board_Constraint =
  /** unique or primary key constraint on columns "id" */
  | 'board_pkey';

/** input type for inserting data into table "boards.board" */
export type Boards_Board_Insert_Input = {
  allowDeleteBy?: unknown;
  allowUpdateBy?: unknown;
  allowViewBy?: unknown;
  comments?: unknown;
  components?: unknown;
  createdAt?: number | null | undefined;
  createdBy?: string | null | undefined;
  createdByEmail?: string | null | undefined;
  id?: string | null | undefined;
  isPublic?: boolean | null | undefined;
  name?: string | null | undefined;
  subscribersData?: unknown;
  updatedAt?: number | null | undefined;
  updatedBy?: string | null | undefined;
};

/** input type for inserting object relation for remote table "boards.board" */
export type Boards_Board_Obj_Rel_Insert_Input = {
  data: Boards_Board_Insert_Input;
  /** upsert condition */
  on_conflict?: Boards_Board_On_Conflict | null | undefined;
};

/** on_conflict condition type for table "boards.board" */
export type Boards_Board_On_Conflict = {
  constraint: Boards_Board_Constraint;
  update_columns?: Array<Boards_Board_Update_Column>;
  where?: Boards_Board_Bool_Exp | null | undefined;
};

/** update columns of table "boards.board" */
export type Boards_Board_Update_Column =
  /** column name */
  | 'allowDeleteBy'
  /** column name */
  | 'allowUpdateBy'
  /** column name */
  | 'allowViewBy'
  /** column name */
  | 'comments'
  /** column name */
  | 'components'
  /** column name */
  | 'createdAt'
  /** column name */
  | 'createdBy'
  /** column name */
  | 'createdByEmail'
  /** column name */
  | 'id'
  /** column name */
  | 'isPublic'
  /** column name */
  | 'name'
  /** column name */
  | 'subscribersData'
  /** column name */
  | 'updatedAt'
  /** column name */
  | 'updatedBy';

/** input type for inserting data into table "components.component" */
export type Components_Component_Insert_Input = {
  board?: Boards_Board_Obj_Rel_Insert_Input | null | undefined;
  boardId?: string | null | undefined;
  boardName?: string | null | undefined;
  children?: unknown;
  componentType?: string | null | undefined;
  createdAt?: number | null | undefined;
  createdBy?: string | null | undefined;
  fill?: string | null | undefined;
  headEdge?: string | null | undefined;
  headPortIndex?: number | null | undefined;
  headShapeId?: string | null | undefined;
  height?: unknown;
  iconStroke?: string | null | undefined;
  id?: string | null | undefined;
  isDummy?: boolean | null | undefined;
  linewidth?: unknown;
  metadata?: unknown;
  objectClass?: string | null | undefined;
  opacity?: number | null | undefined;
  position?: number | null | undefined;
  radius?: unknown;
  stroke?: string | null | undefined;
  strokeType?: string | null | undefined;
  tailEdge?: string | null | undefined;
  tailPortIndex?: number | null | undefined;
  tailShapeId?: string | null | undefined;
  textColor?: string | null | undefined;
  updatedBy?: string | null | undefined;
  width?: unknown;
  x?: unknown;
  x1?: unknown;
  x2?: unknown;
  y?: unknown;
  y1?: unknown;
  y2?: unknown;
};

/** input type for updating data in table "components.component" */
export type Components_Component_Set_Input = {
  boardId?: string | null | undefined;
  boardName?: string | null | undefined;
  children?: unknown;
  componentType?: string | null | undefined;
  createdAt?: number | null | undefined;
  createdBy?: string | null | undefined;
  fill?: string | null | undefined;
  headEdge?: string | null | undefined;
  headPortIndex?: number | null | undefined;
  headShapeId?: string | null | undefined;
  height?: unknown;
  iconStroke?: string | null | undefined;
  id?: string | null | undefined;
  isDummy?: boolean | null | undefined;
  linewidth?: unknown;
  metadata?: unknown;
  objectClass?: string | null | undefined;
  opacity?: number | null | undefined;
  position?: number | null | undefined;
  radius?: unknown;
  stroke?: string | null | undefined;
  strokeType?: string | null | undefined;
  tailEdge?: string | null | undefined;
  tailPortIndex?: number | null | undefined;
  tailShapeId?: string | null | undefined;
  textColor?: string | null | undefined;
  updatedBy?: string | null | undefined;
  width?: unknown;
  x?: unknown;
  x1?: unknown;
  x2?: unknown;
  y?: unknown;
  y1?: unknown;
  y2?: unknown;
};

export type Jsonb_Cast_Exp = {
  String?: String_Comparison_Exp | null | undefined;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type Jsonb_Comparison_Exp = {
  _cast?: Jsonb_Cast_Exp | null | undefined;
  /** is the column contained in the given json value */
  _contained_in?: unknown;
  /** does the column contain the given json value at the top level */
  _contains?: unknown;
  _eq?: unknown;
  _gt?: unknown;
  _gte?: unknown;
  /** does the string exist as a top-level key in the column */
  _has_key?: string | null | undefined;
  /** do all of these strings exist as top-level keys in the column */
  _has_keys_all?: Array<string> | null | undefined;
  /** do any of these strings exist as top-level keys in the column */
  _has_keys_any?: Array<string> | null | undefined;
  _in?: Array<unknown> | null | undefined;
  _is_null?: boolean | null | undefined;
  _lt?: unknown;
  _lte?: unknown;
  _neq?: unknown;
  _nin?: Array<unknown> | null | undefined;
};

/** input type for inserting data into table "users.user" */
export type Users_User_Insert_Input = {
  createdAt?: string | null | undefined;
  email?: string | null | undefined;
  firstName?: string | null | undefined;
  id?: string | null | undefined;
  isActive?: boolean | null | undefined;
  lastName?: string | null | undefined;
  nickname?: string | null | undefined;
  planId?: string | null | undefined;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: string | null | undefined;
  _gt?: string | null | undefined;
  _gte?: string | null | undefined;
  _in?: Array<string> | null | undefined;
  _is_null?: boolean | null | undefined;
  _lt?: string | null | undefined;
  _lte?: string | null | undefined;
  _neq?: string | null | undefined;
  _nin?: Array<string> | null | undefined;
};

export type UpdateComponentInfoMutationVariables = Exact<{
  id?: string | null | undefined;
  updateObj?: Components_Component_Set_Input | null | undefined;
}>;


export type UpdateComponentInfoMutation = { update_components_component_by_pk: { id: string } | null };

export type InsertComponentMutationVariables = Exact<{
  object?: Components_Component_Insert_Input | null | undefined;
}>;


export type InsertComponentMutation = { component: { id: string, componentType: string } | null };

export type UpdateBoardComponentsMutationVariables = Exact<{
  id?: string | null | undefined;
  components?: unknown;
}>;


export type UpdateBoardComponentsMutation = { update_boards_board_by_pk: { id: string } | null };

export type DeleteComponentByIdMutationVariables = Exact<{
  id?: string | null | undefined;
}>;


export type DeleteComponentByIdMutation = { delete_components_component_by_pk: { boardId: string } | null };

export type InsertBulkComponentsMutationVariables = Exact<{
  objects?: Array<Components_Component_Insert_Input> | Components_Component_Insert_Input;
}>;


export type InsertBulkComponentsMutation = { insert_components_component: { affected_rows: number, returning: Array<{ boardId: string, componentType: string, id: string }> } | null };

export type InsertUserMutationVariables = Exact<{
  object?: Users_User_Insert_Input;
}>;


export type InsertUserMutation = { user: { id: string, firstName: string | null } | null };

export type CreateBoardMutationVariables = Exact<{
  object?: Boards_Board_Insert_Input;
}>;


export type CreateBoardMutation = { board: { id: string, createdBy: string | null } | null };

export type DeleteComponentsMutationVariables = Exact<{
  _in?: Array<string> | string;
}>;


export type DeleteComponentsMutation = { deleteComponents: { affected_rows: number } | null };

export type UpdateBoardVisibilityMutationVariables = Exact<{
  id?: string | null | undefined;
}>;


export type UpdateBoardVisibilityMutation = { update_boards_board_by_pk: { id: string, isPublic: boolean } | null };

export type UpdateUserRevisitCountMutationVariables = Exact<{
  userId: string;
  lastVisit: string;
}>;


export type UpdateUserRevisitCountMutation = { update_users_user_revisits_by_pk: { count: number, user_id: string, last_visit: string } | null };

export type MyQueryQueryVariables = Exact<{
  id?: string | null | undefined;
}>;


export type MyQueryQuery = { users: Array<{ firstName: string | null, id: string }> };

export type GetComponentTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetComponentTypesQuery = { componentTypes: Array<{ label: string, metadata: unknown, logo: string | null, width: number | null, height: number | null, fill: string | null, textColor: string | null }> };

export type GetComponentsForBoardQueryVariables = Exact<{
  boardId?: string | null | undefined;
}>;


export type GetComponentsForBoardQuery = { components: Array<{ id: string, componentType: string, objectClass: string, children: unknown, metadata: unknown, x: unknown, x1: unknown, x2: unknown, y: unknown, y1: unknown, y2: unknown, fill: string, width: unknown, height: unknown, iconStroke: string | null, stroke: string | null, linewidth: unknown, strokeType: string | null, textColor: string | null, opacity: number | null, position: number, tailShapeId: string | null, tailEdge: string | null, headShapeId: string | null, headEdge: string | null, tailPortIndex: number, headPortIndex: number }> };

export type GetComponentInfoQueryQueryVariables = Exact<{
  id?: string | null | undefined;
}>;


export type GetComponentInfoQueryQuery = { component: { metadata: unknown, width: unknown, height: unknown, fill: string, id: string, stroke: string | null, linewidth: unknown, strokeType: string | null, x: unknown, y: unknown, x1: unknown, y1: unknown, x2: unknown, y2: unknown, componentType: string, children: unknown, updatedBy: string | null, iconStroke: string | null, textColor: string | null, opacity: number | null } | null };

export type GetBoardComponentsQueryVariables = Exact<{
  boardId?: string;
}>;


export type GetBoardComponentsQuery = { components: Array<{ id: string, componentType: string }> };

export type GetBoardComponentCountQueryVariables = Exact<{
  boardId?: string;
}>;


export type GetBoardComponentCountQuery = { components: { aggregate: { count: number } | null } };

export type UserDetailsSubscriptionSubscriptionVariables = Exact<{
  id?: string | null | undefined;
}>;


export type UserDetailsSubscriptionSubscription = { users: Array<{ firstName: string | null, id: string }> };

export type GetBoardComponentsSubscriptionSubscriptionVariables = Exact<{
  boardId?: string;
}>;


export type GetBoardComponentsSubscriptionSubscription = { components: Array<{ id: string, componentType: string }> };

export type GetComponentInfoSubscriptionSubscriptionVariables = Exact<{
  id?: string | null | undefined;
}>;


export type GetComponentInfoSubscriptionSubscription = { component: { metadata: unknown, width: unknown, height: unknown, fill: string, id: string, stroke: string | null, linewidth: unknown, strokeType: string | null, x: unknown, y: unknown, x1: unknown, y1: unknown, x2: unknown, y2: unknown, componentType: string, children: unknown, updatedBy: string | null, iconStroke: string | null, textColor: string | null } | null };

export type GetComponentsForBoardSubscriptionSubscriptionVariables = Exact<{
  boardId?: string | null | undefined;
}>;


export type GetComponentsForBoardSubscriptionSubscription = { components: Array<{ id: string, componentType: string, objectClass: string, children: unknown, metadata: unknown, x: unknown, x1: unknown, x2: unknown, y: unknown, y1: unknown, y2: unknown, fill: string, width: unknown, height: unknown, iconStroke: string | null, stroke: string | null, linewidth: unknown, strokeType: string | null }> };


export const UpdateComponentInfoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateComponentInfo"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"updateObj"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"components_component_set_input"}},"defaultValue":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_components_component_by_pk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"updateObj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateComponentInfoMutation, UpdateComponentInfoMutationVariables>;
export const InsertComponentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"insertComponent"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"components_component_insert_input"}},"defaultValue":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"component"},"name":{"kind":"Name","value":"insert_components_component_one"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}}]}}]}}]} as unknown as DocumentNode<InsertComponentMutation, InsertComponentMutationVariables>;
export const UpdateBoardComponentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateBoardComponents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"components"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"jsonb"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_boards_board_by_pk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"components"},"value":{"kind":"Variable","name":{"kind":"Name","value":"components"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateBoardComponentsMutation, UpdateBoardComponentsMutationVariables>;
export const DeleteComponentByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteComponentById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_components_component_by_pk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"boardId"}}]}}]}}]} as unknown as DocumentNode<DeleteComponentByIdMutation, DeleteComponentByIdMutationVariables>;
export const InsertBulkComponentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"insertBulkComponents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"objects"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"components_component_insert_input"}}}}},"defaultValue":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insert_components_component"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"objects"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}},{"kind":"Field","name":{"kind":"Name","value":"returning"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"boardId"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}},{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<InsertBulkComponentsMutation, InsertBulkComponentsMutationVariables>;
export const InsertUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"insertUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"users_user_insert_input"}}},"defaultValue":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"user"},"name":{"kind":"Name","value":"insert_users_user_one"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}}]}}]}}]} as unknown as DocumentNode<InsertUserMutation, InsertUserMutationVariables>;
export const CreateBoardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createBoard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"boards_board_insert_input"}}},"defaultValue":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"board"},"name":{"kind":"Name","value":"insert_boards_board_one"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"}}]}}]}}]} as unknown as DocumentNode<CreateBoardMutation, CreateBoardMutationVariables>;
export const DeleteComponentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteComponents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"_in"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"deleteComponents"},"name":{"kind":"Name","value":"delete_components_component"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"_in"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<DeleteComponentsMutation, DeleteComponentsMutationVariables>;
export const UpdateBoardVisibilityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateBoardVisibility"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_boards_board_by_pk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isPublic"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}}]}}]}}]} as unknown as DocumentNode<UpdateBoardVisibilityMutation, UpdateBoardVisibilityMutationVariables>;
export const UpdateUserRevisitCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateUserRevisitCount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lastVisit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"timestamptz"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_users_user_revisits_by_pk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_inc"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"count"},"value":{"kind":"StringValue","value":"1","block":false}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"last_visit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lastVisit"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"}}]}}]}}]} as unknown as DocumentNode<UpdateUserRevisitCountMutation, UpdateUserRevisitCountMutationVariables>;
export const MyQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"users"},"name":{"kind":"Name","value":"users_user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<MyQueryQuery, MyQueryQueryVariables>;
export const GetComponentTypesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getComponentTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"componentTypes"},"name":{"kind":"Name","value":"components_componentType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"metadata"}},{"kind":"Field","name":{"kind":"Name","value":"logo"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"fill"}},{"kind":"Field","name":{"kind":"Name","value":"textColor"}}]}}]}}]} as unknown as DocumentNode<GetComponentTypesQuery, GetComponentTypesQueryVariables>;
export const GetComponentsForBoardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getComponentsForBoard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"components"},"name":{"kind":"Name","value":"components_component"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"boardId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}},{"kind":"Field","name":{"kind":"Name","value":"objectClass"}},{"kind":"Field","name":{"kind":"Name","value":"children"}},{"kind":"Field","name":{"kind":"Name","value":"metadata"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"x1"}},{"kind":"Field","name":{"kind":"Name","value":"x2"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"y1"}},{"kind":"Field","name":{"kind":"Name","value":"y2"}},{"kind":"Field","name":{"kind":"Name","value":"fill"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"iconStroke"}},{"kind":"Field","name":{"kind":"Name","value":"stroke"}},{"kind":"Field","name":{"kind":"Name","value":"linewidth"}},{"kind":"Field","name":{"kind":"Name","value":"strokeType"}},{"kind":"Field","name":{"kind":"Name","value":"textColor"}},{"kind":"Field","name":{"kind":"Name","value":"opacity"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tailShapeId"}},{"kind":"Field","name":{"kind":"Name","value":"tailEdge"}},{"kind":"Field","name":{"kind":"Name","value":"headShapeId"}},{"kind":"Field","name":{"kind":"Name","value":"headEdge"}},{"kind":"Field","name":{"kind":"Name","value":"tailPortIndex"}},{"kind":"Field","name":{"kind":"Name","value":"headPortIndex"}}]}}]}}]} as unknown as DocumentNode<GetComponentsForBoardQuery, GetComponentsForBoardQueryVariables>;
export const GetComponentInfoQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getComponentInfoQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"component"},"name":{"kind":"Name","value":"components_component_by_pk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metadata"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"fill"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"stroke"}},{"kind":"Field","name":{"kind":"Name","value":"linewidth"}},{"kind":"Field","name":{"kind":"Name","value":"strokeType"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"x1"}},{"kind":"Field","name":{"kind":"Name","value":"y1"}},{"kind":"Field","name":{"kind":"Name","value":"x2"}},{"kind":"Field","name":{"kind":"Name","value":"y2"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}},{"kind":"Field","name":{"kind":"Name","value":"children"}},{"kind":"Field","name":{"kind":"Name","value":"updatedBy"}},{"kind":"Field","name":{"kind":"Name","value":"iconStroke"}},{"kind":"Field","name":{"kind":"Name","value":"textColor"}},{"kind":"Field","name":{"kind":"Name","value":"opacity"}}]}}]}}]} as unknown as DocumentNode<GetComponentInfoQueryQuery, GetComponentInfoQueryQueryVariables>;
export const GetBoardComponentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getBoardComponents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"components"},"name":{"kind":"Name","value":"components_component"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"boardId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}}]}}]}}]} as unknown as DocumentNode<GetBoardComponentsQuery, GetBoardComponentsQueryVariables>;
export const GetBoardComponentCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getBoardComponentCount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"components"},"name":{"kind":"Name","value":"components_component_aggregate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"boardId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]} as unknown as DocumentNode<GetBoardComponentCountQuery, GetBoardComponentCountQueryVariables>;
export const UserDetailsSubscriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"userDetailsSubscription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"users"},"name":{"kind":"Name","value":"users_user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UserDetailsSubscriptionSubscription, UserDetailsSubscriptionSubscriptionVariables>;
export const GetBoardComponentsSubscriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"getBoardComponentsSubscription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"components"},"name":{"kind":"Name","value":"components_component"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"boardId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}}]}}]}}]} as unknown as DocumentNode<GetBoardComponentsSubscriptionSubscription, GetBoardComponentsSubscriptionSubscriptionVariables>;
export const GetComponentInfoSubscriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"getComponentInfoSubscription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"component"},"name":{"kind":"Name","value":"components_component_by_pk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metadata"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"fill"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"stroke"}},{"kind":"Field","name":{"kind":"Name","value":"linewidth"}},{"kind":"Field","name":{"kind":"Name","value":"strokeType"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"x1"}},{"kind":"Field","name":{"kind":"Name","value":"y1"}},{"kind":"Field","name":{"kind":"Name","value":"x2"}},{"kind":"Field","name":{"kind":"Name","value":"y2"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}},{"kind":"Field","name":{"kind":"Name","value":"children"}},{"kind":"Field","name":{"kind":"Name","value":"updatedBy"}},{"kind":"Field","name":{"kind":"Name","value":"iconStroke"}},{"kind":"Field","name":{"kind":"Name","value":"textColor"}}]}}]}}]} as unknown as DocumentNode<GetComponentInfoSubscriptionSubscription, GetComponentInfoSubscriptionSubscriptionVariables>;
export const GetComponentsForBoardSubscriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"getComponentsForBoardSubscription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}},"defaultValue":{"kind":"StringValue","value":"","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"components"},"name":{"kind":"Name","value":"components_component"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"boardId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"boardId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"componentType"}},{"kind":"Field","name":{"kind":"Name","value":"objectClass"}},{"kind":"Field","name":{"kind":"Name","value":"children"}},{"kind":"Field","name":{"kind":"Name","value":"metadata"}},{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"x1"}},{"kind":"Field","name":{"kind":"Name","value":"x2"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"y1"}},{"kind":"Field","name":{"kind":"Name","value":"y2"}},{"kind":"Field","name":{"kind":"Name","value":"fill"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"iconStroke"}},{"kind":"Field","name":{"kind":"Name","value":"stroke"}},{"kind":"Field","name":{"kind":"Name","value":"linewidth"}},{"kind":"Field","name":{"kind":"Name","value":"strokeType"}}]}}]}}]} as unknown as DocumentNode<GetComponentsForBoardSubscriptionSubscription, GetComponentsForBoardSubscriptionSubscriptionVariables>;