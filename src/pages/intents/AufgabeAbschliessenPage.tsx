/**
 * Aufgabe abschließen — 2-Schritt-Wizard.
 * Steps: 1) Aufgabe wählen (nur offen/in_bearbeitung) → 2) Abschlussnotiz eingeben & Status auf abgeschlossen setzen.
 * Reads: klareErfassung. Writes: klareErfassung (updateKlareErfassungEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { KlareErfassung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IconCircleCheck, IconAlertCircle } from '@tabler/icons-react';

export default function AufgabeAbschliessenPage() {
  const { klareErfassung, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<KlareErfassung | null>(null);
  const [anmerkungen, setAnmerkungen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const eligibleRecords = klareErfassung.filter(
    (e) => e.fields.status?.key === 'offen' || e.fields.status?.key === 'in_bearbeitung'
  );

  const handleSelect = (id: string) => {
    const record = klareErfassung.find((e) => e.record_id === id) ?? null;
    setSelectedRecord(record);
    setStep(2);
  };

  const handleAbschliessen = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateKlareErfassungEntry(selectedRecord.record_id, {
        status: 'abgeschlossen',
        anmerkungen: anmerkungen || undefined,
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError('Fehler beim Abschließen der Aufgabe. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedRecord(null);
    setAnmerkungen('');
    setSubmitError(null);
    setDone(false);
  };

  return (
    <IntentWizardShell
      title="Aufgabe abschließen"
      subtitle="Wähle eine offene Aufgabe und schließe sie ab"
      steps={[{ label: 'Aufgabe wählen' }, { label: 'Abschließen' }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {step === 1 && (
        <EntitySelectStep
          items={eligibleRecords.map((e) => ({
            id: e.record_id,
            title: e.fields.titel ?? '(Ohne Titel)',
            subtitle: [
              e.fields.kategorie?.label,
              e.fields.datum ? formatDate(e.fields.datum) : undefined,
            ]
              .filter(Boolean)
              .join(' · '),
            status: e.fields.status
              ? { key: e.fields.status.key, label: e.fields.status.label }
              : undefined,
          }))}
          onSelect={handleSelect}
          searchPlaceholder="Aufgaben durchsuchen …"
          emptyText="Keine offenen oder laufenden Aufgaben vorhanden."
        />
      )}

      {step === 2 && (
        selectedRecord ? (
          done ? (
            <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
              <IconCircleCheck size={56} className="text-green-500" stroke={1.5} />
              <div>
                <p className="text-lg font-semibold text-foreground">
                  Aufgabe abgeschlossen!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  „{selectedRecord.fields.titel ?? '(Ohne Titel)'}" wurde erfolgreich abgeschlossen.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline">
                  Weitere Aufgabe abschließen
                </Button>
                <a href="#/">
                  <Button>Zurück zum Dashboard</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-lg mx-auto">
              {/* Zusammenfassung der gewählten Aufgabe */}
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {selectedRecord.fields.titel ?? '(Ohne Titel)'}
                    </p>
                    {selectedRecord.fields.kategorie && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedRecord.fields.kategorie.label}
                      </p>
                    )}
                    {selectedRecord.fields.datum && (
                      <p className="text-sm text-muted-foreground">
                        {formatDate(selectedRecord.fields.datum)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <StatusBadge
                      statusKey={selectedRecord.fields.status?.key}
                      label={selectedRecord.fields.status?.label}
                    />
                  </div>
                </div>
                {selectedRecord.fields.beschreibung && (
                  <p className="text-sm text-muted-foreground border-t pt-3">
                    {selectedRecord.fields.beschreibung}
                  </p>
                )}
              </div>

              {/* Abschlussnotiz */}
              <div className="space-y-2">
                <Label htmlFor="anmerkungen" className="text-sm font-medium">
                  Abschlussnotiz <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="anmerkungen"
                  value={anmerkungen}
                  onChange={(e) => setAnmerkungen(e.target.value)}
                  placeholder="Was wurde erledigt? Gibt es Hinweise für die Zukunft?"
                  rows={4}
                  className="resize-none"
                />
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="sm:w-auto w-full"
                >
                  Zurück
                </Button>
                <Button
                  onClick={handleAbschliessen}
                  disabled={submitting}
                  className="sm:flex-1 w-full"
                >
                  {submitting ? 'Wird abgeschlossen …' : 'Aufgabe abschließen'}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Auswahl aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
