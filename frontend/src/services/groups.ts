import type {
  Group,
  GroupDetail,
  GroupMember,
  GroupRole,
} from '../types/group'

import { apiFetch } from './api'

export async function getGroups(): Promise<Group[]> {
  return apiFetch<Group[]>('/groups')
}

export async function getGroup(
  groupId: number,
): Promise<GroupDetail> {
  return apiFetch<GroupDetail>(
    `/groups/${groupId}`,
  )
}

export async function createGroup(
  name: string,
  description?: string,
): Promise<Group> {
  return apiFetch<Group>(
    '/groups',
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        description:
          description?.trim() || null,
      }),
    },
  )
}

export async function updateGroup(
  groupId: number,
  data: {
    name?: string
    description?: string | null
  },
): Promise<Group> {
  return apiFetch<Group>(
    `/groups/${groupId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  )
}

export async function deleteGroup(
  groupId: number,
): Promise<void> {
  await apiFetch<void>(
    `/groups/${groupId}`,
    {
      method: 'DELETE',
    },
  )
}

export async function getGroupMembers(
  groupId: number,
): Promise<GroupMember[]> {
  return apiFetch<GroupMember[]>(
    `/groups/${groupId}/members`,
  )
}

export async function addGroupMember(
  groupId: number,
  userId: number,
  role: Exclude<GroupRole, 'owner'> = 'viewer',
): Promise<GroupMember> {
  return apiFetch<GroupMember>(
    `/groups/${groupId}/members`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        role,
      }),
    },
  )
}

export async function updateGroupMemberRole(
  groupId: number,
  userId: number,
  role: Exclude<GroupRole, 'owner'>,
): Promise<GroupMember> {
  return apiFetch<GroupMember>(
    `/groups/${groupId}/members/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  )
}

export async function removeGroupMember(
  groupId: number,
  userId: number,
): Promise<void> {
  await apiFetch<void>(
    `/groups/${groupId}/members/${userId}`,
    {
      method: 'DELETE',
    },
  )
}

export async function leaveGroup(
  groupId: number,
): Promise<void> {
  await apiFetch<void>(
    `/groups/${groupId}/leave`,
    {
      method: 'DELETE',
    },
  )
}
