import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { KlareErfassung } from '@/types/app';
import { LOOKUP_OPTIONS, APP_IDS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { HeroBanner } from '@/components/HeroBanner';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import { ChartWidget, type ChartRow } from '@/components/widgets/ChartWidget';
import {
  useRecordOverlayStack,
  RecordOverlayHost,
  RecordHeader,
  RecordAttachments,
} from '@/components/widgets/RecordView';
import { KlareErfassungDetails } from '@/components/details/KlareErfassungDetails';
import { KlareErfassungDialog } from '@/components/dialogs/KlareErfassungDialog';
import type { KlareErfassungDialogDefaults } from '@/components/dialogs/KlareErfassungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { IconPlus, IconCircleCheck } from '@tabler/icons-react';

// ─── Spalten aus dem Schema ─────────────────────────────────────────────────
const COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['klare_erfassung']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'abgeschlossen') return 'success';
  if (status === 'in_bearbeitung') return 'primary';
  return 'warning';
}

function toneForKategorie(kat: string | undefined): KanbanTone {
  if (kat === 'dringend') return 'destructive' as KanbanTone;
  if (kat === 'wichtig') return 'warning';
  return 'default';
}

// ─── Chart-Row-Typ ───────────────────────────────────────────────────────────
type EintragRow = ChartRow<KlareErfassung>;

