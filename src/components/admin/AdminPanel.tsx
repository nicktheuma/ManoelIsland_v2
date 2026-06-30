import { useState } from 'react'
import { getAdminPassword } from '../../config/defaults'
import { useAdmin } from '../../context/AdminProvider'
import { useSandbox } from '../../context/SandboxProvider'
import type { PropDefinition } from '../../types/propLibrary'
import type { PropRateLimit } from '../../types/sandbox'
import { getPropRateLimit } from '../../utils/rateLimitSettings'
import { VisibilityToggle } from './VisibilityToggle'

function AdminSection({
  title,
  visible,
  onToggleVisibility,
  children,
}: {
  title: string
  visible: boolean
  onToggleVisibility: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        <VisibilityToggle visible={visible} onToggle={onToggleVisibility} />
      </div>
      {children}
    </section>
  )
}

export function AdminPanel() {
  const { isAdmin, isPanelOpen, togglePanel, logout, zoneDrawingMode, setZoneDrawingMode, draftZonePoints, clearDraftZone, finishDraftZone, adminProfile, isSupabaseAdmin } = useAdmin()
  const { settings, setSettings, patchSettings, placedProps, canUndo, canRedo, undo, redo, syncRateLimitSettings, isAdminSession, isMultiplayer, wipeMapClutter, setLayoutLocked, isLayoutLocked } = useSandbox()
  const [zoneName, setZoneName] = useState('Allowed Zone')
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null)
  const [isSavingRateLimits, setIsSavingRateLimits] = useState(false)
  const [mapOpMessage, setMapOpMessage] = useState<string | null>(null)
  const [isMapOpRunning, setIsMapOpRunning] = useState(false)

  if (!isAdmin || !isPanelOpen) return null

  const updateRules = (patch: Partial<typeof settings.placementRules>) => {
    patchSettings({
      placementRules: { ...settings.placementRules, ...patch },
    })
  }

  const updateVisibility = (patch: Partial<typeof settings.userVisibility>) => {
    patchSettings({
      userVisibility: { ...settings.userVisibility, ...patch },
    })
  }

  const toggleCategoryVisibility = (categoryId: string) => {
    setSettings({
      ...settings,
      categories: settings.categories.map((category) =>
        category.id === categoryId
          ? { ...category, userVisible: !category.userVisible }
          : category,
      ),
    })
  }

  const togglePropPlaceable = (propId: string) => {
    setSettings({
      ...settings,
      propLibrary: settings.propLibrary.map((prop) =>
        prop.id === propId ? { ...prop, userPlaceable: !prop.userPlaceable } : prop,
      ),
    })
  }

  const updatePropPlacement = (
    propId: string,
    patch: Partial<PropDefinition['placement']>,
  ) => {
    setSettings({
      ...settings,
      propLibrary: settings.propLibrary.map((prop) =>
        prop.id === propId
          ? { ...prop, placement: { ...prop.placement, ...patch } }
          : prop,
      ),
    })
  }

  const updatePropVariation = (
    propId: string,
    patch: Partial<PropDefinition['variation']>,
  ) => {
    setSettings({
      ...settings,
      propLibrary: settings.propLibrary.map((prop) =>
        prop.id === propId
          ? { ...prop, variation: { ...prop.variation, ...patch } }
          : prop,
      ),
    })
  }

  const togglePropZone = (propId: string, zoneId: string) => {
    const prop = settings.propLibrary.find((item) => item.id === propId)
    if (!prop) return
    const allowed = new Set(prop.placement.allowedZoneIds)
    if (allowed.has(zoneId)) allowed.delete(zoneId)
    else allowed.add(zoneId)
    updatePropPlacement(propId, { allowedZoneIds: [...allowed] })
  }

  const updateRateLimit = (patch: Partial<typeof settings.rateLimit>) => {
    patchSettings({
      rateLimit: { ...settings.rateLimit, ...patch },
    })
  }

  const updatePropRateLimit = (propId: string, patch: Partial<PropRateLimit>) => {
    const current = settings.rateLimit.perProp[propId] ?? {
      enabled: true,
      maxPlacements: settings.rateLimit.maxPlacements,
      windowMinutes: settings.rateLimit.windowMinutes,
    }
    updateRateLimit({
      perProp: {
        ...settings.rateLimit.perProp,
        [propId]: { ...current, ...patch },
      },
    })
  }

  const handleSaveRateLimits = async () => {
    if (!isMultiplayer) {
      setRateLimitMessage('Rate limits saved locally. Connect Supabase to enforce on the server.')
      return
    }

    setIsSavingRateLimits(true)
    setRateLimitMessage(null)
    const result = await syncRateLimitSettings(getAdminPassword())
    setIsSavingRateLimits(false)
    setRateLimitMessage(result.ok ? 'Rate limits applied to server.' : result.message)
  }

  const handleWipeMap = async () => {
    if (!window.confirm('Remove all props placed by non-admin users? This cannot be undone.')) return

    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const result = await wipeMapClutter()
    setIsMapOpRunning(false)
    setMapOpMessage(result.ok ? `Removed ${result.deletedCount} props.` : result.message)
  }

  const handleLockLayout = async () => {
    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const result = await setLayoutLocked(true)
    setIsMapOpRunning(false)
    setMapOpMessage(result.ok ? 'Layout locked. New placements disabled for visitors.' : result.message)
  }

  const handleUnlockLayout = async () => {
    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const result = await setLayoutLocked(false)
    setIsMapOpRunning(false)
    setMapOpMessage(result.ok ? 'Layout unlocked. Visitors can place props again.' : result.message)
  }

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">Admin Panel</h2>
          <p className="text-xs text-slate-400">
            {placedProps.length} props on map
            {isSupabaseAdmin && adminProfile?.username ? ` · ${adminProfile.username}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={togglePanel} className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Hide
          </button>
          <button type="button" onClick={logout} className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-slate-800">
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <AdminSection
          title="History Controls"
          visible={settings.userVisibility.showUndoRedo}
          onToggleVisibility={() =>
            updateVisibility({ showUndoRedo: !settings.userVisibility.showUndoRedo })
          }
        >
          <div className="flex gap-2">
            <button type="button" disabled={!canUndo} onClick={undo} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40">
              Undo
            </button>
            <button type="button" disabled={!canRedo} onClick={redo} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40">
              Redo
            </button>
          </div>
        </AdminSection>

        <AdminSection
          title="Map Operations"
          visible={settings.userVisibility.showPlacementHints}
          onToggleVisibility={() =>
            updateVisibility({ showPlacementHints: !settings.userVisibility.showPlacementHints })
          }
        >
          <p className="mb-3 text-xs text-slate-400">
            Admin actions bypass rate limits and apply to the shared multiplayer map.
          </p>
          {isLayoutLocked && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-200">
              Layout is locked — visitors cannot place or edit props.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={isMapOpRunning || !isMultiplayer}
              onClick={() => void handleWipeMap()}
              className="rounded-lg bg-red-600/90 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-40"
            >
              Wipe Map Clutter
            </button>
            <button
              type="button"
              disabled={isMapOpRunning || !isMultiplayer || isLayoutLocked}
              onClick={() => void handleLockLayout()}
              className="rounded-lg bg-amber-600/90 px-3 py-2 text-sm text-white hover:bg-amber-500 disabled:opacity-40"
            >
              Lock Current Layout
            </button>
            <button
              type="button"
              disabled={isMapOpRunning || !isMultiplayer || !isLayoutLocked}
              onClick={() => void handleUnlockLayout()}
              className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Unlock Current Layout
            </button>
          </div>
          {!isMultiplayer && (
            <p className="mt-2 text-xs text-slate-500">Connect Supabase to use map operations.</p>
          )}
          {mapOpMessage && <p className="mt-2 text-xs text-slate-400">{mapOpMessage}</p>}
        </AdminSection>

        <AdminSection
          title="Placement Rules"
          visible={settings.userVisibility.showPlacementHints}
          onToggleVisibility={() =>
            updateVisibility({ showPlacementHints: !settings.userVisibility.showPlacementHints })
          }
        >
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.placementRules.snapGridEnabled}
              onChange={(event) => updateRules({ snapGridEnabled: event.target.checked })}
            />
            Snap to grid
          </label>
          <label className="mb-2 block text-sm text-slate-300">
            Grid size
            <input
              type="number"
              min={1}
              max={50}
              value={settings.placementRules.snapGridSize}
              onChange={(event) => updateRules({ snapGridSize: Number(event.target.value) || 5 })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-300">Show snap grid to users</span>
            <VisibilityToggle
              visible={settings.userVisibility.showSnapGrid}
              onToggle={() => updateVisibility({ showSnapGrid: !settings.userVisibility.showSnapGrid })}
            />
          </div>

          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.placementRules.densityEnabled}
              onChange={(event) => updateRules({ densityEnabled: event.target.checked })}
            />
            Max prop density
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Cell size
              <input
                type="number"
                min={2}
                value={settings.placementRules.densityCellSize}
                onChange={(event) =>
                  updateRules({ densityCellSize: Number(event.target.value) || 10 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              Max / cell
              <input
                type="number"
                min={1}
                value={settings.placementRules.maxPropsPerCell}
                onChange={(event) =>
                  updateRules({ maxPropsPerCell: Number(event.target.value) || 3 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
          </div>
        </AdminSection>

        <AdminSection
          title="Rate Limits"
          visible={settings.userVisibility.showPlacementHints}
          onToggleVisibility={() =>
            updateVisibility({ showPlacementHints: !settings.userVisibility.showPlacementHints })
          }
        >
          {isAdminSession && isMultiplayer && (
            <p className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2 py-1.5 text-xs text-emerald-200">
              Admin session active — rate limits bypassed for you.
            </p>
          )}

          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.rateLimit.enabled}
              onChange={(event) => updateRateLimit({ enabled: event.target.checked })}
            />
            Enable placement rate limits
          </label>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Default max placements
              <input
                type="number"
                min={1}
                value={settings.rateLimit.maxPlacements}
                onChange={(event) =>
                  updateRateLimit({ maxPlacements: Number(event.target.value) || 1 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              Default window (minutes)
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={settings.rateLimit.windowMinutes}
                onChange={(event) =>
                  updateRateLimit({ windowMinutes: Number(event.target.value) || 1 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
          </div>

          <p className="mb-2 text-xs text-slate-500">
            Per-prop overrides (placements per minute). Leave disabled to use defaults.
          </p>
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
            {settings.propLibrary
              .filter((prop) => prop.userPlaceable)
              .map((prop) => {
                const limit = getPropRateLimit(settings.rateLimit, prop.id)
                const perProp = settings.rateLimit.perProp[prop.id]
                return (
                  <div key={prop.id} className="rounded-md border border-slate-800/80 p-2">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                      <span>{prop.name}</span>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={perProp?.enabled ?? false}
                          onChange={(event) =>
                            updatePropRateLimit(prop.id, {
                              enabled: event.target.checked,
                              maxPlacements: limit.maxPlacements,
                              windowMinutes: limit.windowMinutes,
                            })
                          }
                        />
                        Custom limit
                      </label>
                    </div>
                    {(perProp?.enabled ?? false) && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px] text-slate-400">
                          Max / window
                          <input
                            type="number"
                            min={1}
                            value={perProp?.maxPlacements ?? limit.maxPlacements}
                            onChange={(event) =>
                              updatePropRateLimit(prop.id, {
                                maxPlacements: Number(event.target.value) || 1,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Window (min)
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={perProp?.windowMinutes ?? limit.windowMinutes}
                            onChange={(event) =>
                              updatePropRateLimit(prop.id, {
                                windowMinutes: Number(event.target.value) || 1,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          <button
            type="button"
            disabled={isSavingRateLimits}
            onClick={() => void handleSaveRateLimits()}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {isSavingRateLimits ? 'Applying…' : 'Apply rate limits to server'}
          </button>
          {rateLimitMessage && (
            <p className="mt-2 text-xs text-slate-400">{rateLimitMessage}</p>
          )}
        </AdminSection>

        <AdminSection
          title="Allowed Zones"
          visible={settings.userVisibility.showZoneOverlays}
          onToggleVisibility={() =>
            updateVisibility({ showZoneOverlays: !settings.userVisibility.showZoneOverlays })
          }
        >
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.placementRules.zonesEnabled}
              onChange={(event) => updateRules({ zonesEnabled: event.target.checked })}
            />
            Restrict placement to zones
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setZoneDrawingMode(!zoneDrawingMode)}
              className={`rounded-lg px-3 py-2 text-sm ${
                zoneDrawingMode ? 'bg-amber-500 text-black' : 'bg-slate-800 text-white'
              }`}
            >
              {zoneDrawingMode ? 'Drawing… click terrain' : 'Draw zone'}
            </button>
            <button type="button" onClick={clearDraftZone} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
              Clear draft
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-400">{draftZonePoints.length} draft points (min 3)</p>
          <input
            value={zoneName}
            onChange={(event) => setZoneName(event.target.value)}
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={draftZonePoints.length < 3}
            onClick={() => finishDraftZone(zoneName)}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Finish zone
          </button>
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            {settings.zones.map((zone) => (
              <li key={zone.id}>
                {zone.name} · {zone.points.length} pts
              </li>
            ))}
          </ul>
        </AdminSection>

        <AdminSection
          title="Prop Library"
          visible={settings.userVisibility.showPropToolbar}
          onToggleVisibility={() =>
            updateVisibility({ showPropToolbar: !settings.userVisibility.showPropToolbar })
          }
        >
          <div className="space-y-3">
            {settings.categories.map((category) => (
              <div key={category.id} className="rounded-lg border border-slate-800 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{category.name}</p>
                    <p className="text-xs text-slate-500">{category.description}</p>
                  </div>
                  <VisibilityToggle
                    visible={category.userVisible}
                    onToggle={() => toggleCategoryVisibility(category.id)}
                  />
                </div>
                <ul className="space-y-3">
                  {settings.propLibrary
                    .filter((prop) => prop.categoryId === category.id)
                    .map((prop) => (
                      <li key={prop.id} className="rounded-md border border-slate-800/80 p-2">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                          <span>
                            {prop.name}{' '}
                            <span className="text-slate-500">({prop.behavior})</span>
                          </span>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={prop.userPlaceable}
                              onChange={() => togglePropPlaceable(prop.id)}
                            />
                            Users
                          </label>
                        </div>

                        <label className="mb-2 block text-xs text-slate-400">
                          Collider radius
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={prop.placement.colliderRadius}
                            onChange={(event) =>
                              updatePropPlacement(prop.id, {
                                colliderRadius: Number(event.target.value) || 0.1,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                          />
                        </label>

                        <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={prop.variation.enabled}
                            onChange={(event) =>
                              updatePropVariation(prop.id, { enabled: event.target.checked })
                            }
                          />
                          Randomize color &amp; scale on place
                        </label>
                        {prop.variation.enabled && (
                          <div className="mb-2 grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-400">
                              Scale min
                              <input
                                type="number"
                                min={0.25}
                                step={0.05}
                                value={prop.variation.scaleMin}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, {
                                    scaleMin: Number(event.target.value) || 0.25,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Scale max
                              <input
                                type="number"
                                min={0.25}
                                step={0.05}
                                value={prop.variation.scaleMax}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, {
                                    scaleMax: Number(event.target.value) || 0.25,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Color min
                              <input
                                type="color"
                                value={prop.variation.colorMin}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, { colorMin: event.target.value })
                                }
                                className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Color max
                              <input
                                type="color"
                                value={prop.variation.colorMax}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, { colorMax: event.target.value })
                                }
                                className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
                              />
                            </label>
                          </div>
                        )}

                        <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={prop.placement.useCustomZones}
                            onChange={(event) =>
                              updatePropPlacement(prop.id, { useCustomZones: event.target.checked })
                            }
                          />
                          Custom zone rules
                        </label>
                        {prop.placement.useCustomZones && (
                          <div className="mb-2 space-y-1">
                            {settings.zones.length === 0 && (
                              <p className="text-[11px] text-slate-500">Draw zones first.</p>
                            )}
                            {settings.zones.map((zone) => (
                              <label key={zone.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={prop.placement.allowedZoneIds.includes(zone.id)}
                                  onChange={() => togglePropZone(prop.id, zone.id)}
                                />
                                {zone.name}
                              </label>
                            ))}
                            <p className="text-[11px] text-slate-500">
                              No zones selected = place anywhere for this prop.
                            </p>
                          </div>
                        )}

                        <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={prop.placement.useCustomDensity}
                            onChange={(event) =>
                              updatePropPlacement(prop.id, { useCustomDensity: event.target.checked })
                            }
                          />
                          Custom density rules
                        </label>
                        {prop.placement.useCustomDensity && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-400">
                              Cell size
                              <input
                                type="number"
                                min={2}
                                value={prop.placement.densityCellSize}
                                onChange={(event) =>
                                  updatePropPlacement(prop.id, {
                                    densityCellSize: Number(event.target.value) || 10,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Max / cell
                              <input
                                type="number"
                                min={1}
                                value={prop.placement.maxPropsPerCell}
                                onChange={(event) =>
                                  updatePropPlacement(prop.id, {
                                    maxPropsPerCell: Number(event.target.value) || 1,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>
    </aside>
  )
}
