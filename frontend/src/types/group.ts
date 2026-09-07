export type Group = {
  id: number
  name: string
  description: string | null
  owner_id: number
  created_at: string
  member_count: number
}

export type GroupMember = {
  id: number
  username: string
  display_name: string
  role: string
  joined_at: string
}

export type GroupDetail = Group & {
  members: GroupMember[]
}
