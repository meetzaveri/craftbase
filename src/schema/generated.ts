import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  bigint: { input: number; output: number; }
  float8: { input: any; output: any; }
  jsonb: { input: unknown; output: unknown; }
  timestamptz: { input: string; output: string; }
  uuid: { input: string; output: string; }
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Boolean']['input']>;
  _gt?: InputMaybe<Scalars['Boolean']['input']>;
  _gte?: InputMaybe<Scalars['Boolean']['input']>;
  _in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Boolean']['input']>;
  _lte?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<Scalars['Boolean']['input']>;
  _nin?: InputMaybe<Array<Scalars['Boolean']['input']>>;
};

/** Boolean expression to compare columns of type "Float". All fields are combined with logical 'AND'. */
export type Float_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Float']['input']>;
  _gt?: InputMaybe<Scalars['Float']['input']>;
  _gte?: InputMaybe<Scalars['Float']['input']>;
  _in?: InputMaybe<Array<Scalars['Float']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Float']['input']>;
  _lte?: InputMaybe<Scalars['Float']['input']>;
  _neq?: InputMaybe<Scalars['Float']['input']>;
  _nin?: InputMaybe<Array<Scalars['Float']['input']>>;
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Int']['input']>;
  _gt?: InputMaybe<Scalars['Int']['input']>;
  _gte?: InputMaybe<Scalars['Int']['input']>;
  _in?: InputMaybe<Array<Scalars['Int']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Int']['input']>;
  _lte?: InputMaybe<Scalars['Int']['input']>;
  _neq?: InputMaybe<Scalars['Int']['input']>;
  _nin?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['String']['input']>;
  _gt?: InputMaybe<Scalars['String']['input']>;
  _gte?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']['input']>;
  _in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']['input']>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']['input']>;
  _lt?: InputMaybe<Scalars['String']['input']>;
  _lte?: InputMaybe<Scalars['String']['input']>;
  _neq?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']['input']>;
  _nin?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']['input']>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bigint']['input']>;
  _gt?: InputMaybe<Scalars['bigint']['input']>;
  _gte?: InputMaybe<Scalars['bigint']['input']>;
  _in?: InputMaybe<Array<Scalars['bigint']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['bigint']['input']>;
  _lte?: InputMaybe<Scalars['bigint']['input']>;
  _neq?: InputMaybe<Scalars['bigint']['input']>;
  _nin?: InputMaybe<Array<Scalars['bigint']['input']>>;
};

/** columns and relationships of "boards.board" */
export type Boards_Board = {
  __typename?: 'boards_board';
  allowDeleteBy?: Maybe<Scalars['jsonb']['output']>;
  allowUpdateBy?: Maybe<Scalars['jsonb']['output']>;
  allowViewBy?: Maybe<Scalars['jsonb']['output']>;
  comments?: Maybe<Scalars['jsonb']['output']>;
  components?: Maybe<Scalars['jsonb']['output']>;
  createdAt: Scalars['bigint']['output'];
  createdBy?: Maybe<Scalars['String']['output']>;
  createdByEmail?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  isPublic: Scalars['Boolean']['output'];
  name?: Maybe<Scalars['String']['output']>;
  subscribersData: Scalars['jsonb']['output'];
  updatedAt: Scalars['bigint']['output'];
  updatedBy?: Maybe<Scalars['String']['output']>;
};


/** columns and relationships of "boards.board" */
export type Boards_BoardAllowDeleteByArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** columns and relationships of "boards.board" */
export type Boards_BoardAllowUpdateByArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** columns and relationships of "boards.board" */
export type Boards_BoardAllowViewByArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** columns and relationships of "boards.board" */
export type Boards_BoardCommentsArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** columns and relationships of "boards.board" */
export type Boards_BoardComponentsArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** columns and relationships of "boards.board" */
export type Boards_BoardSubscribersDataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "boards.board" */
export type Boards_Board_Aggregate = {
  __typename?: 'boards_board_aggregate';
  aggregate?: Maybe<Boards_Board_Aggregate_Fields>;
  nodes: Array<Boards_Board>;
};

/** aggregate fields of "boards.board" */
export type Boards_Board_Aggregate_Fields = {
  __typename?: 'boards_board_aggregate_fields';
  avg?: Maybe<Boards_Board_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Boards_Board_Max_Fields>;
  min?: Maybe<Boards_Board_Min_Fields>;
  stddev?: Maybe<Boards_Board_Stddev_Fields>;
  stddev_pop?: Maybe<Boards_Board_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Boards_Board_Stddev_Samp_Fields>;
  sum?: Maybe<Boards_Board_Sum_Fields>;
  var_pop?: Maybe<Boards_Board_Var_Pop_Fields>;
  var_samp?: Maybe<Boards_Board_Var_Samp_Fields>;
  variance?: Maybe<Boards_Board_Variance_Fields>;
};


