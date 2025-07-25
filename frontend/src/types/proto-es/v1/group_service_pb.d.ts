// @generated by protoc-gen-es v2.5.2
// @generated from file v1/group_service.proto (package bytebase.v1, syntax proto3)
/* eslint-disable */

import type { GenEnum, GenFile, GenMessage, GenService } from "@bufbuild/protobuf/codegenv2";
import type { Message } from "@bufbuild/protobuf";
import type { EmptySchema, FieldMask } from "@bufbuild/protobuf/wkt";

/**
 * Describes the file v1/group_service.proto.
 */
export declare const file_v1_group_service: GenFile;

/**
 * @generated from message bytebase.v1.GetGroupRequest
 */
export declare type GetGroupRequest = Message<"bytebase.v1.GetGroupRequest"> & {
  /**
   * The name of the group to retrieve.
   * Format: groups/{email}
   *
   * @generated from field: string name = 1;
   */
  name: string;
};

/**
 * Describes the message bytebase.v1.GetGroupRequest.
 * Use `create(GetGroupRequestSchema)` to create a new message.
 */
export declare const GetGroupRequestSchema: GenMessage<GetGroupRequest>;

/**
 * @generated from message bytebase.v1.ListGroupsRequest
 */
export declare type ListGroupsRequest = Message<"bytebase.v1.ListGroupsRequest"> & {
  /**
   * Not used.
   * The maximum number of groups to return. The service may return fewer than
   * this value.
   * If unspecified, at most 10 groups will be returned.
   * The maximum value is 1000; values above 1000 will be coerced to 1000.
   *
   * @generated from field: int32 page_size = 1;
   */
  pageSize: number;

  /**
   * Not used.
   * A page token, received from a previous `ListGroups` call.
   * Provide this to retrieve the subsequent page.
   *
   * When paginating, all other parameters provided to `ListGroups` must match
   * the call that provided the page token.
   *
   * @generated from field: string page_token = 2;
   */
  pageToken: string;
};

/**
 * Describes the message bytebase.v1.ListGroupsRequest.
 * Use `create(ListGroupsRequestSchema)` to create a new message.
 */
export declare const ListGroupsRequestSchema: GenMessage<ListGroupsRequest>;

/**
 * @generated from message bytebase.v1.ListGroupsResponse
 */
export declare type ListGroupsResponse = Message<"bytebase.v1.ListGroupsResponse"> & {
  /**
   * The groups from the specified request.
   *
   * @generated from field: repeated bytebase.v1.Group groups = 1;
   */
  groups: Group[];

  /**
   * A token, which can be sent as `page_token` to retrieve the next page.
   * If this field is omitted, there are no subsequent pages.
   *
   * @generated from field: string next_page_token = 2;
   */
  nextPageToken: string;
};

/**
 * Describes the message bytebase.v1.ListGroupsResponse.
 * Use `create(ListGroupsResponseSchema)` to create a new message.
 */
export declare const ListGroupsResponseSchema: GenMessage<ListGroupsResponse>;

/**
 * @generated from message bytebase.v1.CreateGroupRequest
 */
export declare type CreateGroupRequest = Message<"bytebase.v1.CreateGroupRequest"> & {
  /**
   * The group to create.
   *
   * @generated from field: bytebase.v1.Group group = 1;
   */
  group?: Group;

  /**
   * The email to use for the group, which will become the final component
   * of the group's resource name.
   *
   * @generated from field: string group_email = 2;
   */
  groupEmail: string;
};

/**
 * Describes the message bytebase.v1.CreateGroupRequest.
 * Use `create(CreateGroupRequestSchema)` to create a new message.
 */
export declare const CreateGroupRequestSchema: GenMessage<CreateGroupRequest>;

/**
 * @generated from message bytebase.v1.UpdateGroupRequest
 */
export declare type UpdateGroupRequest = Message<"bytebase.v1.UpdateGroupRequest"> & {
  /**
   * The group to update.
   *
   * The group's `name` field is used to identify the group to update.
   * Format: groups/{email}
   *
   * @generated from field: bytebase.v1.Group group = 1;
   */
  group?: Group;

  /**
   * The list of fields to update.
   *
   * @generated from field: google.protobuf.FieldMask update_mask = 2;
   */
  updateMask?: FieldMask;

  /**
   * If set to true, and the group is not found, a new group will be created.
   * In this situation, `update_mask` is ignored.
   *
   * @generated from field: bool allow_missing = 3;
   */
  allowMissing: boolean;
};

