'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FormCard, ListRowCard, StatRow, fc } from '@/components/clinic/MedicalForm';
import {
  normalizeClinicRooms,
  type ClinicRoom,
} from '@/lib/clinic/clinic-rooms';
import { suggestOrgCode } from '@/lib/people/org-code';

type CompanyAsset = { id: number; code?: string | null; name: string };
type Person = { id: string; name: string };

function emptyForm() {
  return {
    id: '',
    name: '',
    notes: '',
    practitioner_ids: [] as string[],
    asset_ids: [] as number[],
  };
}

export function ClinicRoomsDesk({
  companyId,
  rooms: roomsRaw,
  people,
  personNoun = 'medical advisor',
  peopleNoun = 'medical advisors',
  calendarHref,
  saving,
  post,
  summaryRoomCount,
}: {
  companyId: number;
  rooms: unknown;
  people: Person[];
  personNoun?: string;
  peopleNoun?: string;
  calendarHref: string;
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  summaryRoomCount?: number;
}) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [newAssetName, setNewAssetName] = useState('');
  const [assetBusy, setAssetBusy] = useState(false);

  const loadAssets = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(
        `/api/manufacturing/assets?companyId=${companyId}`
      );
      const data = await res.json();
      const rows = Array.isArray(data.assets) ? data.assets : [];
      setAssets(
        rows
          .map((r: Record<string, unknown>) => ({
            id: Number(r.id),
            code: r.code != null ? String(r.code) : null,
            name: String(r.name || r.code || `#${r.id}`),
          }))
          .filter((a: CompanyAsset) => a.id > 0)
      );
    } catch {
      setAssets([]);
    }
  }, [companyId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const rooms = normalizeClinicRooms(roomsRaw);

  const add = async () => {
    if (editingId) {
      toast.message('Close the room you are editing first');
      return;
    }
    const name = form.name.trim();
    if (!name) {
      toast.error('Room name required');
      return;
    }
    try {
      await post({
        action: 'add_room',
        name,
        notes: form.notes.trim() || undefined,
        practitioner_ids: form.practitioner_ids,
        asset_ids: form.asset_ids,
      });
      toast.success('Room added');
      setForm(emptyForm());
    } catch {
      /* toast from post() */
    }
  };

  const saveEdit = async (id: string) => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Room name required');
      return;
    }
    if (
      rooms.some(
        (r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      toast.error('A room with that name already exists');
      return;
    }
    try {
      await post({
        action: 'update_room',
        id,
        name,
        notes: form.notes.trim() || undefined,
        practitioner_ids: form.practitioner_ids,
        asset_ids: form.asset_ids,
      });
      toast.success('Room updated');
      setEditingId(null);
      setForm(emptyForm());
    } catch {
      /* toast from post() */
    }
  };

  const remove = async (id: string) => {
    const room = rooms.find((r) => r.id === id);
    if (!room) return;
    if (
      !confirm(
        `Remove room “${room.name}”? Diary slots keep the old name until you reassign them.`
      )
    ) {
      return;
    }
    try {
      await post({ action: 'remove_room', room_id: id });
      toast.success('Room removed');
    } catch {
      /* toast from post() */
    }
  };

  const startEdit = (room: ClinicRoom) => {
    setEditingId(room.id);
    setForm({
      id: room.id,
      name: room.name,
      notes: room.notes || '',
      practitioner_ids: [...(room.practitioner_ids || [])],
      asset_ids: [...(room.asset_ids || [])],
    });
    setNewAssetName('');
  };

  const toggleAsset = (id: number) => {
    setForm((f) => ({
      ...f,
      asset_ids: f.asset_ids.includes(id)
        ? f.asset_ids.filter((x) => x !== id)
        : [...f.asset_ids, id],
    }));
  };

  const createAsset = async () => {
    const name = newAssetName.trim();
    if (!name) {
      toast.error('Asset name required');
      return;
    }
    setAssetBusy(true);
    try {
      const res = await fetch('/api/manufacturing/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name,
          code: suggestOrgCode(name, 'AST'),
          asset_type: 'equipment',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not add asset');
        return;
      }
      const id = Number(data.asset?.id);
      await loadAssets();
      if (id > 0) {
        setForm((f) =>
          f.asset_ids.includes(id)
            ? f
            : { ...f, asset_ids: [...f.asset_ids, id] }
        );
      }
      setNewAssetName('');
      toast.success('Asset added to the company register and this room');
    } finally {
      setAssetBusy(false);
    }
  };

  const assetLabel = (id: number) => {
    const a = assets.find((x) => x.id === id);
    return a ? a.name : `Asset #${id}`;
  };

  const assetPicker = (
    <div className="sm:col-span-2 lg:col-span-3 space-y-2">
      <p className="text-[10px] font-black uppercase text-slate-400">
        Assets in this room
      </p>
      {assets.length === 0 ? (
        <p className="text-[12px] text-slate-500">
          No equipment on the company register yet. Add an exam couch, ECG,
          autoclave… It also appears under People → Organisation → Assets.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {assets.map((a) => {
            const on = form.asset_ids.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAsset(a.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  on
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          className={fc() + ' flex-1 min-w-[160px]'}
          placeholder="New asset name (e.g. ECG)"
          value={newAssetName}
          onChange={(e) => setNewAssetName(e.target.value)}
        />
        <button
          type="button"
          disabled={assetBusy || saving}
          onClick={() => void createAsset()}
          className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add asset
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Company register:{' '}
        <Link
          href="/dashboard/people/organisation"
          className="font-bold text-emerald-700 underline"
        >
          People → Organisation
        </Link>
      </p>
    </div>
  );

  const togglePerson = (id: string) => {
    setForm((f) => ({
      ...f,
      practitioner_ids: f.practitioner_ids.includes(id)
        ? f.practitioner_ids.filter((x) => x !== id)
        : [...f.practitioner_ids, id],
    }));
  };

  const personChips = (disabled: boolean) =>
    people.length === 0 ? (
      <p className="text-[12px] text-slate-500">
        Add {peopleNoun} first, then assign them to a room if you want it
        reserved for them. Leave empty so any {personNoun} can use it.
      </p>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {people.map((p) => {
          const on = !disabled && form.practitioner_ids.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => togglePerson(p.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                on
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-6">
      <StatRow
        items={[
          {
            label: 'Rooms',
            value: summaryRoomCount || rooms.length,
          },
          {
            label: peopleNoun.replace(/^./, (c) => c.toUpperCase()),
            value: people.length,
          },
          {
            label: 'Assets on rooms',
            value: rooms.reduce((n, r) => n + (r.asset_ids?.length || 0), 0),
          },
        ]}
      />

      <FormCard
        title="Add a room"
        description={`Consult rooms, surgeries and procedure bays. Attach equipment, then optionally assign the room to a ${personNoun}.`}
        onSubmit={() => void add()}
        saving={saving}
        submitLabel="Add room"
      >
        <input
          className={fc()}
          placeholder="Name * (e.g. Surgery 1)"
          value={editingId ? '' : form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          disabled={Boolean(editingId)}
        />
        <input
          className={fc()}
          placeholder="Notes (optional)"
          value={editingId ? '' : form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          disabled={Boolean(editingId)}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="mb-1 text-[10px] font-black uppercase text-slate-400">
            Assign to a {personNoun} (optional)
          </p>
          {personChips(Boolean(editingId))}
        </div>
        {editingId ? (
          <p className="sm:col-span-2 lg:col-span-3 text-[12px] text-slate-500">
            Finish editing the room below, or close Edit to add a new room.
          </p>
        ) : (
          assetPicker
        )}
      </FormCard>

      <div className="space-y-2">
        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-6 text-center dark:border-emerald-800 dark:bg-emerald-950/20">
            <p className="text-sm text-slate-600 dark:text-emerald-100">
              No rooms yet — add Surgery 1, Consult 2, Procedure bay…
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm());
              }}
            >
              <Plus className="h-3 w-3" />
              Add a room
            </button>
          </div>
        ) : (
          rooms.map((room) => {
            const assigned = people.filter((p) =>
              (room.practitioner_ids || []).includes(p.id)
            );
            const editing = editingId === room.id;
            return (
              <ListRowCard
                key={room.id}
                actions={
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-900"
                      onClick={() =>
                        editing
                          ? (setEditingId(null), setForm(emptyForm()))
                          : startEdit(room)
                      }
                    >
                      <Pencil className="h-3 w-3" />
                      {editing ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-rose-600"
                      onClick={() => void remove(room.id)}
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" />
                      Remove
                    </button>
                  </>
                }
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {room.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {assigned.length
                      ? assigned.map((p) => p.name).join(', ')
                      : `Any ${personNoun}`}
                    {(room.asset_ids || []).length
                      ? ` · ${(room.asset_ids || [])
                          .map((id) => assetLabel(id))
                          .join(', ')}`
                      : ''}
                    {room.notes ? ` · ${room.notes}` : ''}
                  </p>
                </div>
                {editing ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      className={fc()}
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                    <input
                      className={fc()}
                      placeholder="Notes (optional)"
                      value={form.notes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                      }
                    />
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-[10px] font-black uppercase text-slate-400">
                        Assign to a {personNoun} (optional)
                      </p>
                      {personChips(false)}
                    </div>
                    {assetPicker}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveEdit(room.id)}
                      className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      Save room
                    </button>
                  </div>
                ) : null}
              </ListRowCard>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Assign a room when you schedule on the{' '}
        <Link
          href={calendarHref}
          className="font-bold text-emerald-700 underline"
        >
          calendar
        </Link>
        . Two {peopleNoun} can run at the same time in different rooms.
      </p>
    </div>
  );
}