export default function DashboardOverview() {
  const clock = useClock();
  const {
    klareErfassung,
    setKlareErfassung,
    loading, error, fetchAll,
  } = useDashboardData();

  const overlay = useRecordOverlayStack<{ type: string; id: string }>();

  // Dialog-State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<KlareErfassung | null>(null);
  const [defaultValues, setDefaultValues] = useState<KlareErfassungDialogDefaults | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<KlareErfassung | null>(null);

  // ─── Abgeleitete Werte (Hooks vor Early-Returns) ─────────────────────────
  const today = format(clock, 'yyyy-MM-dd');

  const offene = useMemo(
    () => klareErfassung.filter(e => lookupKey(e.fields.status) === 'offen'),
    [klareErfassung],
  );
  const inBearbeitung = useMemo(
    () => klareErfassung.filter(e => lookupKey(e.fields.status) === 'in_bearbeitung'),
    [klareErfassung],
  );
  const dringende = useMemo(
    () => klareErfassung.filter(e => lookupKey(e.fields.kategorie) === 'dringend'),
    [klareErfassung],
  );
  const heuteFaellig = useMemo(
    () => klareErfassung.filter(e => e.fields.datum === today),
    [klareErfassung, today],
  );

  const cards = useMemo<KanbanCard[]>(
    () =>
      klareErfassung.map(e => {
        const status = lookupKey(e.fields.status) ?? COLUMNS[0]?.key ?? '';
        const kat = lookupKey(e.fields.kategorie);
        return {
          id: `eintrag:${e.record_id}`,
          column: status,
          title: e.fields.titel ?? 'Ohne Titel',
          subtitle: [e.fields.kategorie?.label, e.fields.datum ? formatDate(e.fields.datum) : undefined]
            .filter(Boolean).join(' · '),
          tone: toneForKategorie(kat) !== 'default' ? toneForKategorie(kat) : toneForStatus(status),
        };
      }),
    [klareErfassung],
  );

  const chartRows = useMemo<EintragRow[]>(
    () => klareErfassung.map(e => ({ id: `eintrag:${e.record_id}`, data: e })),
    [klareErfassung],
  );

  // ─── Status-Advance ──────────────────────────────────────────────────────
  const advance = useCallback(async (record: KlareErfassung) => {
    const current = lookupKey(record.fields.status);
    const next =
      current === 'offen' ? 'in_bearbeitung'
      : current === 'in_bearbeitung' ? 'abgeschlossen'
      : null;
    if (!next) return;
    const nextLabel = COLUMNS.find(c => c.key === next)?.label ?? next;
    const prevStatus = record.fields.status;
    setKlareErfassung(prev =>
      prev.map(e =>
        e.record_id === record.record_id
          ? { ...e, fields: { ...e.fields, status: { key: next, label: nextLabel } } }
          : e,
      ),
    );
    undoToast(`"${record.fields.titel ?? 'Eintrag'}" → ${nextLabel}`, async () => {
      setKlareErfassung(prev =>
        prev.map(e =>
          e.record_id === record.record_id
            ? { ...e, fields: { ...e.fields, status: prevStatus } }
            : e,
        ),
      );
      await LivingAppsService.updateKlareErfassungEntry(record.record_id, { status: (prevStatus && typeof prevStatus === 'object' ? prevStatus.key : prevStatus) ?? undefined });
    });
    try {
      await LivingAppsService.updateKlareErfassungEntry(record.record_id, { status: next });
    } catch {
      await fetchAll();
    }
  }, [klareErfassung, setKlareErfassung, fetchAll]);

  // ─── Kanban-Drag ─────────────────────────────────────────────────────────
  const moveCard = useCallback(async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const record = klareErfassung.find(e => e.record_id === rid);
    if (!record) return;
    const prevStatus = record.fields.status;
    const newLabel = COLUMNS.find(c => c.key === newColumn)?.label ?? newColumn;
    setKlareErfassung(prev =>
      prev.map(e =>
        e.record_id === rid
          ? { ...e, fields: { ...e.fields, status: { key: newColumn, label: newLabel } } }
          : e,
      ),
    );
    undoToast(`"${record.fields.titel ?? 'Eintrag'}" → ${newLabel}`, async () => {
      setKlareErfassung(prev =>
        prev.map(e =>
          e.record_id === rid
            ? { ...e, fields: { ...e.fields, status: prevStatus } }
            : e,
        ),
      );
      await LivingAppsService.updateKlareErfassungEntry(rid, { status: (prevStatus && typeof prevStatus === 'object' ? prevStatus.key : prevStatus) ?? undefined });
    });
    try {
      await LivingAppsService.updateKlareErfassungEntry(rid, { status: newColumn });
    } catch {
      await fetchAll();
    }
  }, [klareErfassung, setKlareErfassung, fetchAll]);

  // ─── Dialog-Handler ──────────────────────────────────────────────────────
  const openCreate = useCallback((defaults?: KlareErfassungDialogDefaults) => {
    setEditRecord(null);
    setDefaultValues(defaults);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((record: KlareErfassung) => {
    setEditRecord(record);
    setDefaultValues(undefined);
    setDialogOpen(true);
  }, []);

  // ─── Early Returns ───────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Leere App ───────────────────────────────────────────────────────────
  if (klareErfassung.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
        <IconCircleCheck size={48} className="text-muted-foreground" />
        <div>
          <h2 className="text-xl font-semibold mb-2">Noch keine Einträge</h2>
          <p className="text-muted-foreground text-sm">Erstelle deinen ersten Eintrag und behalte den Überblick.</p>
        </div>
        <Button onClick={() => openCreate()}>
          <IconPlus size={16} className="mr-1 shrink-0" />
          Ersten Eintrag anlegen
        </Button>
        <KlareErfassungDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={async fields => { await LivingAppsService.createKlareErfassungEntry(fields); fetchAll(); }}
          defaultValues={defaultValues}
          recordId={editRecord?.record_id}
          enablePhotoScan={AI_PHOTO_SCAN['KlareErfassung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['KlareErfassung']}
        />
      </div>
    );
  }

  // ─── Kontext-Satz ─────────────────────────────────────────────────────────
  const dringendNames = namen(dringende.map(e => e.fields.titel ?? '').filter(Boolean));
  const contextLine = dringende.length > 0
    ? `${dringendNames} – ${dringende.length === 1 ? 'ein dringender Eintrag' : `${dringende.length} dringende Einträge`} warten auf dich.`
    : offene.length > 0
    ? `${offene.length} offene ${offene.length === 1 ? 'Aufgabe' : 'Aufgaben'} — ${inBearbeitung.length} in Bearbeitung.`
    : 'Alles erledigt – du bist auf dem neuesten Stand!';

  // ─── Overlay-Datenzugriff ─────────────────────────────────────────────────
  const overlayRecord = overlay.top
    ? klareErfassung.find(e => e.record_id === overlay.top!.id)
    : undefined;

  return (
    <>
      {/* Seitenheader */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">{contextLine}</p>
        </div>
        <Button onClick={() => openCreate()} className="shrink-0">
          <IconPlus size={16} className="mr-1 shrink-0" />
          Neuer Eintrag
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          dringende.length > 0 ? (
            <HeroBanner
              icon={<IconCircleCheck size={18} />}
              action={{
                label: dringende[0] ? `"${dringende[0].fields.titel ?? 'Eintrag'}" weiterschalten` : 'Weiterschalten',
                onClick: () => dringende[0] && advance(dringende[0]),
              }}
            >
              <b>{dringendNames}</b> {dringende.length === 1 ? 'ist als dringend markiert' : 'sind als dringend markiert'} – sofort handeln.
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title="Offen"
              value={offene.length}
              tone={offene.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="In Bearbeitung"
              value={inBearbeitung.length}
              tone={inBearbeitung.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Heute fällig"
              value={heuteFaellig.length}
              tone={heuteFaellig.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title="Gesamt"
              value={klareErfassung.length}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={COLUMNS}
            defaultCollapsed={['abgeschlossen']}
            onCardClick={card => {
              const rid = card.id.split(':')[1] ?? '';
              overlay.replace({ type: 'eintrag', id: rid });
            }}
            onCardMove={moveCard}
            onAddCard={column => openCreate({ status: column })}
          />
        }
        aside={
          <>
            <WorkList
              title="Offen & In Bearbeitung"
              items={[...offene, ...inBearbeitung]
                .sort((a, b) => (a.fields.datum ?? '').localeCompare(b.fields.datum ?? ''))
                .slice(0, 8)
                .map(e => {
                  const status = lookupKey(e.fields.status);
                  const isOffen = status === 'offen';
                  return {
                    id: e.record_id,
                    title: e.fields.titel ?? 'Ohne Titel',
                    secondLine: (
                      <>
                        <span className={`font-medium ${isOffen ? 'text-warning' : 'text-primary'}`}>
                          {e.fields.status?.label ?? '—'}
                        </span>
                        {e.fields.datum && (
                          <span className="text-muted-foreground"> · {formatDate(e.fields.datum)}</span>
                        )}
                      </>
                    ),
                    action: {
                      label: isOffen ? '→ Bearbeitung' : '✓ Fertig',
                      onClick: () => advance(e),
                    },
                  };
                })}
              onItemClick={id => overlay.replace({ type: 'eintrag', id })}
              empty={{
                text: 'Alle Einträge abgeschlossen – gut gemacht!',
                action: { label: 'Neuer Eintrag', onClick: () => openCreate() },
              }}
            />
            <ChartWidget
              title="Nach Kategorie"
              rows={chartRows}
              dimension={{
                kind: 'category',
                accessor: r => r.data.fields.kategorie ?? null,
              }}
            />
          </>
        }
      />

      {/* Overlay-Stack */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          const rec = klareErfassung.find(e => e.record_id === top.id);
          if (!rec) return null;
          return (
            <>
              <RecordHeader
                title={rec.fields.titel ?? 'Ohne Titel'}
                subtitle={[rec.fields.kategorie?.label, rec.fields.status?.label].filter(Boolean).join(' · ')}
              />
              <KlareErfassungDetails record={rec} />
            </>
          );
        }}
        footer={top => {
          const rec = klareErfassung.find(e => e.record_id === top.id);
          if (!rec) return undefined;
          const status = lookupKey(rec.fields.status);
          if (status === 'abgeschlossen') return undefined;
          const nextLabel = status === 'offen' ? 'In Bearbeitung setzen' : 'Als abgeschlossen markieren';
          return { label: nextLabel, onClick: () => advance(rec) };
        }}
        onEdit={top => {
          const rec = klareErfassung.find(e => e.record_id === top.id);
          if (rec) openEdit(rec);
        }}
      />

      {/* Dialoge */}
      <KlareErfassungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); setDefaultValues(undefined); }}
        onSubmit={async fields => {
          if (editRecord) {
            await LivingAppsService.updateKlareErfassungEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createKlareErfassungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord?.fields ?? defaultValues}
        recordId={editRecord?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['KlareErfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['KlareErfassung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description={`"${deleteTarget?.fields.titel ?? 'Dieser Eintrag'}" wirklich löschen?`}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await LivingAppsService.deleteKlareErfassungEntry(deleteTarget.record_id);
          setDeleteTarget(null);
          fetchAll();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