/**
 * Describes the message bytebase.v1.UpdateGroupRequest.
 * Use `create(UpdateGroupRequestSchema)` to create a new message.
 */
export declare const UpdateGroupRequestSchema: GenMessage<UpdateGroupRequest>;

/**
 * @generated from message bytebase.v1.DeleteGroupRequest
 */
export declare type DeleteGroupRequest = Message<"bytebase.v1.DeleteGroupRequest"> & {
  /**
   * The name of the group to delete.
   * Format: groups/{email}
   *
   * @generated from field: string name = 1;
   */
  name: string;
};

/**
 * Describes the message bytebase.v1.DeleteGroupRequest.
 * Use `create(DeleteGroupRequestSchema)` to create a new message.
 */
export declare const DeleteGroupRequestSchema: GenMessage<DeleteGroupRequest>;

/**
 * @generated from message bytebase.v1.GroupMember
 */
export declare type GroupMember = Message<"bytebase.v1.GroupMember"> & {
  /**
   * Member is the principal who belong to this group.
   *
   * Format: users/hello@world.com
   *
   * @generated from field: string member = 1;
   */
  member: string;

  /**
   * @generated from field: bytebase.v1.GroupMember.Role role = 2;
   */
  role: GroupMember_Role;
};

/**
 * Describes the message bytebase.v1.GroupMember.
 * Use `create(GroupMemberSchema)` to create a new message.
 */
export declare const GroupMemberSchema: GenMessage<GroupMember>;

/**
 * @generated from enum bytebase.v1.GroupMember.Role
 */
export enum GroupMember_Role {
  /**
   * @generated from enum value: ROLE_UNSPECIFIED = 0;
   */
  ROLE_UNSPECIFIED = 0,

  /**
   * @generated from enum value: OWNER = 1;
   */
  OWNER = 1,

  /**
   * @generated from enum value: MEMBER = 2;
   */
  MEMBER = 2,
}

/**
 * Describes the enum bytebase.v1.GroupMember.Role.
 */
export declare const GroupMember_RoleSchema: GenEnum<GroupMember_Role>;

/**
 * @generated from message bytebase.v1.Group
 */
export declare type Group = Message<"bytebase.v1.Group"> & {
  /**
   * The name of the group to retrieve.
   * Format: groups/{group}, group is an email.
   *
   * @generated from field: string name = 1;
   */
  name: string;

  /**
   * @generated from field: string title = 2;
   */
  title: string;

  /**
   * @generated from field: string description = 3;
   */
  description: string;

  /**
   * @generated from field: repeated bytebase.v1.GroupMember members = 5;
   */
  members: GroupMember[];

  /**
   * source means where the group comes from. For now we support Entra ID SCIM sync, so the source could be Entra ID.
   *
   * @generated from field: string source = 7;
   */
  source: string;
};

/**
 * Describes the message bytebase.v1.Group.
 * Use `create(GroupSchema)` to create a new message.
 */
export declare const GroupSchema: GenMessage<Group>;

/**
 * @generated from service bytebase.v1.GroupService
 */
export declare const GroupService: GenService<{
  /**
   * Permissions required: bb.groups.get
   *
   * @generated from rpc bytebase.v1.GroupService.GetGroup
   */
  getGroup: {
    methodKind: "unary";
    input: typeof GetGroupRequestSchema;
    output: typeof GroupSchema;
  },
  /**
   * Permissions required: bb.groups.list
   *
   * @generated from rpc bytebase.v1.GroupService.ListGroups
   */
  listGroups: {
    methodKind: "unary";
    input: typeof ListGroupsRequestSchema;
    output: typeof ListGroupsResponseSchema;
  },
  /**
   * Permissions required: bb.groups.create
   *
   * @generated from rpc bytebase.v1.GroupService.CreateGroup
   */
  createGroup: {
    methodKind: "unary";
    input: typeof CreateGroupRequestSchema;
    output: typeof GroupSchema;
  },
  /**
   * UpdateGroup updates the group.
   * Users with "bb.groups.update" permission on the workspace or the group owner can access this method.
   * Permissions required: bb.groups.update
   *
   * @generated from rpc bytebase.v1.GroupService.UpdateGroup
   */
  updateGroup: {
    methodKind: "unary";
    input: typeof UpdateGroupRequestSchema;
    output: typeof GroupSchema;
  },
  /**
   * Permissions required: bb.groups.delete
   *
   * @generated from rpc bytebase.v1.GroupService.DeleteGroup
   */
  deleteGroup: {
    methodKind: "unary";
    input: typeof DeleteGroupRequestSchema;
    output: typeof EmptySchema;
  },
}>;

