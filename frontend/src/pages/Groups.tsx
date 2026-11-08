import {
  useEffect,
  useState,
} from 'react'

import type {
  Group,
  GroupDetail,
} from '../types/group'

import {
  createGroup,
  deleteGroup,
  getGroup,
  getGroups,
  leaveGroup,
  updateGroup,
  addGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
} from '../services/groups'

import {
  searchUsers,
  type UserSearchResult,
} from '../services/users'

import { useAuth } from '../hooks/useAuth'
import { t } from '../lib/i18n'

export function Groups() {
  const { user } = useAuth()

  const [groups, setGroups] =
    useState<Group[]>([])

  const [selectedGroup, setSelectedGroup] =
    useState<GroupDetail | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [showCreate, setShowCreate] =
    useState(false)

  const [name, setName] =
    useState('')

  const [description, setDescription] =
    useState('')

  const [creating, setCreating] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [memberSearch, setMemberSearch] =
    useState('')

  const [userResults, setUserResults] =
    useState<UserSearchResult[]>([])

  const [searchingUsers, setSearchingUsers] =
    useState(false)

  const [addingMember, setAddingMember] =
    useState(false)

  const [newMemberRole, setNewMemberRole] =
    useState<'manager' | 'viewer'>('viewer')

  const [updatingMemberRole, setUpdatingMemberRole] =
    useState<number | null>(null)

  async function loadGroups() {
    try {
      setLoading(true)
      setError(null)

      const data = await getGroups()

      setGroups(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les groupes.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function openGroup(
    groupId: number,
  ) {
    try {
      setError(null)

      const group =
        await getGroup(groupId)

      setSelectedGroup(group)
      setMemberSearch('')
      setUserResults([])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger le groupe.',
      )
    }
  }

  async function handleCreate() {
    const cleanName = name.trim()

    if (!cleanName) {
      setError(
        'Le nom du groupe est obligatoire.',
      )
      return
    }

    try {
      setCreating(true)
      setError(null)

      const group = await createGroup(
        cleanName,
        description,
      )

      setGroups((current) => [
        group,
        ...current,
      ])

      setName('')
      setDescription('')
      setShowCreate(false)

      await openGroup(group.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de créer le groupe.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleSave() {
    if (!selectedGroup) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const updated =
        await updateGroup(
          selectedGroup.id,
          {
            name: selectedGroup.name,
            description:
              selectedGroup.description,
          },
        )

      setGroups((current) =>
        current.map((group) =>
          group.id === updated.id
            ? updated
            : group,
        ),
      )

      await openGroup(updated.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de modifier le groupe.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedGroup) {
      return
    }

    const confirmed =
      window.confirm(
        `Supprimer le groupe "${selectedGroup.name}" ?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await deleteGroup(
        selectedGroup.id,
      )

      setSelectedGroup(null)

      await loadGroups()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer le groupe.',
      )
    }
  }

  async function handleLeave() {
    if (!selectedGroup) {
      return
    }

    const confirmed =
      window.confirm(
        `Quitter le groupe "${selectedGroup.name}" ?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await leaveGroup(
        selectedGroup.id,
      )

      setSelectedGroup(null)

      await loadGroups()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de quitter le groupe.',
      )
    }
  }

  async function handleSearchUsers(
    value: string,
  ) {
    setMemberSearch(value)

    if (!value.trim()) {
      setUserResults([])
      return
    }

    try {
      setSearchingUsers(true)
      setError(null)

      const results =
        await searchUsers(value)

      setUserResults(results)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de rechercher les utilisateurs.',
      )
    } finally {
      setSearchingUsers(false)
    }
  }

  async function handleAddMember(
    selectedUser: UserSearchResult,
  ) {
    if (!selectedGroup) {
      return
    }

    try {
      setAddingMember(true)
      setError(null)

      await addGroupMember(
        selectedGroup.id,
        selectedUser.id,
        newMemberRole,
      )

      setMemberSearch('')
      setUserResults([])

      await openGroup(
        selectedGroup.id,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’ajouter le membre.',
      )
    } finally {
      setAddingMember(false)
    }
  }

  async function handleChangeMemberRole(
    memberId: number,
    role: 'manager' | 'viewer',
  ) {
    if (!selectedGroup) {
      return
    }

    try {
      setUpdatingMemberRole(memberId)
      setError(null)

      await updateGroupMemberRole(
        selectedGroup.id,
        memberId,
        role,
      )

      await openGroup(selectedGroup.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de modifier le rôle.',
      )
    } finally {
      setUpdatingMemberRole(null)
    }
  }

  async function handleRemoveMember(
    memberId: number,
  ) {
    if (!selectedGroup) {
      return
    }

    const member =
      selectedGroup.members.find(
        (item) => item.id === memberId,
      )

    if (!member) {
      return
    }

    const confirmed =
      window.confirm(
        `Retirer ${member.display_name} du groupe ?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await removeGroupMember(
        selectedGroup.id,
        memberId,
      )

      await openGroup(
        selectedGroup.id,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de retirer le membre.',
      )
    }
  }

  useEffect(() => {
    void loadGroups()
  }, [])

  if (loading) {
    return (
      <section className="page-section groups-page">
        <div className="glass groups-loading">
          Chargement des groupes...
        </div>
      </section>
    )
  }

  const canManageSelectedGroup =
    selectedGroup?.members.some(
      (member) =>
        member.id === user?.id &&
        (member.role === 'owner' ||
          member.role === 'manager'),
    ) ?? false

  return (
    <section className="page-section groups-page">
      <div className="page-header">
        <div>
          <span className="dashboard-eyebrow">
            MEDIAHUB
          </span>

          <h1>{t('Groupes', 'Groups')}</h1>

          <p className="text-secondary">
            {t('Partage tes photos et vidéos avec les personnes de tes groupes.', 'Share your photos and videos with people in your groups.')}
          </p>
        </div>

        <button
          type="button"
          className="glass-button primary"
          onClick={() =>
            setShowCreate(true)
          }
        >
          + {t('Nouveau groupe', 'New group')}
        </button>
      </div>

      {error && (
        <div className="glass groups-error">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="glass groups-empty">
          <div className="groups-empty-icon">
            👥
          </div>

          <h2>{t('Aucun groupe', 'No groups')}</h2>

          <p className="text-secondary">
            {t('Crée ton premier groupe pour commencer à partager tes médias.', 'Create your first group to start sharing media.')}
          </p>

          <button
            type="button"
            className="glass-button primary"
            onClick={() =>
              setShowCreate(true)
            }
          >
            {t('Créer un groupe', 'Create group')}
          </button>
        </div>
      ) : (
        <div className="groups-layout">
          <div className="groups-list">
            {groups.map((group) => (
              <button
                type="button"
                key={group.id}
                className={`glass group-card ${
                  selectedGroup?.id === group.id
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  void openGroup(group.id)
                }
              >
                <div className="group-card-icon">
                  👥
                </div>

                <div className="group-card-content">
                  <strong>
                    {group.name}
                  </strong>

                  {group.description && (
                    <span>
                      {group.description}
                    </span>
                  )}

                  <small>
                    {group.member_count}{' '}
                    {t('membre', 'member')}
                    {group.member_count !== 1
                      ? 's'
                      : ''}
                  </small>
                </div>
              </button>
            ))}
          </div>

          {selectedGroup && (
            <div className="glass group-detail">
              <div className="group-detail-header">
                <div>
                  <span className="dashboard-eyebrow">
                    {t('GROUPE', 'GROUP')}
                  </span>

                  <input
                    className="glass-input group-name-input"
                    value={
                      selectedGroup.name
                    }
                    onChange={(event) =>
                      setSelectedGroup({
                        ...selectedGroup,
                        name: event.target.value,
                      })
                    }
                    disabled={
                      !canManageSelectedGroup
                    }
                  />
                </div>
              </div>

              <textarea
                className="glass-input group-description-input"
                value={
                  selectedGroup.description ??
                  ''
                }
                placeholder={t('Description du groupe…', 'Group description…')}
                onChange={(event) =>
                  setSelectedGroup({
                    ...selectedGroup,
                    description:
                      event.target.value,
                  })
                }
                disabled={
                  !canManageSelectedGroup
                }
              />

              <div className="group-members">
                <div className="group-members-header">
                  <h3>
                    {t('Membres', 'Members')} (
                    {
                      selectedGroup.members
                        .length
                    }
                    )
                  </h3>

                  {selectedGroup.owner_id ===
                    user?.id && (
                    <span className="group-owner-badge">
                      {t('Propriétaire', 'Owner')}
                    </span>
                  )}
                </div>

                {selectedGroup.owner_id ===
                  user?.id && (
                  <div className="group-add-member">
                    <label>
                      {t('Rôle du nouveau membre', 'New member role')}
                      <select
                        className="glass-input"
                        value={newMemberRole}
                        onChange={(event) =>
                          setNewMemberRole(
                            event.target.value as
                              | 'manager'
                              | 'viewer',
                          )
                        }
                        disabled={addingMember}
                      >
                        <option value="viewer">
                          {t('Viewer — lecture seule', 'Viewer — read only')}
                        </option>
                        <option value="manager">
                          {t('Manager — organiser le groupe', 'Manager — organize the group')}
                        </option>
                      </select>
                    </label>

                    <input
                      className="glass-input"
                      placeholder={t('Rechercher un utilisateur…', 'Search for a user…')}
                      value={memberSearch}
                      onChange={(event) =>
                        void handleSearchUsers(
                          event.target.value,
                        )
                      }
                      disabled={
                        addingMember
                      }
                    />

                    {searchingUsers && (
                      <div className="text-secondary">
                        {t('Recherche…', 'Searching…')}
                      </div>
                    )}

                    {userResults.length >
                      0 && (
                      <div className="group-user-results">
                        {userResults.map(
                          (result) => (
                            <button
                              type="button"
                              key={result.id}
                              className="group-user-result"
                              disabled={
                                addingMember
                              }
                              onClick={() =>
                                void handleAddMember(
                                  result,
                                )
                              }
                            >
                              <div className="group-member-avatar">
                                {result.display_name
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <strong>
                                  {
                                    result.display_name
                                  }
                                </strong>

                                <span>
                                  @
                                  {
                                    result.username
                                  }
                                </span>
                              </div>

                              <span>
                                +
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    )}

                    {memberSearch.trim() &&
                      !searchingUsers &&
                      userResults.length ===
                        0 && (
                        <div className="text-secondary">
                          {t('Aucun utilisateur trouvé.', 'No users found.')}
                        </div>
                      )}
                  </div>
                )}

                {selectedGroup.members.map(
                  (member) => (
                    <div
                      className="group-member"
                      key={member.id}
                    >
                      <div className="group-member-avatar">
                        {member.display_name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {
                            member.display_name
                          }
                        </strong>

                        <span>
                          @{member.username}
                        </span>
                      </div>

                      {member.role ===
                        'owner' && (
                        <span className="group-owner-badge">
                          {t('Propriétaire', 'Owner')}
                        </span>
                      )}

                      {member.role !== 'owner' && (
                        <span className="text-secondary">
                          {member.role === 'manager'
                            ? 'Manager'
                            : 'Viewer'}
                        </span>
                      )}

                      {selectedGroup.owner_id ===
                        user?.id &&
                        member.id !==
                          selectedGroup.owner_id && (
                          <>
                          <select
                            className="glass-input"
                            aria-label={`Rôle de ${member.display_name}`}
                            value={member.role}
                            disabled={
                              updatingMemberRole === member.id
                            }
                            onChange={(event) =>
                              void handleChangeMemberRole(
                                member.id,
                                event.target.value as
                                  | 'manager'
                                  | 'viewer',
                              )
                            }
                          >
                            <option value="viewer">
                              Viewer
                            </option>
                            <option value="manager">
                              Manager
                            </option>
                          </select>
                          <button
                            type="button"
                            className="glass-button danger"
                            onClick={() =>
                              void handleRemoveMember(
                                member.id,
                              )
                            }
                          >
                            {t('Retirer', 'Remove')}
                          </button>
                          </>
                        )}
                    </div>
                  ),
                )}
              </div>

              <div className="group-actions">
                {canManageSelectedGroup ? (
                  <>
                    <button
                      type="button"
                      className="glass-button primary"
                      disabled={saving}
                      onClick={() =>
                        void handleSave()
                      }
                    >
                      {saving
                        ? t('Enregistrement…', 'Saving…')
                        : t('Enregistrer', 'Save')}
                    </button>

                    {selectedGroup.owner_id ===
                      user?.id && (
                      <button
                        type="button"
                        className="glass-button danger"
                        onClick={() =>
                          void handleDelete()
                        }
                      >
                        {t('Supprimer', 'Delete')}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="glass-button danger"
                    onClick={() =>
                      void handleLeave()
                    }
                  >
                    {t('Quitter', 'Leave')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div
          className="upload-placeholder-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() =>
            setShowCreate(false)
          }
        >
          <div
            className="upload-placeholder glass"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="upload-placeholder-icon">
              👥
            </div>

            <h2>{t('Nouveau groupe', 'New group')}</h2>

            <input
              className="glass-input"
              placeholder={t('Nom du groupe', 'Group name')}
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
            />

            <textarea
              className="glass-input"
              placeholder={t('Description (facultative)', 'Description (optional)')}
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
            />

            <div className="group-actions">
              <button
                type="button"
                className="glass-button"
                onClick={() =>
                  setShowCreate(false)
                }
              >
                {t('Annuler', 'Cancel')}
              </button>

              <button
                type="button"
                className="glass-button primary"
                disabled={creating}
                onClick={() =>
                  void handleCreate()
                }
              >
                {creating
                  ? t('Création…', 'Creating…')
                  : t('Créer le groupe', 'Create group')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