/** aggregate fields of "boards.board" */
export type Boards_Board_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Boards_Board_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Boards_Board_Append_Input = {
  allowDeleteBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowUpdateBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowViewBy?: InputMaybe<Scalars['jsonb']['input']>;
  comments?: InputMaybe<Scalars['jsonb']['input']>;
  components?: InputMaybe<Scalars['jsonb']['input']>;
  subscribersData?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate avg on columns */
export type Boards_Board_Avg_Fields = {
  __typename?: 'boards_board_avg_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  updatedAt?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "boards.board". All fields are combined with a logical 'AND'. */
export type Boards_Board_Bool_Exp = {
  _and?: InputMaybe<Array<Boards_Board_Bool_Exp>>;
  _not?: InputMaybe<Boards_Board_Bool_Exp>;
  _or?: InputMaybe<Array<Boards_Board_Bool_Exp>>;
  allowDeleteBy?: InputMaybe<Jsonb_Comparison_Exp>;
  allowUpdateBy?: InputMaybe<Jsonb_Comparison_Exp>;
  allowViewBy?: InputMaybe<Jsonb_Comparison_Exp>;
  comments?: InputMaybe<Jsonb_Comparison_Exp>;
  components?: InputMaybe<Jsonb_Comparison_Exp>;
  createdAt?: InputMaybe<Bigint_Comparison_Exp>;
  createdBy?: InputMaybe<String_Comparison_Exp>;
  createdByEmail?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isPublic?: InputMaybe<Boolean_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  subscribersData?: InputMaybe<Jsonb_Comparison_Exp>;
  updatedAt?: InputMaybe<Bigint_Comparison_Exp>;
  updatedBy?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "boards.board" */
export type Boards_Board_Constraint =
  /** unique or primary key constraint on columns "id" */
  | 'board_pkey';

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Boards_Board_Delete_At_Path_Input = {
  allowDeleteBy?: InputMaybe<Array<Scalars['String']['input']>>;
  allowUpdateBy?: InputMaybe<Array<Scalars['String']['input']>>;
  allowViewBy?: InputMaybe<Array<Scalars['String']['input']>>;
  comments?: InputMaybe<Array<Scalars['String']['input']>>;
  components?: InputMaybe<Array<Scalars['String']['input']>>;
  subscribersData?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Boards_Board_Delete_Elem_Input = {
  allowDeleteBy?: InputMaybe<Scalars['Int']['input']>;
  allowUpdateBy?: InputMaybe<Scalars['Int']['input']>;
  allowViewBy?: InputMaybe<Scalars['Int']['input']>;
  comments?: InputMaybe<Scalars['Int']['input']>;
  components?: InputMaybe<Scalars['Int']['input']>;
  subscribersData?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Boards_Board_Delete_Key_Input = {
  allowDeleteBy?: InputMaybe<Scalars['String']['input']>;
  allowUpdateBy?: InputMaybe<Scalars['String']['input']>;
  allowViewBy?: InputMaybe<Scalars['String']['input']>;
  comments?: InputMaybe<Scalars['String']['input']>;
  components?: InputMaybe<Scalars['String']['input']>;
  subscribersData?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "boards.board" */
export type Boards_Board_Inc_Input = {
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  updatedAt?: InputMaybe<Scalars['bigint']['input']>;
};

/** input type for inserting data into table "boards.board" */
export type Boards_Board_Insert_Input = {
  allowDeleteBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowUpdateBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowViewBy?: InputMaybe<Scalars['jsonb']['input']>;
  comments?: InputMaybe<Scalars['jsonb']['input']>;
  components?: InputMaybe<Scalars['jsonb']['input']>;
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  createdByEmail?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  subscribersData?: InputMaybe<Scalars['jsonb']['input']>;
  updatedAt?: InputMaybe<Scalars['bigint']['input']>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Boards_Board_Max_Fields = {
  __typename?: 'boards_board_max_fields';
  createdAt?: Maybe<Scalars['bigint']['output']>;
  createdBy?: Maybe<Scalars['String']['output']>;
  createdByEmail?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['bigint']['output']>;
  updatedBy?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Boards_Board_Min_Fields = {
  __typename?: 'boards_board_min_fields';
  createdAt?: Maybe<Scalars['bigint']['output']>;
  createdBy?: Maybe<Scalars['String']['output']>;
  createdByEmail?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['bigint']['output']>;
  updatedBy?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "boards.board" */
export type Boards_Board_Mutation_Response = {
  __typename?: 'boards_board_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Boards_Board>;
};

/** input type for inserting object relation for remote table "boards.board" */
export type Boards_Board_Obj_Rel_Insert_Input = {
  data: Boards_Board_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Boards_Board_On_Conflict>;
};

/** on_conflict condition type for table "boards.board" */
export type Boards_Board_On_Conflict = {
  constraint: Boards_Board_Constraint;
  update_columns?: Array<Boards_Board_Update_Column>;
  where?: InputMaybe<Boards_Board_Bool_Exp>;
};

/** Ordering options when selecting data from "boards.board". */
export type Boards_Board_Order_By = {
  allowDeleteBy?: InputMaybe<Order_By>;
  allowUpdateBy?: InputMaybe<Order_By>;
  allowViewBy?: InputMaybe<Order_By>;
  comments?: InputMaybe<Order_By>;
  components?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  createdBy?: InputMaybe<Order_By>;
  createdByEmail?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isPublic?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  subscribersData?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  updatedBy?: InputMaybe<Order_By>;
};

/** primary key columns input for table: boards.board */
export type Boards_Board_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Boards_Board_Prepend_Input = {
  allowDeleteBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowUpdateBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowViewBy?: InputMaybe<Scalars['jsonb']['input']>;
  comments?: InputMaybe<Scalars['jsonb']['input']>;
  components?: InputMaybe<Scalars['jsonb']['input']>;
  subscribersData?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "boards.board" */
export type Boards_Board_Select_Column =
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

/** input type for updating data in table "boards.board" */
export type Boards_Board_Set_Input = {
  allowDeleteBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowUpdateBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowViewBy?: InputMaybe<Scalars['jsonb']['input']>;
  comments?: InputMaybe<Scalars['jsonb']['input']>;
  components?: InputMaybe<Scalars['jsonb']['input']>;
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  createdByEmail?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  subscribersData?: InputMaybe<Scalars['jsonb']['input']>;
  updatedAt?: InputMaybe<Scalars['bigint']['input']>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Boards_Board_Stddev_Fields = {
  __typename?: 'boards_board_stddev_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  updatedAt?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Boards_Board_Stddev_Pop_Fields = {
  __typename?: 'boards_board_stddev_pop_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  updatedAt?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Boards_Board_Stddev_Samp_Fields = {
  __typename?: 'boards_board_stddev_samp_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  updatedAt?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "boards_board" */
export type Boards_Board_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Boards_Board_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Boards_Board_Stream_Cursor_Value_Input = {
  allowDeleteBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowUpdateBy?: InputMaybe<Scalars['jsonb']['input']>;
  allowViewBy?: InputMaybe<Scalars['jsonb']['input']>;
  comments?: InputMaybe<Scalars['jsonb']['input']>;
  components?: InputMaybe<Scalars['jsonb']['input']>;
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  createdByEmail?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  subscribersData?: InputMaybe<Scalars['jsonb']['input']>;
  updatedAt?: InputMaybe<Scalars['bigint']['input']>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate sum on columns */
export type Boards_Board_Sum_Fields = {
  __typename?: 'boards_board_sum_fields';
  createdAt?: Maybe<Scalars['bigint']['output']>;
  updatedAt?: Maybe<Scalars['bigint']['output']>;
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

export type Boards_Board_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Boards_Board_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Boards_Board_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Boards_Board_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Boards_Board_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Boards_Board_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Boards_Board_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Boards_Board_Set_Input>;
  /** filter the rows which have to be updated */
  where: Boards_Board_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Boards_Board_Var_Pop_Fields = {
  __typename?: 'boards_board_var_pop_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  updatedAt?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Boards_Board_Var_Samp_Fields = {
  __typename?: 'boards_board_var_samp_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  updatedAt?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Boards_Board_Variance_Fields = {
  __typename?: 'boards_board_variance_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  updatedAt?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "components.component" */
export type Components_Component = {
  __typename?: 'components_component';
  /** An object relationship */
  board: Boards_Board;
  boardId: Scalars['uuid']['output'];
  boardName?: Maybe<Scalars['String']['output']>;
  children?: Maybe<Scalars['jsonb']['output']>;
  componentType: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['bigint']['output']>;
  createdBy: Scalars['String']['output'];
  fill: Scalars['String']['output'];
  headEdge?: Maybe<Scalars['String']['output']>;
  headPortIndex: Scalars['Int']['output'];
  headShapeId?: Maybe<Scalars['uuid']['output']>;
  height: Scalars['float8']['output'];
  iconStroke?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  isDummy?: Maybe<Scalars['Boolean']['output']>;
  linewidth?: Maybe<Scalars['float8']['output']>;
  metadata?: Maybe<Scalars['jsonb']['output']>;
  objectClass: Scalars['String']['output'];
  opacity?: Maybe<Scalars['Float']['output']>;
  position: Scalars['Int']['output'];
  radius?: Maybe<Scalars['float8']['output']>;
  stroke?: Maybe<Scalars['String']['output']>;
  strokeType?: Maybe<Scalars['String']['output']>;
  tailEdge?: Maybe<Scalars['String']['output']>;
  tailPortIndex: Scalars['Int']['output'];
  tailShapeId?: Maybe<Scalars['uuid']['output']>;
  textColor?: Maybe<Scalars['String']['output']>;
  updatedBy?: Maybe<Scalars['String']['output']>;
  width: Scalars['float8']['output'];
  x: Scalars['float8']['output'];
  x1: Scalars['float8']['output'];
  x2: Scalars['float8']['output'];
  y: Scalars['float8']['output'];
  y1: Scalars['float8']['output'];
  y2: Scalars['float8']['output'];
};


/** columns and relationships of "components.component" */
export type Components_ComponentChildrenArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** columns and relationships of "components.component" */
export type Components_ComponentMetadataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "components.componentType" */
export type Components_ComponentType = {
  __typename?: 'components_componentType';
  category: Scalars['String']['output'];
  fill?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  id: Scalars['uuid']['output'];
  label: Scalars['String']['output'];
  logo?: Maybe<Scalars['String']['output']>;
  metadata: Scalars['jsonb']['output'];
  textColor?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};


/** columns and relationships of "components.componentType" */
export type Components_ComponentTypeMetadataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "components.componentType" */
export type Components_ComponentType_Aggregate = {
  __typename?: 'components_componentType_aggregate';
  aggregate?: Maybe<Components_ComponentType_Aggregate_Fields>;
  nodes: Array<Components_ComponentType>;
};

/** aggregate fields of "components.componentType" */
export type Components_ComponentType_Aggregate_Fields = {
  __typename?: 'components_componentType_aggregate_fields';
  avg?: Maybe<Components_ComponentType_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Components_ComponentType_Max_Fields>;
  min?: Maybe<Components_ComponentType_Min_Fields>;
  stddev?: Maybe<Components_ComponentType_Stddev_Fields>;
  stddev_pop?: Maybe<Components_ComponentType_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Components_ComponentType_Stddev_Samp_Fields>;
  sum?: Maybe<Components_ComponentType_Sum_Fields>;
  var_pop?: Maybe<Components_ComponentType_Var_Pop_Fields>;
  var_samp?: Maybe<Components_ComponentType_Var_Samp_Fields>;
  variance?: Maybe<Components_ComponentType_Variance_Fields>;
};


/** aggregate fields of "components.componentType" */
export type Components_ComponentType_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Components_ComponentType_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Components_ComponentType_Append_Input = {
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate avg on columns */
export type Components_ComponentType_Avg_Fields = {
  __typename?: 'components_componentType_avg_fields';
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "components.componentType". All fields are combined with a logical 'AND'. */
export type Components_ComponentType_Bool_Exp = {
  _and?: InputMaybe<Array<Components_ComponentType_Bool_Exp>>;
  _not?: InputMaybe<Components_ComponentType_Bool_Exp>;
  _or?: InputMaybe<Array<Components_ComponentType_Bool_Exp>>;
  category?: InputMaybe<String_Comparison_Exp>;
  fill?: InputMaybe<String_Comparison_Exp>;
  height?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  label?: InputMaybe<String_Comparison_Exp>;
  logo?: InputMaybe<String_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  textColor?: InputMaybe<String_Comparison_Exp>;
  width?: InputMaybe<Int_Comparison_Exp>;
};

/** unique or primary key constraints on table "components.componentType" */
export type Components_ComponentType_Constraint =
  /** unique or primary key constraint on columns "id" */
  | 'componentType_pkey';

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Components_ComponentType_Delete_At_Path_Input = {
  metadata?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Components_ComponentType_Delete_Elem_Input = {
  metadata?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Components_ComponentType_Delete_Key_Input = {
  metadata?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "components.componentType" */
export type Components_ComponentType_Inc_Input = {
  height?: InputMaybe<Scalars['Int']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "components.componentType" */
export type Components_ComponentType_Insert_Input = {
  category?: InputMaybe<Scalars['String']['input']>;
  fill?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
  textColor?: InputMaybe<Scalars['String']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate max on columns */
export type Components_ComponentType_Max_Fields = {
  __typename?: 'components_componentType_max_fields';
  category?: Maybe<Scalars['String']['output']>;
  fill?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  logo?: Maybe<Scalars['String']['output']>;
  textColor?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};

/** aggregate min on columns */
export type Components_ComponentType_Min_Fields = {
  __typename?: 'components_componentType_min_fields';
  category?: Maybe<Scalars['String']['output']>;
  fill?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  logo?: Maybe<Scalars['String']['output']>;
  textColor?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};

/** response of any mutation on the table "components.componentType" */
export type Components_ComponentType_Mutation_Response = {
  __typename?: 'components_componentType_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Components_ComponentType>;
};

/** on_conflict condition type for table "components.componentType" */
export type Components_ComponentType_On_Conflict = {
  constraint: Components_ComponentType_Constraint;
  update_columns?: Array<Components_ComponentType_Update_Column>;
  where?: InputMaybe<Components_ComponentType_Bool_Exp>;
};

/** Ordering options when selecting data from "components.componentType". */
export type Components_ComponentType_Order_By = {
  category?: InputMaybe<Order_By>;
  fill?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  logo?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  textColor?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** primary key columns input for table: components.componentType */
export type Components_ComponentType_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Components_ComponentType_Prepend_Input = {
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "components.componentType" */
export type Components_ComponentType_Select_Column =
  /** column name */
  | 'category'
  /** column name */
  | 'fill'
  /** column name */
  | 'height'
  /** column name */
  | 'id'
  /** column name */
  | 'label'
  /** column name */
  | 'logo'
  /** column name */
  | 'metadata'
  /** column name */
  | 'textColor'
  /** column name */
  | 'width';

/** input type for updating data in table "components.componentType" */
export type Components_ComponentType_Set_Input = {
  category?: InputMaybe<Scalars['String']['input']>;
  fill?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
  textColor?: InputMaybe<Scalars['String']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type Components_ComponentType_Stddev_Fields = {
  __typename?: 'components_componentType_stddev_fields';
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Components_ComponentType_Stddev_Pop_Fields = {
  __typename?: 'components_componentType_stddev_pop_fields';
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Components_ComponentType_Stddev_Samp_Fields = {
  __typename?: 'components_componentType_stddev_samp_fields';
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "components_componentType" */
export type Components_ComponentType_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Components_ComponentType_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Components_ComponentType_Stream_Cursor_Value_Input = {
  category?: InputMaybe<Scalars['String']['input']>;
  fill?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
  textColor?: InputMaybe<Scalars['String']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate sum on columns */
export type Components_ComponentType_Sum_Fields = {
  __typename?: 'components_componentType_sum_fields';
  height?: Maybe<Scalars['Int']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "components.componentType" */
export type Components_ComponentType_Update_Column =
  /** column name */
  | 'category'
  /** column name */
  | 'fill'
  /** column name */
  | 'height'
  /** column name */
  | 'id'
  /** column name */
  | 'label'
  /** column name */
  | 'logo'
  /** column name */
  | 'metadata'
  /** column name */
  | 'textColor'
  /** column name */
  | 'width';

export type Components_ComponentType_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Components_ComponentType_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Components_ComponentType_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Components_ComponentType_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Components_ComponentType_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Components_ComponentType_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Components_ComponentType_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Components_ComponentType_Set_Input>;
  /** filter the rows which have to be updated */
  where: Components_ComponentType_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Components_ComponentType_Var_Pop_Fields = {
  __typename?: 'components_componentType_var_pop_fields';
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Components_ComponentType_Var_Samp_Fields = {
  __typename?: 'components_componentType_var_samp_fields';
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Components_ComponentType_Variance_Fields = {
  __typename?: 'components_componentType_variance_fields';
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** aggregated selection of "components.component" */
export type Components_Component_Aggregate = {
  __typename?: 'components_component_aggregate';
  aggregate?: Maybe<Components_Component_Aggregate_Fields>;
  nodes: Array<Components_Component>;
};

/** aggregate fields of "components.component" */
export type Components_Component_Aggregate_Fields = {
  __typename?: 'components_component_aggregate_fields';
  avg?: Maybe<Components_Component_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Components_Component_Max_Fields>;
  min?: Maybe<Components_Component_Min_Fields>;
  stddev?: Maybe<Components_Component_Stddev_Fields>;
  stddev_pop?: Maybe<Components_Component_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Components_Component_Stddev_Samp_Fields>;
  sum?: Maybe<Components_Component_Sum_Fields>;
  var_pop?: Maybe<Components_Component_Var_Pop_Fields>;
  var_samp?: Maybe<Components_Component_Var_Samp_Fields>;
  variance?: Maybe<Components_Component_Variance_Fields>;
};


/** aggregate fields of "components.component" */
export type Components_Component_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Components_Component_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Components_Component_Append_Input = {
  children?: InputMaybe<Scalars['jsonb']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate avg on columns */
export type Components_Component_Avg_Fields = {
  __typename?: 'components_component_avg_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  headPortIndex?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  linewidth?: Maybe<Scalars['Float']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  tailPortIndex?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  x1?: Maybe<Scalars['Float']['output']>;
  x2?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  y1?: Maybe<Scalars['Float']['output']>;
  y2?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "components.component". All fields are combined with a logical 'AND'. */
export type Components_Component_Bool_Exp = {
  _and?: InputMaybe<Array<Components_Component_Bool_Exp>>;
  _not?: InputMaybe<Components_Component_Bool_Exp>;
  _or?: InputMaybe<Array<Components_Component_Bool_Exp>>;
  board?: InputMaybe<Boards_Board_Bool_Exp>;
  boardId?: InputMaybe<Uuid_Comparison_Exp>;
  boardName?: InputMaybe<String_Comparison_Exp>;
  children?: InputMaybe<Jsonb_Comparison_Exp>;
  componentType?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Bigint_Comparison_Exp>;
  createdBy?: InputMaybe<String_Comparison_Exp>;
  fill?: InputMaybe<String_Comparison_Exp>;
  headEdge?: InputMaybe<String_Comparison_Exp>;
  headPortIndex?: InputMaybe<Int_Comparison_Exp>;
  headShapeId?: InputMaybe<Uuid_Comparison_Exp>;
  height?: InputMaybe<Float8_Comparison_Exp>;
  iconStroke?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isDummy?: InputMaybe<Boolean_Comparison_Exp>;
  linewidth?: InputMaybe<Float8_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  objectClass?: InputMaybe<String_Comparison_Exp>;
  opacity?: InputMaybe<Float_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  radius?: InputMaybe<Float8_Comparison_Exp>;
  stroke?: InputMaybe<String_Comparison_Exp>;
  strokeType?: InputMaybe<String_Comparison_Exp>;
  tailEdge?: InputMaybe<String_Comparison_Exp>;
  tailPortIndex?: InputMaybe<Int_Comparison_Exp>;
  tailShapeId?: InputMaybe<Uuid_Comparison_Exp>;
  textColor?: InputMaybe<String_Comparison_Exp>;
  updatedBy?: InputMaybe<String_Comparison_Exp>;
  width?: InputMaybe<Float8_Comparison_Exp>;
  x?: InputMaybe<Float8_Comparison_Exp>;
  x1?: InputMaybe<Float8_Comparison_Exp>;
  x2?: InputMaybe<Float8_Comparison_Exp>;
  y?: InputMaybe<Float8_Comparison_Exp>;
  y1?: InputMaybe<Float8_Comparison_Exp>;
  y2?: InputMaybe<Float8_Comparison_Exp>;
};

/** unique or primary key constraints on table "components.component" */
export type Components_Component_Constraint =
  /** unique or primary key constraint on columns "id" */
  | 'component_id_key'
  /** unique or primary key constraint on columns "id" */
  | 'component_pkey';

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Components_Component_Delete_At_Path_Input = {
  children?: InputMaybe<Array<Scalars['String']['input']>>;
  metadata?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Components_Component_Delete_Elem_Input = {
  children?: InputMaybe<Scalars['Int']['input']>;
  metadata?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Components_Component_Delete_Key_Input = {
  children?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "components.component" */
export type Components_Component_Inc_Input = {
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  headPortIndex?: InputMaybe<Scalars['Int']['input']>;
  height?: InputMaybe<Scalars['float8']['input']>;
  linewidth?: InputMaybe<Scalars['float8']['input']>;
  opacity?: InputMaybe<Scalars['Float']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  radius?: InputMaybe<Scalars['float8']['input']>;
  tailPortIndex?: InputMaybe<Scalars['Int']['input']>;
  width?: InputMaybe<Scalars['float8']['input']>;
  x?: InputMaybe<Scalars['float8']['input']>;
  x1?: InputMaybe<Scalars['float8']['input']>;
  x2?: InputMaybe<Scalars['float8']['input']>;
  y?: InputMaybe<Scalars['float8']['input']>;
  y1?: InputMaybe<Scalars['float8']['input']>;
  y2?: InputMaybe<Scalars['float8']['input']>;
};

/** input type for inserting data into table "components.component" */
export type Components_Component_Insert_Input = {
  board?: InputMaybe<Boards_Board_Obj_Rel_Insert_Input>;
  boardId?: InputMaybe<Scalars['uuid']['input']>;
  boardName?: InputMaybe<Scalars['String']['input']>;
  children?: InputMaybe<Scalars['jsonb']['input']>;
  componentType?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  fill?: InputMaybe<Scalars['String']['input']>;
  headEdge?: InputMaybe<Scalars['String']['input']>;
  headPortIndex?: InputMaybe<Scalars['Int']['input']>;
  headShapeId?: InputMaybe<Scalars['uuid']['input']>;
  height?: InputMaybe<Scalars['float8']['input']>;
  iconStroke?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isDummy?: InputMaybe<Scalars['Boolean']['input']>;
  linewidth?: InputMaybe<Scalars['float8']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
  objectClass?: InputMaybe<Scalars['String']['input']>;
  opacity?: InputMaybe<Scalars['Float']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  radius?: InputMaybe<Scalars['float8']['input']>;
  stroke?: InputMaybe<Scalars['String']['input']>;
  strokeType?: InputMaybe<Scalars['String']['input']>;
  tailEdge?: InputMaybe<Scalars['String']['input']>;
  tailPortIndex?: InputMaybe<Scalars['Int']['input']>;
  tailShapeId?: InputMaybe<Scalars['uuid']['input']>;
  textColor?: InputMaybe<Scalars['String']['input']>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
  width?: InputMaybe<Scalars['float8']['input']>;
  x?: InputMaybe<Scalars['float8']['input']>;
  x1?: InputMaybe<Scalars['float8']['input']>;
  x2?: InputMaybe<Scalars['float8']['input']>;
  y?: InputMaybe<Scalars['float8']['input']>;
  y1?: InputMaybe<Scalars['float8']['input']>;
  y2?: InputMaybe<Scalars['float8']['input']>;
};

/** aggregate max on columns */
export type Components_Component_Max_Fields = {
  __typename?: 'components_component_max_fields';
  boardId?: Maybe<Scalars['uuid']['output']>;
  boardName?: Maybe<Scalars['String']['output']>;
  componentType?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['bigint']['output']>;
  createdBy?: Maybe<Scalars['String']['output']>;
  fill?: Maybe<Scalars['String']['output']>;
  headEdge?: Maybe<Scalars['String']['output']>;
  headPortIndex?: Maybe<Scalars['Int']['output']>;
  headShapeId?: Maybe<Scalars['uuid']['output']>;
  height?: Maybe<Scalars['float8']['output']>;
  iconStroke?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  linewidth?: Maybe<Scalars['float8']['output']>;
  objectClass?: Maybe<Scalars['String']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  radius?: Maybe<Scalars['float8']['output']>;
  stroke?: Maybe<Scalars['String']['output']>;
  strokeType?: Maybe<Scalars['String']['output']>;
  tailEdge?: Maybe<Scalars['String']['output']>;
  tailPortIndex?: Maybe<Scalars['Int']['output']>;
  tailShapeId?: Maybe<Scalars['uuid']['output']>;
  textColor?: Maybe<Scalars['String']['output']>;
  updatedBy?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['float8']['output']>;
  x?: Maybe<Scalars['float8']['output']>;
  x1?: Maybe<Scalars['float8']['output']>;
  x2?: Maybe<Scalars['float8']['output']>;
  y?: Maybe<Scalars['float8']['output']>;
  y1?: Maybe<Scalars['float8']['output']>;
  y2?: Maybe<Scalars['float8']['output']>;
};

/** aggregate min on columns */
export type Components_Component_Min_Fields = {
  __typename?: 'components_component_min_fields';
  boardId?: Maybe<Scalars['uuid']['output']>;
  boardName?: Maybe<Scalars['String']['output']>;
  componentType?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['bigint']['output']>;
  createdBy?: Maybe<Scalars['String']['output']>;
  fill?: Maybe<Scalars['String']['output']>;
  headEdge?: Maybe<Scalars['String']['output']>;
  headPortIndex?: Maybe<Scalars['Int']['output']>;
  headShapeId?: Maybe<Scalars['uuid']['output']>;
  height?: Maybe<Scalars['float8']['output']>;
  iconStroke?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  linewidth?: Maybe<Scalars['float8']['output']>;
  objectClass?: Maybe<Scalars['String']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  radius?: Maybe<Scalars['float8']['output']>;
  stroke?: Maybe<Scalars['String']['output']>;
  strokeType?: Maybe<Scalars['String']['output']>;
  tailEdge?: Maybe<Scalars['String']['output']>;
  tailPortIndex?: Maybe<Scalars['Int']['output']>;
  tailShapeId?: Maybe<Scalars['uuid']['output']>;
  textColor?: Maybe<Scalars['String']['output']>;
  updatedBy?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['float8']['output']>;
  x?: Maybe<Scalars['float8']['output']>;
  x1?: Maybe<Scalars['float8']['output']>;
  x2?: Maybe<Scalars['float8']['output']>;
  y?: Maybe<Scalars['float8']['output']>;
  y1?: Maybe<Scalars['float8']['output']>;
  y2?: Maybe<Scalars['float8']['output']>;
};

/** response of any mutation on the table "components.component" */
export type Components_Component_Mutation_Response = {
  __typename?: 'components_component_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Components_Component>;
};

/** on_conflict condition type for table "components.component" */
export type Components_Component_On_Conflict = {
  constraint: Components_Component_Constraint;
  update_columns?: Array<Components_Component_Update_Column>;
  where?: InputMaybe<Components_Component_Bool_Exp>;
};

/** Ordering options when selecting data from "components.component". */
export type Components_Component_Order_By = {
  board?: InputMaybe<Boards_Board_Order_By>;
  boardId?: InputMaybe<Order_By>;
  boardName?: InputMaybe<Order_By>;
  children?: InputMaybe<Order_By>;
  componentType?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  createdBy?: InputMaybe<Order_By>;
  fill?: InputMaybe<Order_By>;
  headEdge?: InputMaybe<Order_By>;
  headPortIndex?: InputMaybe<Order_By>;
  headShapeId?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  iconStroke?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isDummy?: InputMaybe<Order_By>;
  linewidth?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  objectClass?: InputMaybe<Order_By>;
  opacity?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  radius?: InputMaybe<Order_By>;
  stroke?: InputMaybe<Order_By>;
  strokeType?: InputMaybe<Order_By>;
  tailEdge?: InputMaybe<Order_By>;
  tailPortIndex?: InputMaybe<Order_By>;
  tailShapeId?: InputMaybe<Order_By>;
  textColor?: InputMaybe<Order_By>;
  updatedBy?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
  x?: InputMaybe<Order_By>;
  x1?: InputMaybe<Order_By>;
  x2?: InputMaybe<Order_By>;
  y?: InputMaybe<Order_By>;
  y1?: InputMaybe<Order_By>;
  y2?: InputMaybe<Order_By>;
};

/** primary key columns input for table: components.component */
export type Components_Component_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Components_Component_Prepend_Input = {
  children?: InputMaybe<Scalars['jsonb']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "components.component" */
export type Components_Component_Select_Column =
  /** column name */
  | 'boardId'
  /** column name */
  | 'boardName'
  /** column name */
  | 'children'
  /** column name */
  | 'componentType'
  /** column name */
  | 'createdAt'
  /** column name */
  | 'createdBy'
  /** column name */
  | 'fill'
  /** column name */
  | 'headEdge'
  /** column name */
  | 'headPortIndex'
  /** column name */
  | 'headShapeId'
  /** column name */
  | 'height'
  /** column name */
  | 'iconStroke'
  /** column name */
  | 'id'
  /** column name */
  | 'isDummy'
  /** column name */
  | 'linewidth'
  /** column name */
  | 'metadata'
  /** column name */
  | 'objectClass'
  /** column name */
  | 'opacity'
  /** column name */
  | 'position'
  /** column name */
  | 'radius'
  /** column name */
  | 'stroke'
  /** column name */
  | 'strokeType'
  /** column name */
  | 'tailEdge'
  /** column name */
  | 'tailPortIndex'
  /** column name */
  | 'tailShapeId'
  /** column name */
  | 'textColor'
  /** column name */
  | 'updatedBy'
  /** column name */
  | 'width'
  /** column name */
  | 'x'
  /** column name */
  | 'x1'
  /** column name */
  | 'x2'
  /** column name */
  | 'y'
  /** column name */
  | 'y1'
  /** column name */
  | 'y2';

/** input type for updating data in table "components.component" */
export type Components_Component_Set_Input = {
  boardId?: InputMaybe<Scalars['uuid']['input']>;
  boardName?: InputMaybe<Scalars['String']['input']>;
  children?: InputMaybe<Scalars['jsonb']['input']>;
  componentType?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  fill?: InputMaybe<Scalars['String']['input']>;
  headEdge?: InputMaybe<Scalars['String']['input']>;
  headPortIndex?: InputMaybe<Scalars['Int']['input']>;
  headShapeId?: InputMaybe<Scalars['uuid']['input']>;
  height?: InputMaybe<Scalars['float8']['input']>;
  iconStroke?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isDummy?: InputMaybe<Scalars['Boolean']['input']>;
  linewidth?: InputMaybe<Scalars['float8']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
  objectClass?: InputMaybe<Scalars['String']['input']>;
  opacity?: InputMaybe<Scalars['Float']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  radius?: InputMaybe<Scalars['float8']['input']>;
  stroke?: InputMaybe<Scalars['String']['input']>;
  strokeType?: InputMaybe<Scalars['String']['input']>;
  tailEdge?: InputMaybe<Scalars['String']['input']>;
  tailPortIndex?: InputMaybe<Scalars['Int']['input']>;
  tailShapeId?: InputMaybe<Scalars['uuid']['input']>;
  textColor?: InputMaybe<Scalars['String']['input']>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
  width?: InputMaybe<Scalars['float8']['input']>;
  x?: InputMaybe<Scalars['float8']['input']>;
  x1?: InputMaybe<Scalars['float8']['input']>;
  x2?: InputMaybe<Scalars['float8']['input']>;
  y?: InputMaybe<Scalars['float8']['input']>;
  y1?: InputMaybe<Scalars['float8']['input']>;
  y2?: InputMaybe<Scalars['float8']['input']>;
};

/** aggregate stddev on columns */
export type Components_Component_Stddev_Fields = {
  __typename?: 'components_component_stddev_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  headPortIndex?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  linewidth?: Maybe<Scalars['Float']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  tailPortIndex?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  x1?: Maybe<Scalars['Float']['output']>;
  x2?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  y1?: Maybe<Scalars['Float']['output']>;
  y2?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Components_Component_Stddev_Pop_Fields = {
  __typename?: 'components_component_stddev_pop_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  headPortIndex?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  linewidth?: Maybe<Scalars['Float']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  tailPortIndex?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  x1?: Maybe<Scalars['Float']['output']>;
  x2?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  y1?: Maybe<Scalars['Float']['output']>;
  y2?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Components_Component_Stddev_Samp_Fields = {
  __typename?: 'components_component_stddev_samp_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  headPortIndex?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  linewidth?: Maybe<Scalars['Float']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  tailPortIndex?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  x1?: Maybe<Scalars['Float']['output']>;
  x2?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  y1?: Maybe<Scalars['Float']['output']>;
  y2?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "components_component" */
export type Components_Component_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Components_Component_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Components_Component_Stream_Cursor_Value_Input = {
  boardId?: InputMaybe<Scalars['uuid']['input']>;
  boardName?: InputMaybe<Scalars['String']['input']>;
  children?: InputMaybe<Scalars['jsonb']['input']>;
  componentType?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['bigint']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  fill?: InputMaybe<Scalars['String']['input']>;
  headEdge?: InputMaybe<Scalars['String']['input']>;
  headPortIndex?: InputMaybe<Scalars['Int']['input']>;
  headShapeId?: InputMaybe<Scalars['uuid']['input']>;
  height?: InputMaybe<Scalars['float8']['input']>;
  iconStroke?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isDummy?: InputMaybe<Scalars['Boolean']['input']>;
  linewidth?: InputMaybe<Scalars['float8']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
  objectClass?: InputMaybe<Scalars['String']['input']>;
  opacity?: InputMaybe<Scalars['Float']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  radius?: InputMaybe<Scalars['float8']['input']>;
  stroke?: InputMaybe<Scalars['String']['input']>;
  strokeType?: InputMaybe<Scalars['String']['input']>;
  tailEdge?: InputMaybe<Scalars['String']['input']>;
  tailPortIndex?: InputMaybe<Scalars['Int']['input']>;
  tailShapeId?: InputMaybe<Scalars['uuid']['input']>;
  textColor?: InputMaybe<Scalars['String']['input']>;
  updatedBy?: InputMaybe<Scalars['String']['input']>;
  width?: InputMaybe<Scalars['float8']['input']>;
  x?: InputMaybe<Scalars['float8']['input']>;
  x1?: InputMaybe<Scalars['float8']['input']>;
  x2?: InputMaybe<Scalars['float8']['input']>;
  y?: InputMaybe<Scalars['float8']['input']>;
  y1?: InputMaybe<Scalars['float8']['input']>;
  y2?: InputMaybe<Scalars['float8']['input']>;
};

/** aggregate sum on columns */
export type Components_Component_Sum_Fields = {
  __typename?: 'components_component_sum_fields';
  createdAt?: Maybe<Scalars['bigint']['output']>;
  headPortIndex?: Maybe<Scalars['Int']['output']>;
  height?: Maybe<Scalars['float8']['output']>;
  linewidth?: Maybe<Scalars['float8']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  radius?: Maybe<Scalars['float8']['output']>;
  tailPortIndex?: Maybe<Scalars['Int']['output']>;
  width?: Maybe<Scalars['float8']['output']>;
  x?: Maybe<Scalars['float8']['output']>;
  x1?: Maybe<Scalars['float8']['output']>;
  x2?: Maybe<Scalars['float8']['output']>;
  y?: Maybe<Scalars['float8']['output']>;
  y1?: Maybe<Scalars['float8']['output']>;
  y2?: Maybe<Scalars['float8']['output']>;
};

/** update columns of table "components.component" */
export type Components_Component_Update_Column =
  /** column name */
  | 'boardId'
  /** column name */
  | 'boardName'
  /** column name */
  | 'children'
  /** column name */
  | 'componentType'
  /** column name */
  | 'createdAt'
  /** column name */
  | 'createdBy'
  /** column name */
  | 'fill'
  /** column name */
  | 'headEdge'
  /** column name */
  | 'headPortIndex'
  /** column name */
  | 'headShapeId'
  /** column name */
  | 'height'
  /** column name */
  | 'iconStroke'
  /** column name */
  | 'id'
  /** column name */
  | 'isDummy'
  /** column name */
  | 'linewidth'
  /** column name */
  | 'metadata'
  /** column name */
  | 'objectClass'
  /** column name */
  | 'opacity'
  /** column name */
  | 'position'
  /** column name */
  | 'radius'
  /** column name */
  | 'stroke'
  /** column name */
  | 'strokeType'
  /** column name */
  | 'tailEdge'
  /** column name */
  | 'tailPortIndex'
  /** column name */
  | 'tailShapeId'
  /** column name */
  | 'textColor'
  /** column name */
  | 'updatedBy'
  /** column name */
  | 'width'
  /** column name */
  | 'x'
  /** column name */
  | 'x1'
  /** column name */
  | 'x2'
  /** column name */
  | 'y'
  /** column name */
  | 'y1'
  /** column name */
  | 'y2';

export type Components_Component_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Components_Component_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Components_Component_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Components_Component_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Components_Component_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Components_Component_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Components_Component_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Components_Component_Set_Input>;
  /** filter the rows which have to be updated */
  where: Components_Component_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Components_Component_Var_Pop_Fields = {
  __typename?: 'components_component_var_pop_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  headPortIndex?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  linewidth?: Maybe<Scalars['Float']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  tailPortIndex?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  x1?: Maybe<Scalars['Float']['output']>;
  x2?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  y1?: Maybe<Scalars['Float']['output']>;
  y2?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Components_Component_Var_Samp_Fields = {
  __typename?: 'components_component_var_samp_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  headPortIndex?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  linewidth?: Maybe<Scalars['Float']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  tailPortIndex?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  x1?: Maybe<Scalars['Float']['output']>;
  x2?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  y1?: Maybe<Scalars['Float']['output']>;
  y2?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Components_Component_Variance_Fields = {
  __typename?: 'components_component_variance_fields';
  createdAt?: Maybe<Scalars['Float']['output']>;
  headPortIndex?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  linewidth?: Maybe<Scalars['Float']['output']>;
  opacity?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  radius?: Maybe<Scalars['Float']['output']>;
  tailPortIndex?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
  x?: Maybe<Scalars['Float']['output']>;
  x1?: Maybe<Scalars['Float']['output']>;
  x2?: Maybe<Scalars['Float']['output']>;
  y?: Maybe<Scalars['Float']['output']>;
  y1?: Maybe<Scalars['Float']['output']>;
  y2?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "components.geoObjectType" */
export type Components_GeoObjectType = {
  __typename?: 'components_geoObjectType';
  defaultStroke?: Maybe<Scalars['String']['output']>;
  label: Scalars['String']['output'];
  linewidth?: Maybe<Scalars['Int']['output']>;
  logo?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['jsonb']['output']>;
};


/** columns and relationships of "components.geoObjectType" */
export type Components_GeoObjectTypeMetadataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "components.geoObjectType" */
export type Components_GeoObjectType_Aggregate = {
  __typename?: 'components_geoObjectType_aggregate';
  aggregate?: Maybe<Components_GeoObjectType_Aggregate_Fields>;
  nodes: Array<Components_GeoObjectType>;
};

/** aggregate fields of "components.geoObjectType" */
export type Components_GeoObjectType_Aggregate_Fields = {
  __typename?: 'components_geoObjectType_aggregate_fields';
  avg?: Maybe<Components_GeoObjectType_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Components_GeoObjectType_Max_Fields>;
  min?: Maybe<Components_GeoObjectType_Min_Fields>;
  stddev?: Maybe<Components_GeoObjectType_Stddev_Fields>;
  stddev_pop?: Maybe<Components_GeoObjectType_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Components_GeoObjectType_Stddev_Samp_Fields>;
  sum?: Maybe<Components_GeoObjectType_Sum_Fields>;
  var_pop?: Maybe<Components_GeoObjectType_Var_Pop_Fields>;
  var_samp?: Maybe<Components_GeoObjectType_Var_Samp_Fields>;
  variance?: Maybe<Components_GeoObjectType_Variance_Fields>;
};


/** aggregate fields of "components.geoObjectType" */
export type Components_GeoObjectType_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Components_GeoObjectType_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Components_GeoObjectType_Append_Input = {
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate avg on columns */
export type Components_GeoObjectType_Avg_Fields = {
  __typename?: 'components_geoObjectType_avg_fields';
  linewidth?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "components.geoObjectType". All fields are combined with a logical 'AND'. */
export type Components_GeoObjectType_Bool_Exp = {
  _and?: InputMaybe<Array<Components_GeoObjectType_Bool_Exp>>;
  _not?: InputMaybe<Components_GeoObjectType_Bool_Exp>;
  _or?: InputMaybe<Array<Components_GeoObjectType_Bool_Exp>>;
  defaultStroke?: InputMaybe<String_Comparison_Exp>;
  label?: InputMaybe<String_Comparison_Exp>;
  linewidth?: InputMaybe<Int_Comparison_Exp>;
  logo?: InputMaybe<String_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
};

/** unique or primary key constraints on table "components.geoObjectType" */
export type Components_GeoObjectType_Constraint =
  /** unique or primary key constraint on columns "label" */
  | 'geoObjectType_pkey';

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Components_GeoObjectType_Delete_At_Path_Input = {
  metadata?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Components_GeoObjectType_Delete_Elem_Input = {
  metadata?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Components_GeoObjectType_Delete_Key_Input = {
  metadata?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "components.geoObjectType" */
export type Components_GeoObjectType_Inc_Input = {
  linewidth?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "components.geoObjectType" */
export type Components_GeoObjectType_Insert_Input = {
  defaultStroke?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  linewidth?: InputMaybe<Scalars['Int']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate max on columns */
export type Components_GeoObjectType_Max_Fields = {
  __typename?: 'components_geoObjectType_max_fields';
  defaultStroke?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  linewidth?: Maybe<Scalars['Int']['output']>;
  logo?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Components_GeoObjectType_Min_Fields = {
  __typename?: 'components_geoObjectType_min_fields';
  defaultStroke?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  linewidth?: Maybe<Scalars['Int']['output']>;
  logo?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "components.geoObjectType" */
export type Components_GeoObjectType_Mutation_Response = {
  __typename?: 'components_geoObjectType_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Components_GeoObjectType>;
};

/** on_conflict condition type for table "components.geoObjectType" */
export type Components_GeoObjectType_On_Conflict = {
  constraint: Components_GeoObjectType_Constraint;
  update_columns?: Array<Components_GeoObjectType_Update_Column>;
  where?: InputMaybe<Components_GeoObjectType_Bool_Exp>;
};

/** Ordering options when selecting data from "components.geoObjectType". */
export type Components_GeoObjectType_Order_By = {
  defaultStroke?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  linewidth?: InputMaybe<Order_By>;
  logo?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
};

/** primary key columns input for table: components.geoObjectType */
export type Components_GeoObjectType_Pk_Columns_Input = {
  label: Scalars['String']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Components_GeoObjectType_Prepend_Input = {
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "components.geoObjectType" */
export type Components_GeoObjectType_Select_Column =
  /** column name */
  | 'defaultStroke'
  /** column name */
  | 'label'
  /** column name */
  | 'linewidth'
  /** column name */
  | 'logo'
  /** column name */
  | 'metadata';

/** input type for updating data in table "components.geoObjectType" */
export type Components_GeoObjectType_Set_Input = {
  defaultStroke?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  linewidth?: InputMaybe<Scalars['Int']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate stddev on columns */
export type Components_GeoObjectType_Stddev_Fields = {
  __typename?: 'components_geoObjectType_stddev_fields';
  linewidth?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Components_GeoObjectType_Stddev_Pop_Fields = {
  __typename?: 'components_geoObjectType_stddev_pop_fields';
  linewidth?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Components_GeoObjectType_Stddev_Samp_Fields = {
  __typename?: 'components_geoObjectType_stddev_samp_fields';
  linewidth?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "components_geoObjectType" */
export type Components_GeoObjectType_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Components_GeoObjectType_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Components_GeoObjectType_Stream_Cursor_Value_Input = {
  defaultStroke?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  linewidth?: InputMaybe<Scalars['Int']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate sum on columns */
export type Components_GeoObjectType_Sum_Fields = {
  __typename?: 'components_geoObjectType_sum_fields';
  linewidth?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "components.geoObjectType" */
export type Components_GeoObjectType_Update_Column =
  /** column name */
  | 'defaultStroke'
  /** column name */
  | 'label'
  /** column name */
  | 'linewidth'
  /** column name */
  | 'logo'
  /** column name */
  | 'metadata';

export type Components_GeoObjectType_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Components_GeoObjectType_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Components_GeoObjectType_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Components_GeoObjectType_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Components_GeoObjectType_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Components_GeoObjectType_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Components_GeoObjectType_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Components_GeoObjectType_Set_Input>;
  /** filter the rows which have to be updated */
  where: Components_GeoObjectType_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Components_GeoObjectType_Var_Pop_Fields = {
  __typename?: 'components_geoObjectType_var_pop_fields';
  linewidth?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Components_GeoObjectType_Var_Samp_Fields = {
  __typename?: 'components_geoObjectType_var_samp_fields';
  linewidth?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Components_GeoObjectType_Variance_Fields = {
  __typename?: 'components_geoObjectType_variance_fields';
  linewidth?: Maybe<Scalars['Float']['output']>;
};

/** ordering argument of a cursor */
export type Cursor_Ordering =
  /** ascending ordering of the cursor */
  | 'ASC'
  /** descending ordering of the cursor */
  | 'DESC';

/** Boolean expression to compare columns of type "float8". All fields are combined with logical 'AND'. */
export type Float8_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['float8']['input']>;
  _gt?: InputMaybe<Scalars['float8']['input']>;
  _gte?: InputMaybe<Scalars['float8']['input']>;
  _in?: InputMaybe<Array<Scalars['float8']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['float8']['input']>;
  _lte?: InputMaybe<Scalars['float8']['input']>;
  _neq?: InputMaybe<Scalars['float8']['input']>;
  _nin?: InputMaybe<Array<Scalars['float8']['input']>>;
};

export type Jsonb_Cast_Exp = {
  String?: InputMaybe<String_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type Jsonb_Comparison_Exp = {
  _cast?: InputMaybe<Jsonb_Cast_Exp>;
  /** is the column contained in the given json value */
  _contained_in?: InputMaybe<Scalars['jsonb']['input']>;
  /** does the column contain the given json value at the top level */
  _contains?: InputMaybe<Scalars['jsonb']['input']>;
  _eq?: InputMaybe<Scalars['jsonb']['input']>;
  _gt?: InputMaybe<Scalars['jsonb']['input']>;
  _gte?: InputMaybe<Scalars['jsonb']['input']>;
  /** does the string exist as a top-level key in the column */
  _has_key?: InputMaybe<Scalars['String']['input']>;
  /** do all of these strings exist as top-level keys in the column */
  _has_keys_all?: InputMaybe<Array<Scalars['String']['input']>>;
  /** do any of these strings exist as top-level keys in the column */
  _has_keys_any?: InputMaybe<Array<Scalars['String']['input']>>;
  _in?: InputMaybe<Array<Scalars['jsonb']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['jsonb']['input']>;
  _lte?: InputMaybe<Scalars['jsonb']['input']>;
  _neq?: InputMaybe<Scalars['jsonb']['input']>;
  _nin?: InputMaybe<Array<Scalars['jsonb']['input']>>;
};

/** mutation root */
export type Mutation_Root = {
  __typename?: 'mutation_root';
  /** delete data from the table: "boards.board" */
  delete_boards_board?: Maybe<Boards_Board_Mutation_Response>;
  /** delete single row from the table: "boards.board" */
  delete_boards_board_by_pk?: Maybe<Boards_Board>;
  /** delete data from the table: "components.component" */
  delete_components_component?: Maybe<Components_Component_Mutation_Response>;
  /** delete data from the table: "components.componentType" */
  delete_components_componentType?: Maybe<Components_ComponentType_Mutation_Response>;
  /** delete single row from the table: "components.componentType" */
  delete_components_componentType_by_pk?: Maybe<Components_ComponentType>;
  /** delete single row from the table: "components.component" */
  delete_components_component_by_pk?: Maybe<Components_Component>;
  /** delete data from the table: "components.geoObjectType" */
  delete_components_geoObjectType?: Maybe<Components_GeoObjectType_Mutation_Response>;
  /** delete single row from the table: "components.geoObjectType" */
  delete_components_geoObjectType_by_pk?: Maybe<Components_GeoObjectType>;
  /** delete data from the table: "test" */
  delete_test?: Maybe<Test_Mutation_Response>;
  /** delete single row from the table: "test" */
  delete_test_by_pk?: Maybe<Test>;
  /** delete data from the table: "users.user" */
  delete_users_user?: Maybe<Users_User_Mutation_Response>;
  /** delete single row from the table: "users.user" */
  delete_users_user_by_pk?: Maybe<Users_User>;
  /** delete data from the table: "users.user_revisits" */
  delete_users_user_revisits?: Maybe<Users_User_Revisits_Mutation_Response>;
  /** delete single row from the table: "users.user_revisits" */
  delete_users_user_revisits_by_pk?: Maybe<Users_User_Revisits>;
  /** insert data into the table: "boards.board" */
  insert_boards_board?: Maybe<Boards_Board_Mutation_Response>;
  /** insert a single row into the table: "boards.board" */
  insert_boards_board_one?: Maybe<Boards_Board>;
  /** insert data into the table: "components.component" */
  insert_components_component?: Maybe<Components_Component_Mutation_Response>;
  /** insert data into the table: "components.componentType" */
  insert_components_componentType?: Maybe<Components_ComponentType_Mutation_Response>;
  /** insert a single row into the table: "components.componentType" */
  insert_components_componentType_one?: Maybe<Components_ComponentType>;
  /** insert a single row into the table: "components.component" */
  insert_components_component_one?: Maybe<Components_Component>;
  /** insert data into the table: "components.geoObjectType" */
  insert_components_geoObjectType?: Maybe<Components_GeoObjectType_Mutation_Response>;
  /** insert a single row into the table: "components.geoObjectType" */
  insert_components_geoObjectType_one?: Maybe<Components_GeoObjectType>;
  /** insert data into the table: "test" */
  insert_test?: Maybe<Test_Mutation_Response>;
  /** insert a single row into the table: "test" */
  insert_test_one?: Maybe<Test>;
  /** insert data into the table: "users.user" */
  insert_users_user?: Maybe<Users_User_Mutation_Response>;
  /** insert a single row into the table: "users.user" */
  insert_users_user_one?: Maybe<Users_User>;
  /** insert data into the table: "users.user_revisits" */
  insert_users_user_revisits?: Maybe<Users_User_Revisits_Mutation_Response>;
  /** insert a single row into the table: "users.user_revisits" */
  insert_users_user_revisits_one?: Maybe<Users_User_Revisits>;
  /** update data of the table: "boards.board" */
  update_boards_board?: Maybe<Boards_Board_Mutation_Response>;
  /** update single row of the table: "boards.board" */
  update_boards_board_by_pk?: Maybe<Boards_Board>;
  /** update multiples rows of table: "boards.board" */
  update_boards_board_many?: Maybe<Array<Maybe<Boards_Board_Mutation_Response>>>;
  /** update data of the table: "components.component" */
  update_components_component?: Maybe<Components_Component_Mutation_Response>;
  /** update data of the table: "components.componentType" */
  update_components_componentType?: Maybe<Components_ComponentType_Mutation_Response>;
  /** update single row of the table: "components.componentType" */
  update_components_componentType_by_pk?: Maybe<Components_ComponentType>;
  /** update multiples rows of table: "components.componentType" */
  update_components_componentType_many?: Maybe<Array<Maybe<Components_ComponentType_Mutation_Response>>>;
  /** update single row of the table: "components.component" */
  update_components_component_by_pk?: Maybe<Components_Component>;
  /** update multiples rows of table: "components.component" */
  update_components_component_many?: Maybe<Array<Maybe<Components_Component_Mutation_Response>>>;
  /** update data of the table: "components.geoObjectType" */
  update_components_geoObjectType?: Maybe<Components_GeoObjectType_Mutation_Response>;
  /** update single row of the table: "components.geoObjectType" */
  update_components_geoObjectType_by_pk?: Maybe<Components_GeoObjectType>;
  /** update multiples rows of table: "components.geoObjectType" */
  update_components_geoObjectType_many?: Maybe<Array<Maybe<Components_GeoObjectType_Mutation_Response>>>;
  /** update data of the table: "test" */
  update_test?: Maybe<Test_Mutation_Response>;
  /** update single row of the table: "test" */
  update_test_by_pk?: Maybe<Test>;
  /** update multiples rows of table: "test" */
  update_test_many?: Maybe<Array<Maybe<Test_Mutation_Response>>>;
  /** update data of the table: "users.user" */
  update_users_user?: Maybe<Users_User_Mutation_Response>;
  /** update single row of the table: "users.user" */
  update_users_user_by_pk?: Maybe<Users_User>;
  /** update multiples rows of table: "users.user" */
  update_users_user_many?: Maybe<Array<Maybe<Users_User_Mutation_Response>>>;
  /** update data of the table: "users.user_revisits" */
  update_users_user_revisits?: Maybe<Users_User_Revisits_Mutation_Response>;
  /** update single row of the table: "users.user_revisits" */
  update_users_user_revisits_by_pk?: Maybe<Users_User_Revisits>;
  /** update multiples rows of table: "users.user_revisits" */
  update_users_user_revisits_many?: Maybe<Array<Maybe<Users_User_Revisits_Mutation_Response>>>;
};


/** mutation root */
export type Mutation_RootDelete_Boards_BoardArgs = {
  where: Boards_Board_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Boards_Board_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Components_ComponentArgs = {
  where: Components_Component_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Components_ComponentTypeArgs = {
  where: Components_ComponentType_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Components_ComponentType_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Components_Component_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Components_GeoObjectTypeArgs = {
  where: Components_GeoObjectType_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Components_GeoObjectType_By_PkArgs = {
  label: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_TestArgs = {
  where: Test_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Test_By_PkArgs = {
  id: Scalars['Int']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Users_UserArgs = {
  where: Users_User_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Users_User_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Users_User_RevisitsArgs = {
  where: Users_User_Revisits_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Users_User_Revisits_By_PkArgs = {
  user_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootInsert_Boards_BoardArgs = {
  objects: Array<Boards_Board_Insert_Input>;
  on_conflict?: InputMaybe<Boards_Board_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Boards_Board_OneArgs = {
  object: Boards_Board_Insert_Input;
  on_conflict?: InputMaybe<Boards_Board_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Components_ComponentArgs = {
  objects: Array<Components_Component_Insert_Input>;
  on_conflict?: InputMaybe<Components_Component_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Components_ComponentTypeArgs = {
  objects: Array<Components_ComponentType_Insert_Input>;
  on_conflict?: InputMaybe<Components_ComponentType_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Components_ComponentType_OneArgs = {
  object: Components_ComponentType_Insert_Input;
  on_conflict?: InputMaybe<Components_ComponentType_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Components_Component_OneArgs = {
  object: Components_Component_Insert_Input;
  on_conflict?: InputMaybe<Components_Component_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Components_GeoObjectTypeArgs = {
  objects: Array<Components_GeoObjectType_Insert_Input>;
  on_conflict?: InputMaybe<Components_GeoObjectType_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Components_GeoObjectType_OneArgs = {
  object: Components_GeoObjectType_Insert_Input;
  on_conflict?: InputMaybe<Components_GeoObjectType_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_TestArgs = {
  objects: Array<Test_Insert_Input>;
  on_conflict?: InputMaybe<Test_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Test_OneArgs = {
  object: Test_Insert_Input;
  on_conflict?: InputMaybe<Test_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Users_UserArgs = {
  objects: Array<Users_User_Insert_Input>;
  on_conflict?: InputMaybe<Users_User_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Users_User_OneArgs = {
  object: Users_User_Insert_Input;
  on_conflict?: InputMaybe<Users_User_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Users_User_RevisitsArgs = {
  objects: Array<Users_User_Revisits_Insert_Input>;
  on_conflict?: InputMaybe<Users_User_Revisits_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Users_User_Revisits_OneArgs = {
  object: Users_User_Revisits_Insert_Input;
  on_conflict?: InputMaybe<Users_User_Revisits_On_Conflict>;
};


/** mutation root */
export type Mutation_RootUpdate_Boards_BoardArgs = {
  _append?: InputMaybe<Boards_Board_Append_Input>;
  _delete_at_path?: InputMaybe<Boards_Board_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Boards_Board_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Boards_Board_Delete_Key_Input>;
  _inc?: InputMaybe<Boards_Board_Inc_Input>;
  _prepend?: InputMaybe<Boards_Board_Prepend_Input>;
  _set?: InputMaybe<Boards_Board_Set_Input>;
  where: Boards_Board_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Boards_Board_By_PkArgs = {
  _append?: InputMaybe<Boards_Board_Append_Input>;
  _delete_at_path?: InputMaybe<Boards_Board_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Boards_Board_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Boards_Board_Delete_Key_Input>;
  _inc?: InputMaybe<Boards_Board_Inc_Input>;
  _prepend?: InputMaybe<Boards_Board_Prepend_Input>;
  _set?: InputMaybe<Boards_Board_Set_Input>;
  pk_columns: Boards_Board_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Boards_Board_ManyArgs = {
  updates: Array<Boards_Board_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Components_ComponentArgs = {
  _append?: InputMaybe<Components_Component_Append_Input>;
  _delete_at_path?: InputMaybe<Components_Component_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Components_Component_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Components_Component_Delete_Key_Input>;
  _inc?: InputMaybe<Components_Component_Inc_Input>;
  _prepend?: InputMaybe<Components_Component_Prepend_Input>;
  _set?: InputMaybe<Components_Component_Set_Input>;
  where: Components_Component_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Components_ComponentTypeArgs = {
  _append?: InputMaybe<Components_ComponentType_Append_Input>;
  _delete_at_path?: InputMaybe<Components_ComponentType_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Components_ComponentType_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Components_ComponentType_Delete_Key_Input>;
  _inc?: InputMaybe<Components_ComponentType_Inc_Input>;
  _prepend?: InputMaybe<Components_ComponentType_Prepend_Input>;
  _set?: InputMaybe<Components_ComponentType_Set_Input>;
  where: Components_ComponentType_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Components_ComponentType_By_PkArgs = {
  _append?: InputMaybe<Components_ComponentType_Append_Input>;
  _delete_at_path?: InputMaybe<Components_ComponentType_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Components_ComponentType_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Components_ComponentType_Delete_Key_Input>;
  _inc?: InputMaybe<Components_ComponentType_Inc_Input>;
  _prepend?: InputMaybe<Components_ComponentType_Prepend_Input>;
  _set?: InputMaybe<Components_ComponentType_Set_Input>;
  pk_columns: Components_ComponentType_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Components_ComponentType_ManyArgs = {
  updates: Array<Components_ComponentType_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Components_Component_By_PkArgs = {
  _append?: InputMaybe<Components_Component_Append_Input>;
  _delete_at_path?: InputMaybe<Components_Component_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Components_Component_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Components_Component_Delete_Key_Input>;
  _inc?: InputMaybe<Components_Component_Inc_Input>;
  _prepend?: InputMaybe<Components_Component_Prepend_Input>;
  _set?: InputMaybe<Components_Component_Set_Input>;
  pk_columns: Components_Component_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Components_Component_ManyArgs = {
  updates: Array<Components_Component_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Components_GeoObjectTypeArgs = {
  _append?: InputMaybe<Components_GeoObjectType_Append_Input>;
  _delete_at_path?: InputMaybe<Components_GeoObjectType_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Components_GeoObjectType_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Components_GeoObjectType_Delete_Key_Input>;
  _inc?: InputMaybe<Components_GeoObjectType_Inc_Input>;
  _prepend?: InputMaybe<Components_GeoObjectType_Prepend_Input>;
  _set?: InputMaybe<Components_GeoObjectType_Set_Input>;
  where: Components_GeoObjectType_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Components_GeoObjectType_By_PkArgs = {
  _append?: InputMaybe<Components_GeoObjectType_Append_Input>;
  _delete_at_path?: InputMaybe<Components_GeoObjectType_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Components_GeoObjectType_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Components_GeoObjectType_Delete_Key_Input>;
  _inc?: InputMaybe<Components_GeoObjectType_Inc_Input>;
  _prepend?: InputMaybe<Components_GeoObjectType_Prepend_Input>;
  _set?: InputMaybe<Components_GeoObjectType_Set_Input>;
  pk_columns: Components_GeoObjectType_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Components_GeoObjectType_ManyArgs = {
  updates: Array<Components_GeoObjectType_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_TestArgs = {
  _inc?: InputMaybe<Test_Inc_Input>;
  _set?: InputMaybe<Test_Set_Input>;
  where: Test_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Test_By_PkArgs = {
  _inc?: InputMaybe<Test_Inc_Input>;
  _set?: InputMaybe<Test_Set_Input>;
  pk_columns: Test_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Test_ManyArgs = {
  updates: Array<Test_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Users_UserArgs = {
  _set?: InputMaybe<Users_User_Set_Input>;
  where: Users_User_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Users_User_By_PkArgs = {
  _set?: InputMaybe<Users_User_Set_Input>;
  pk_columns: Users_User_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Users_User_ManyArgs = {
  updates: Array<Users_User_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Users_User_RevisitsArgs = {
  _inc?: InputMaybe<Users_User_Revisits_Inc_Input>;
  _set?: InputMaybe<Users_User_Revisits_Set_Input>;
  where: Users_User_Revisits_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Users_User_Revisits_By_PkArgs = {
  _inc?: InputMaybe<Users_User_Revisits_Inc_Input>;
  _set?: InputMaybe<Users_User_Revisits_Set_Input>;
  pk_columns: Users_User_Revisits_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Users_User_Revisits_ManyArgs = {
  updates: Array<Users_User_Revisits_Updates>;
};

/** column ordering options */
export type Order_By =
  /** in ascending order, nulls last */
  | 'asc'
  /** in ascending order, nulls first */
  | 'asc_nulls_first'
  /** in ascending order, nulls last */
  | 'asc_nulls_last'
  /** in descending order, nulls first */
  | 'desc'
  /** in descending order, nulls first */
  | 'desc_nulls_first'
  /** in descending order, nulls last */
  | 'desc_nulls_last';

export type Query_Root = {
  __typename?: 'query_root';
  /** fetch data from the table: "boards.board" */
  boards_board: Array<Boards_Board>;
  /** fetch aggregated fields from the table: "boards.board" */
  boards_board_aggregate: Boards_Board_Aggregate;
  /** fetch data from the table: "boards.board" using primary key columns */
  boards_board_by_pk?: Maybe<Boards_Board>;
  /** fetch data from the table: "components.component" */
  components_component: Array<Components_Component>;
  /** fetch data from the table: "components.componentType" */
  components_componentType: Array<Components_ComponentType>;
  /** fetch aggregated fields from the table: "components.componentType" */
  components_componentType_aggregate: Components_ComponentType_Aggregate;
  /** fetch data from the table: "components.componentType" using primary key columns */
  components_componentType_by_pk?: Maybe<Components_ComponentType>;
  /** fetch aggregated fields from the table: "components.component" */
  components_component_aggregate: Components_Component_Aggregate;
  /** fetch data from the table: "components.component" using primary key columns */
  components_component_by_pk?: Maybe<Components_Component>;
  /** fetch data from the table: "components.geoObjectType" */
  components_geoObjectType: Array<Components_GeoObjectType>;
  /** fetch aggregated fields from the table: "components.geoObjectType" */
  components_geoObjectType_aggregate: Components_GeoObjectType_Aggregate;
  /** fetch data from the table: "components.geoObjectType" using primary key columns */
  components_geoObjectType_by_pk?: Maybe<Components_GeoObjectType>;
  /** fetch data from the table: "test" */
  test: Array<Test>;
  /** fetch aggregated fields from the table: "test" */
  test_aggregate: Test_Aggregate;
  /** fetch data from the table: "test" using primary key columns */
  test_by_pk?: Maybe<Test>;
  /** fetch data from the table: "users.user" */
  users_user: Array<Users_User>;
  /** fetch aggregated fields from the table: "users.user" */
  users_user_aggregate: Users_User_Aggregate;
  /** fetch data from the table: "users.user" using primary key columns */
  users_user_by_pk?: Maybe<Users_User>;
  /** fetch data from the table: "users.user_revisits" */
  users_user_revisits: Array<Users_User_Revisits>;
  /** fetch aggregated fields from the table: "users.user_revisits" */
  users_user_revisits_aggregate: Users_User_Revisits_Aggregate;
  /** fetch data from the table: "users.user_revisits" using primary key columns */
  users_user_revisits_by_pk?: Maybe<Users_User_Revisits>;
};


export type Query_RootBoards_BoardArgs = {
  distinct_on?: InputMaybe<Array<Boards_Board_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Boards_Board_Order_By>>;
  where?: InputMaybe<Boards_Board_Bool_Exp>;
};


export type Query_RootBoards_Board_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Boards_Board_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Boards_Board_Order_By>>;
  where?: InputMaybe<Boards_Board_Bool_Exp>;
};


export type Query_RootBoards_Board_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootComponents_ComponentArgs = {
  distinct_on?: InputMaybe<Array<Components_Component_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_Component_Order_By>>;
  where?: InputMaybe<Components_Component_Bool_Exp>;
};


export type Query_RootComponents_ComponentTypeArgs = {
  distinct_on?: InputMaybe<Array<Components_ComponentType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_ComponentType_Order_By>>;
  where?: InputMaybe<Components_ComponentType_Bool_Exp>;
};


export type Query_RootComponents_ComponentType_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Components_ComponentType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_ComponentType_Order_By>>;
  where?: InputMaybe<Components_ComponentType_Bool_Exp>;
};


export type Query_RootComponents_ComponentType_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootComponents_Component_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Components_Component_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_Component_Order_By>>;
  where?: InputMaybe<Components_Component_Bool_Exp>;
};


export type Query_RootComponents_Component_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootComponents_GeoObjectTypeArgs = {
  distinct_on?: InputMaybe<Array<Components_GeoObjectType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_GeoObjectType_Order_By>>;
  where?: InputMaybe<Components_GeoObjectType_Bool_Exp>;
};


export type Query_RootComponents_GeoObjectType_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Components_GeoObjectType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_GeoObjectType_Order_By>>;
  where?: InputMaybe<Components_GeoObjectType_Bool_Exp>;
};


export type Query_RootComponents_GeoObjectType_By_PkArgs = {
  label: Scalars['String']['input'];
};


export type Query_RootTestArgs = {
  distinct_on?: InputMaybe<Array<Test_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Test_Order_By>>;
  where?: InputMaybe<Test_Bool_Exp>;
};


export type Query_RootTest_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Test_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Test_Order_By>>;
  where?: InputMaybe<Test_Bool_Exp>;
};


export type Query_RootTest_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Query_RootUsers_UserArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Order_By>>;
  where?: InputMaybe<Users_User_Bool_Exp>;
};


export type Query_RootUsers_User_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Order_By>>;
  where?: InputMaybe<Users_User_Bool_Exp>;
};


export type Query_RootUsers_User_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootUsers_User_RevisitsArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Revisits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Revisits_Order_By>>;
  where?: InputMaybe<Users_User_Revisits_Bool_Exp>;
};


export type Query_RootUsers_User_Revisits_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Revisits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Revisits_Order_By>>;
  where?: InputMaybe<Users_User_Revisits_Bool_Exp>;
};


export type Query_RootUsers_User_Revisits_By_PkArgs = {
  user_id: Scalars['String']['input'];
};

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "boards.board" */
  boards_board: Array<Boards_Board>;
  /** fetch aggregated fields from the table: "boards.board" */
  boards_board_aggregate: Boards_Board_Aggregate;
  /** fetch data from the table: "boards.board" using primary key columns */
  boards_board_by_pk?: Maybe<Boards_Board>;
  /** fetch data from the table in a streaming manner: "boards.board" */
  boards_board_stream: Array<Boards_Board>;
  /** fetch data from the table: "components.component" */
  components_component: Array<Components_Component>;
  /** fetch data from the table: "components.componentType" */
  components_componentType: Array<Components_ComponentType>;
  /** fetch aggregated fields from the table: "components.componentType" */
  components_componentType_aggregate: Components_ComponentType_Aggregate;
  /** fetch data from the table: "components.componentType" using primary key columns */
  components_componentType_by_pk?: Maybe<Components_ComponentType>;
  /** fetch data from the table in a streaming manner: "components.componentType" */
  components_componentType_stream: Array<Components_ComponentType>;
  /** fetch aggregated fields from the table: "components.component" */
  components_component_aggregate: Components_Component_Aggregate;
  /** fetch data from the table: "components.component" using primary key columns */
  components_component_by_pk?: Maybe<Components_Component>;
  /** fetch data from the table in a streaming manner: "components.component" */
  components_component_stream: Array<Components_Component>;
  /** fetch data from the table: "components.geoObjectType" */
  components_geoObjectType: Array<Components_GeoObjectType>;
  /** fetch aggregated fields from the table: "components.geoObjectType" */
  components_geoObjectType_aggregate: Components_GeoObjectType_Aggregate;
  /** fetch data from the table: "components.geoObjectType" using primary key columns */
  components_geoObjectType_by_pk?: Maybe<Components_GeoObjectType>;
  /** fetch data from the table in a streaming manner: "components.geoObjectType" */
  components_geoObjectType_stream: Array<Components_GeoObjectType>;
  /** fetch data from the table: "test" */
  test: Array<Test>;
  /** fetch aggregated fields from the table: "test" */
  test_aggregate: Test_Aggregate;
  /** fetch data from the table: "test" using primary key columns */
  test_by_pk?: Maybe<Test>;
  /** fetch data from the table in a streaming manner: "test" */
  test_stream: Array<Test>;
  /** fetch data from the table: "users.user" */
  users_user: Array<Users_User>;
  /** fetch aggregated fields from the table: "users.user" */
  users_user_aggregate: Users_User_Aggregate;
  /** fetch data from the table: "users.user" using primary key columns */
  users_user_by_pk?: Maybe<Users_User>;
  /** fetch data from the table: "users.user_revisits" */
  users_user_revisits: Array<Users_User_Revisits>;
  /** fetch aggregated fields from the table: "users.user_revisits" */
  users_user_revisits_aggregate: Users_User_Revisits_Aggregate;
  /** fetch data from the table: "users.user_revisits" using primary key columns */
  users_user_revisits_by_pk?: Maybe<Users_User_Revisits>;
  /** fetch data from the table in a streaming manner: "users.user_revisits" */
  users_user_revisits_stream: Array<Users_User_Revisits>;
  /** fetch data from the table in a streaming manner: "users.user" */
  users_user_stream: Array<Users_User>;
};


export type Subscription_RootBoards_BoardArgs = {
  distinct_on?: InputMaybe<Array<Boards_Board_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Boards_Board_Order_By>>;
  where?: InputMaybe<Boards_Board_Bool_Exp>;
};


export type Subscription_RootBoards_Board_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Boards_Board_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Boards_Board_Order_By>>;
  where?: InputMaybe<Boards_Board_Bool_Exp>;
};


export type Subscription_RootBoards_Board_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootBoards_Board_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Boards_Board_Stream_Cursor_Input>>;
  where?: InputMaybe<Boards_Board_Bool_Exp>;
};


export type Subscription_RootComponents_ComponentArgs = {
  distinct_on?: InputMaybe<Array<Components_Component_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_Component_Order_By>>;
  where?: InputMaybe<Components_Component_Bool_Exp>;
};


export type Subscription_RootComponents_ComponentTypeArgs = {
  distinct_on?: InputMaybe<Array<Components_ComponentType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_ComponentType_Order_By>>;
  where?: InputMaybe<Components_ComponentType_Bool_Exp>;
};


export type Subscription_RootComponents_ComponentType_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Components_ComponentType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_ComponentType_Order_By>>;
  where?: InputMaybe<Components_ComponentType_Bool_Exp>;
};


export type Subscription_RootComponents_ComponentType_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootComponents_ComponentType_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Components_ComponentType_Stream_Cursor_Input>>;
  where?: InputMaybe<Components_ComponentType_Bool_Exp>;
};


export type Subscription_RootComponents_Component_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Components_Component_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_Component_Order_By>>;
  where?: InputMaybe<Components_Component_Bool_Exp>;
};


export type Subscription_RootComponents_Component_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootComponents_Component_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Components_Component_Stream_Cursor_Input>>;
  where?: InputMaybe<Components_Component_Bool_Exp>;
};


export type Subscription_RootComponents_GeoObjectTypeArgs = {
  distinct_on?: InputMaybe<Array<Components_GeoObjectType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_GeoObjectType_Order_By>>;
  where?: InputMaybe<Components_GeoObjectType_Bool_Exp>;
};


export type Subscription_RootComponents_GeoObjectType_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Components_GeoObjectType_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Components_GeoObjectType_Order_By>>;
  where?: InputMaybe<Components_GeoObjectType_Bool_Exp>;
};


export type Subscription_RootComponents_GeoObjectType_By_PkArgs = {
  label: Scalars['String']['input'];
};


export type Subscription_RootComponents_GeoObjectType_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Components_GeoObjectType_Stream_Cursor_Input>>;
  where?: InputMaybe<Components_GeoObjectType_Bool_Exp>;
};


export type Subscription_RootTestArgs = {
  distinct_on?: InputMaybe<Array<Test_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Test_Order_By>>;
  where?: InputMaybe<Test_Bool_Exp>;
};


export type Subscription_RootTest_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Test_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Test_Order_By>>;
  where?: InputMaybe<Test_Bool_Exp>;
};


export type Subscription_RootTest_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Subscription_RootTest_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Test_Stream_Cursor_Input>>;
  where?: InputMaybe<Test_Bool_Exp>;
};


export type Subscription_RootUsers_UserArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Order_By>>;
  where?: InputMaybe<Users_User_Bool_Exp>;
};


export type Subscription_RootUsers_User_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Order_By>>;
  where?: InputMaybe<Users_User_Bool_Exp>;
};


export type Subscription_RootUsers_User_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootUsers_User_RevisitsArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Revisits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Revisits_Order_By>>;
  where?: InputMaybe<Users_User_Revisits_Bool_Exp>;
};


export type Subscription_RootUsers_User_Revisits_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_User_Revisits_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_User_Revisits_Order_By>>;
  where?: InputMaybe<Users_User_Revisits_Bool_Exp>;
};


export type Subscription_RootUsers_User_Revisits_By_PkArgs = {
  user_id: Scalars['String']['input'];
};


export type Subscription_RootUsers_User_Revisits_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Users_User_Revisits_Stream_Cursor_Input>>;
  where?: InputMaybe<Users_User_Revisits_Bool_Exp>;
};


export type Subscription_RootUsers_User_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Users_User_Stream_Cursor_Input>>;
  where?: InputMaybe<Users_User_Bool_Exp>;
};

/** columns and relationships of "test" */
export type Test = {
  __typename?: 'test';
  id: Scalars['Int']['output'];
  temp?: Maybe<Scalars['String']['output']>;
};

/** aggregated selection of "test" */
export type Test_Aggregate = {
  __typename?: 'test_aggregate';
  aggregate?: Maybe<Test_Aggregate_Fields>;
  nodes: Array<Test>;
};

/** aggregate fields of "test" */
export type Test_Aggregate_Fields = {
  __typename?: 'test_aggregate_fields';
  avg?: Maybe<Test_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Test_Max_Fields>;
  min?: Maybe<Test_Min_Fields>;
  stddev?: Maybe<Test_Stddev_Fields>;
  stddev_pop?: Maybe<Test_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Test_Stddev_Samp_Fields>;
  sum?: Maybe<Test_Sum_Fields>;
  var_pop?: Maybe<Test_Var_Pop_Fields>;
  var_samp?: Maybe<Test_Var_Samp_Fields>;
  variance?: Maybe<Test_Variance_Fields>;
};


/** aggregate fields of "test" */
export type Test_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Test_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Test_Avg_Fields = {
  __typename?: 'test_avg_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "test". All fields are combined with a logical 'AND'. */
export type Test_Bool_Exp = {
  _and?: InputMaybe<Array<Test_Bool_Exp>>;
  _not?: InputMaybe<Test_Bool_Exp>;
  _or?: InputMaybe<Array<Test_Bool_Exp>>;
  id?: InputMaybe<Int_Comparison_Exp>;
  temp?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "test" */
export type Test_Constraint =
  /** unique or primary key constraint on columns "id" */
  | 'test_pkey';

/** input type for incrementing numeric columns in table "test" */
export type Test_Inc_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "test" */
export type Test_Insert_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
  temp?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Test_Max_Fields = {
  __typename?: 'test_max_fields';
  id?: Maybe<Scalars['Int']['output']>;
  temp?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Test_Min_Fields = {
  __typename?: 'test_min_fields';
  id?: Maybe<Scalars['Int']['output']>;
  temp?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "test" */
export type Test_Mutation_Response = {
  __typename?: 'test_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Test>;
};

/** on_conflict condition type for table "test" */
export type Test_On_Conflict = {
  constraint: Test_Constraint;
  update_columns?: Array<Test_Update_Column>;
  where?: InputMaybe<Test_Bool_Exp>;
};

/** Ordering options when selecting data from "test". */
export type Test_Order_By = {
  id?: InputMaybe<Order_By>;
  temp?: InputMaybe<Order_By>;
};

/** primary key columns input for table: test */
export type Test_Pk_Columns_Input = {
  id: Scalars['Int']['input'];
};

/** select columns of table "test" */
export type Test_Select_Column =
  /** column name */
  | 'id'
  /** column name */
  | 'temp';

/** input type for updating data in table "test" */
export type Test_Set_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
  temp?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Test_Stddev_Fields = {
  __typename?: 'test_stddev_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Test_Stddev_Pop_Fields = {
  __typename?: 'test_stddev_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Test_Stddev_Samp_Fields = {
  __typename?: 'test_stddev_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "test" */
export type Test_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Test_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Test_Stream_Cursor_Value_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
  temp?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate sum on columns */
export type Test_Sum_Fields = {
  __typename?: 'test_sum_fields';
  id?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "test" */
export type Test_Update_Column =
  /** column name */
  | 'id'
  /** column name */
  | 'temp';

export type Test_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Test_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Test_Set_Input>;
  /** filter the rows which have to be updated */
  where: Test_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Test_Var_Pop_Fields = {
  __typename?: 'test_var_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Test_Var_Samp_Fields = {
  __typename?: 'test_var_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Test_Variance_Fields = {
  __typename?: 'test_variance_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['timestamptz']['input']>;
  _gt?: InputMaybe<Scalars['timestamptz']['input']>;
  _gte?: InputMaybe<Scalars['timestamptz']['input']>;
  _in?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['timestamptz']['input']>;
  _lte?: InputMaybe<Scalars['timestamptz']['input']>;
  _neq?: InputMaybe<Scalars['timestamptz']['input']>;
  _nin?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
};

/** columns and relationships of "users.user" */
export type Users_User = {
  __typename?: 'users_user';
  createdAt: Scalars['timestamptz']['output'];
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  planId?: Maybe<Scalars['String']['output']>;
};

/** aggregated selection of "users.user" */
export type Users_User_Aggregate = {
  __typename?: 'users_user_aggregate';
  aggregate?: Maybe<Users_User_Aggregate_Fields>;
  nodes: Array<Users_User>;
};

/** aggregate fields of "users.user" */
export type Users_User_Aggregate_Fields = {
  __typename?: 'users_user_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Users_User_Max_Fields>;
  min?: Maybe<Users_User_Min_Fields>;
};


/** aggregate fields of "users.user" */
export type Users_User_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Users_User_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "users.user". All fields are combined with a logical 'AND'. */
export type Users_User_Bool_Exp = {
  _and?: InputMaybe<Array<Users_User_Bool_Exp>>;
  _not?: InputMaybe<Users_User_Bool_Exp>;
  _or?: InputMaybe<Array<Users_User_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  email?: InputMaybe<String_Comparison_Exp>;
  firstName?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  isActive?: InputMaybe<Boolean_Comparison_Exp>;
  lastName?: InputMaybe<String_Comparison_Exp>;
  nickname?: InputMaybe<String_Comparison_Exp>;
  planId?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "users.user" */
export type Users_User_Constraint =
  /** unique or primary key constraint on columns "id" */
  | 'user_pkey';

/** input type for inserting data into table "users.user" */
export type Users_User_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  nickname?: InputMaybe<Scalars['String']['input']>;
  planId?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Users_User_Max_Fields = {
  __typename?: 'users_user_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  lastName?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  planId?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Users_User_Min_Fields = {
  __typename?: 'users_user_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  lastName?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  planId?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "users.user" */
export type Users_User_Mutation_Response = {
  __typename?: 'users_user_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Users_User>;
};

/** on_conflict condition type for table "users.user" */
export type Users_User_On_Conflict = {
  constraint: Users_User_Constraint;
  update_columns?: Array<Users_User_Update_Column>;
  where?: InputMaybe<Users_User_Bool_Exp>;
};

/** Ordering options when selecting data from "users.user". */
export type Users_User_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  firstName?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isActive?: InputMaybe<Order_By>;
  lastName?: InputMaybe<Order_By>;
  nickname?: InputMaybe<Order_By>;
  planId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: users.user */
export type Users_User_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** columns and relationships of "users.user_revisits" */
export type Users_User_Revisits = {
  __typename?: 'users_user_revisits';
  count: Scalars['bigint']['output'];
  last_visit: Scalars['timestamptz']['output'];
  user_id: Scalars['String']['output'];
};

/** aggregated selection of "users.user_revisits" */
export type Users_User_Revisits_Aggregate = {
  __typename?: 'users_user_revisits_aggregate';
  aggregate?: Maybe<Users_User_Revisits_Aggregate_Fields>;
  nodes: Array<Users_User_Revisits>;
};

/** aggregate fields of "users.user_revisits" */
export type Users_User_Revisits_Aggregate_Fields = {
  __typename?: 'users_user_revisits_aggregate_fields';
  avg?: Maybe<Users_User_Revisits_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Users_User_Revisits_Max_Fields>;
  min?: Maybe<Users_User_Revisits_Min_Fields>;
  stddev?: Maybe<Users_User_Revisits_Stddev_Fields>;
  stddev_pop?: Maybe<Users_User_Revisits_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Users_User_Revisits_Stddev_Samp_Fields>;
  sum?: Maybe<Users_User_Revisits_Sum_Fields>;
  var_pop?: Maybe<Users_User_Revisits_Var_Pop_Fields>;
  var_samp?: Maybe<Users_User_Revisits_Var_Samp_Fields>;
  variance?: Maybe<Users_User_Revisits_Variance_Fields>;
};


/** aggregate fields of "users.user_revisits" */
export type Users_User_Revisits_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Users_User_Revisits_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Users_User_Revisits_Avg_Fields = {
  __typename?: 'users_user_revisits_avg_fields';
  count?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "users.user_revisits". All fields are combined with a logical 'AND'. */
export type Users_User_Revisits_Bool_Exp = {
  _and?: InputMaybe<Array<Users_User_Revisits_Bool_Exp>>;
  _not?: InputMaybe<Users_User_Revisits_Bool_Exp>;
  _or?: InputMaybe<Array<Users_User_Revisits_Bool_Exp>>;
  count?: InputMaybe<Bigint_Comparison_Exp>;
  last_visit?: InputMaybe<Timestamptz_Comparison_Exp>;
  user_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "users.user_revisits" */
export type Users_User_Revisits_Constraint =
  /** unique or primary key constraint on columns "user_id" */
  | 'user_revisits_pkey';

/** input type for incrementing numeric columns in table "users.user_revisits" */
export type Users_User_Revisits_Inc_Input = {
  count?: InputMaybe<Scalars['bigint']['input']>;
};

/** input type for inserting data into table "users.user_revisits" */
export type Users_User_Revisits_Insert_Input = {
  count?: InputMaybe<Scalars['bigint']['input']>;
  last_visit?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Users_User_Revisits_Max_Fields = {
  __typename?: 'users_user_revisits_max_fields';
  count?: Maybe<Scalars['bigint']['output']>;
  last_visit?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Users_User_Revisits_Min_Fields = {
  __typename?: 'users_user_revisits_min_fields';
  count?: Maybe<Scalars['bigint']['output']>;
  last_visit?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "users.user_revisits" */
export type Users_User_Revisits_Mutation_Response = {
  __typename?: 'users_user_revisits_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Users_User_Revisits>;
};

/** on_conflict condition type for table "users.user_revisits" */
export type Users_User_Revisits_On_Conflict = {
  constraint: Users_User_Revisits_Constraint;
  update_columns?: Array<Users_User_Revisits_Update_Column>;
  where?: InputMaybe<Users_User_Revisits_Bool_Exp>;
};

/** Ordering options when selecting data from "users.user_revisits". */
export type Users_User_Revisits_Order_By = {
  count?: InputMaybe<Order_By>;
  last_visit?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: users.user_revisits */
export type Users_User_Revisits_Pk_Columns_Input = {
  user_id: Scalars['String']['input'];
};

/** select columns of table "users.user_revisits" */
export type Users_User_Revisits_Select_Column =
  /** column name */
  | 'count'
  /** column name */
  | 'last_visit'
  /** column name */
  | 'user_id';

/** input type for updating data in table "users.user_revisits" */
export type Users_User_Revisits_Set_Input = {
  count?: InputMaybe<Scalars['bigint']['input']>;
  last_visit?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Users_User_Revisits_Stddev_Fields = {
  __typename?: 'users_user_revisits_stddev_fields';
  count?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Users_User_Revisits_Stddev_Pop_Fields = {
  __typename?: 'users_user_revisits_stddev_pop_fields';
  count?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Users_User_Revisits_Stddev_Samp_Fields = {
  __typename?: 'users_user_revisits_stddev_samp_fields';
  count?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "users_user_revisits" */
export type Users_User_Revisits_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Users_User_Revisits_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Users_User_Revisits_Stream_Cursor_Value_Input = {
  count?: InputMaybe<Scalars['bigint']['input']>;
  last_visit?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate sum on columns */
export type Users_User_Revisits_Sum_Fields = {
  __typename?: 'users_user_revisits_sum_fields';
  count?: Maybe<Scalars['bigint']['output']>;
};

/** update columns of table "users.user_revisits" */
export type Users_User_Revisits_Update_Column =
  /** column name */
  | 'count'
  /** column name */
  | 'last_visit'
  /** column name */
  | 'user_id';

export type Users_User_Revisits_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Users_User_Revisits_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Users_User_Revisits_Set_Input>;
  /** filter the rows which have to be updated */
  where: Users_User_Revisits_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Users_User_Revisits_Var_Pop_Fields = {
  __typename?: 'users_user_revisits_var_pop_fields';
  count?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Users_User_Revisits_Var_Samp_Fields = {
  __typename?: 'users_user_revisits_var_samp_fields';
  count?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Users_User_Revisits_Variance_Fields = {
  __typename?: 'users_user_revisits_variance_fields';
  count?: Maybe<Scalars['Float']['output']>;
};

/** select columns of table "users.user" */
export type Users_User_Select_Column =
  /** column name */
  | 'createdAt'
  /** column name */
  | 'email'
  /** column name */
  | 'firstName'
  /** column name */
  | 'id'
  /** column name */
  | 'isActive'
  /** column name */
  | 'lastName'
  /** column name */
  | 'nickname'
  /** column name */
  | 'planId';

/** input type for updating data in table "users.user" */
export type Users_User_Set_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  nickname?: InputMaybe<Scalars['String']['input']>;
  planId?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "users_user" */
export type Users_User_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Users_User_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Users_User_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  nickname?: InputMaybe<Scalars['String']['input']>;
  planId?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "users.user" */
export type Users_User_Update_Column =
  /** column name */
  | 'createdAt'
  /** column name */
  | 'email'
  /** column name */
  | 'firstName'
  /** column name */
  | 'id'
  /** column name */
  | 'isActive'
  /** column name */
  | 'lastName'
  /** column name */
  | 'nickname'
  /** column name */
  | 'planId';

export type Users_User_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Users_User_Set_Input>;
  /** filter the rows which have to be updated */
  where: Users_User_Bool_Exp;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['uuid']['input']>;
  _gt?: InputMaybe<Scalars['uuid']['input']>;
  _gte?: InputMaybe<Scalars['uuid']['input']>;
  _in?: InputMaybe<Array<Scalars['uuid']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['uuid']['input']>;
  _lte?: InputMaybe<Scalars['uuid']['input']>;
  _neq?: InputMaybe<Scalars['uuid']['input']>;
  _nin?: InputMaybe<Array<Scalars['uuid']['input']>>;
};

export type UpdateComponentInfoMutationVariables = Exact<{
  id?: InputMaybe<Scalars['uuid']['input']>;
  updateObj?: InputMaybe<Components_Component_Set_Input>;
}>;


export type UpdateComponentInfoMutation = { __typename?: 'mutation_root', update_components_component_by_pk?: { __typename?: 'components_component', id: string } | null };

export type InsertComponentMutationVariables = Exact<{
  object?: InputMaybe<Components_Component_Insert_Input>;
}>;


export type InsertComponentMutation = { __typename?: 'mutation_root', component?: { __typename?: 'components_component', id: string, componentType: string } | null };

export type UpdateBoardComponentsMutationVariables = Exact<{
  id?: InputMaybe<Scalars['uuid']['input']>;
  components?: InputMaybe<Scalars['jsonb']['input']>;
}>;


export type UpdateBoardComponentsMutation = { __typename?: 'mutation_root', update_boards_board_by_pk?: { __typename?: 'boards_board', id: string } | null };

export type DeleteComponentByIdMutationVariables = Exact<{
  id?: InputMaybe<Scalars['uuid']['input']>;
}>;


export type DeleteComponentByIdMutation = { __typename?: 'mutation_root', delete_components_component_by_pk?: { __typename?: 'components_component', boardId: string } | null };

export type InsertBulkComponentsMutationVariables = Exact<{
  objects?: Array<Components_Component_Insert_Input> | Components_Component_Insert_Input;
}>;


export type InsertBulkComponentsMutation = { __typename?: 'mutation_root', insert_components_component?: { __typename?: 'components_component_mutation_response', affected_rows: number, returning: Array<{ __typename?: 'components_component', boardId: string, componentType: string, id: string }> } | null };

export type InsertUserMutationVariables = Exact<{
  object?: Users_User_Insert_Input;
}>;


export type InsertUserMutation = { __typename?: 'mutation_root', user?: { __typename?: 'users_user', id: string, firstName?: string | null } | null };

export type CreateBoardMutationVariables = Exact<{
  object?: Boards_Board_Insert_Input;
}>;


export type CreateBoardMutation = { __typename?: 'mutation_root', board?: { __typename?: 'boards_board', id: string, createdBy?: string | null } | null };

export type DeleteComponentsMutationVariables = Exact<{
  _in?: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
}>;


export type DeleteComponentsMutation = { __typename?: 'mutation_root', deleteComponents?: { __typename?: 'components_component_mutation_response', affected_rows: number } | null };

export type UpdateBoardVisibilityMutationVariables = Exact<{
  id?: InputMaybe<Scalars['uuid']['input']>;
}>;


export type UpdateBoardVisibilityMutation = { __typename?: 'mutation_root', update_boards_board_by_pk?: { __typename?: 'boards_board', id: string, isPublic: boolean } | null };

export type UpdateUserRevisitCountMutationVariables = Exact<{
  userId: Scalars['String']['input'];
  lastVisit: Scalars['timestamptz']['input'];
}>;


export type UpdateUserRevisitCountMutation = { __typename?: 'mutation_root', update_users_user_revisits_by_pk?: { __typename?: 'users_user_revisits', count: number, user_id: string, last_visit: string } | null };

export type MyQueryQueryVariables = Exact<{
  id?: InputMaybe<Scalars['String']['input']>;
}>;


export type MyQueryQuery = { __typename?: 'query_root', users: Array<{ __typename?: 'users_user', firstName?: string | null, id: string }> };

export type GetComponentTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetComponentTypesQuery = { __typename?: 'query_root', componentTypes: Array<{ __typename?: 'components_componentType', label: string, metadata: unknown, logo?: string | null, width?: number | null, height?: number | null, fill?: string | null, textColor?: string | null }> };

export type GetComponentsForBoardQueryVariables = Exact<{
  boardId?: InputMaybe<Scalars['uuid']['input']>;
}>;


export type GetComponentsForBoardQuery = { __typename?: 'query_root', components: Array<{ __typename?: 'components_component', id: string, componentType: string, objectClass: string, children?: unknown | null, metadata?: unknown | null, x: any, x1: any, x2: any, y: any, y1: any, y2: any, fill: string, width: any, height: any, iconStroke?: string | null, stroke?: string | null, linewidth?: any | null, strokeType?: string | null, textColor?: string | null, opacity?: number | null, position: number, tailShapeId?: string | null, tailEdge?: string | null, headShapeId?: string | null, headEdge?: string | null, tailPortIndex: number, headPortIndex: number }> };

export type GetComponentInfoQueryQueryVariables = Exact<{
  id?: InputMaybe<Scalars['uuid']['input']>;
}>;


export type GetComponentInfoQueryQuery = { __typename?: 'query_root', component?: { __typename?: 'components_component', metadata?: unknown | null, width: any, height: any, fill: string, id: string, stroke?: string | null, linewidth?: any | null, strokeType?: string | null, x: any, y: any, x1: any, y1: any, x2: any, y2: any, componentType: string, children?: unknown | null, updatedBy?: string | null, iconStroke?: string | null, textColor?: string | null, opacity?: number | null } | null };

export type GetBoardComponentsQueryVariables = Exact<{
  boardId?: Scalars['uuid']['input'];
}>;


export type GetBoardComponentsQuery = { __typename?: 'query_root', components: Array<{ __typename?: 'components_component', id: string, componentType: string }> };

export type GetBoardComponentCountQueryVariables = Exact<{
  boardId?: Scalars['uuid']['input'];
}>;


export type GetBoardComponentCountQuery = { __typename?: 'query_root', components: { __typename?: 'components_component_aggregate', aggregate?: { __typename?: 'components_component_aggregate_fields', count: number } | null } };

export type UserDetailsSubscriptionSubscriptionVariables = Exact<{
  id?: InputMaybe<Scalars['String']['input']>;
}>;


export type UserDetailsSubscriptionSubscription = { __typename?: 'subscription_root', users: Array<{ __typename?: 'users_user', firstName?: string | null, id: string }> };

export type GetBoardComponentsSubscriptionSubscriptionVariables = Exact<{
  boardId?: Scalars['uuid']['input'];
}>;


export type GetBoardComponentsSubscriptionSubscription = { __typename?: 'subscription_root', components: Array<{ __typename?: 'components_component', id: string, componentType: string }> };

export type GetComponentInfoSubscriptionSubscriptionVariables = Exact<{
  id?: InputMaybe<Scalars['uuid']['input']>;
}>;


export type GetComponentInfoSubscriptionSubscription = { __typename?: 'subscription_root', component?: { __typename?: 'components_component', metadata?: unknown | null, width: any, height: any, fill: string, id: string, stroke?: string | null, linewidth?: any | null, strokeType?: string | null, x: any, y: any, x1: any, y1: any, x2: any, y2: any, componentType: string, children?: unknown | null, updatedBy?: string | null, iconStroke?: string | null, textColor?: string | null } | null };

export type GetComponentsForBoardSubscriptionSubscriptionVariables = Exact<{
  boardId?: InputMaybe<Scalars['uuid']['input']>;
}>;


export type GetComponentsForBoardSubscriptionSubscription = { __typename?: 'subscription_root', components: Array<{ __typename?: 'components_component', id: string, componentType: string, objectClass: string, children?: unknown | null, metadata?: unknown | null, x: any, x1: any, x2: any, y: any, y1: any, y2: any, fill: string, width: any, height: any, iconStroke?: string | null, stroke?: string | null, linewidth?: any | null, strokeType?: string | null }> };


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